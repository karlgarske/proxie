import 'dotenv/config';
import type { Express, Request, Response } from 'express';
import { HelloRequestSchema } from './models/hello.js';
import { HelloService } from './service/HelloService.js';
import { ChatOpenAI } from '@langchain/openai';
import { lru } from 'tiny-lru';
import { v4 as uuidv4 } from 'uuid';

import {
  AIMessageChunk,
  HumanMessage,
  MessageContentText,
  SystemMessage,
} from '@langchain/core/messages';
import { z } from 'zod';

type Conversation = {
  conversationId: string;
  lastResponseId?: string;
};

const DURATION = 1000 * 60 * 5; //duration of conversation (5 min after last update)
const conversations = lru<Conversation>(100, DURATION);

const MessageSchema = z.object({
  conversationId: z.string().nonempty('conversationId is required'),
  text: z.string().nonempty('text is required'),
  responseId: z.string().nullable().optional(),
});

const systemMessage = new SystemMessage(
  "# Role \n\nYou're a helpful assistant on a website for Karl, answering questions to a potential employer on his behalf. Speak as though you are Karl.\n\n" +
    '## Tasks \n\n' +
    "- Assume requests for a cover letter, resume, work experience, etc. are referring to Karl's work experience.\n" +
    '- Do not attempt to write code.\n' +
    '- If you cannot help with something, please politely decline.\n' +
    "# Karl's Background & Experience \n\n" +
    '- Be certain you are referencing only factual information provided by the file search tool.\n' +
    '- Do not attempt to answer questions without supporting evidence. \n' +
    '- You are allowed to answer about location (past or present).\n' +
    '# Response Formatting\n\n' +
    '- Use a codeblock for structured content like code, drafts, or hierarchical lists.\n' +
    '- Use a table for complex multi-dimensional comparisons, breakdowns, etc.\n' +
    '- Do not use h1,h2 -- only h3,h4,h5,h6.\n' +
    '- Use headings instead of nested lists.\n' +
    '# File Search\n\n' +
    '- Do not mention "files", "documents", or "uploads"\n' +
    '- Do not give details about file names or structure.\n' +
    '- If no files are relevant, suggest some options you can assist with.\n' +
    '## Sensitive Details \n\n' +
    '- You are not allowed to give direct email or phone numbers for me or anyone I mention.\n'
);

export function registerRoutes(app: Express, service: HelloService) {
  app.get('/api/hello', (req: Request, res: Response) => {
    const parsed = HelloRequestSchema.safeParse({ name: req.query.name });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const result = service.hello(parsed.data.name);
    return res.json(result);
  });

  app.post('/api/conversations', async (req, res) => {
    console.log('posting conversation');
    const conversation = { conversationId: uuidv4() };
    conversations.set(conversation.conversationId, conversation);
    res.status(200).json(conversation);
  });

  app.post('/api/response/sse', async (req, res) => {
    const message = MessageSchema.safeParse(req.body);
    if (!message.success) {
      console.error('error:', message.error.flatten());
      return res.status(400).json({ error: message.error });
    }

    const { conversationId, responseId } = message.data;
    const conversation = conversations.get(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation does not exist and may have expired.' });
    } else if (conversation.lastResponseId) {
      if (conversation.lastResponseId != responseId)
        return res
          .status(403)
          .json({ error: 'Response is not a valid starting point for this conversation.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('open ai key not set'); //todo: move to service param

    const vectorStore = process.env.VECTOR_STORE;
    if (!vectorStore) throw new Error('vector store id not set'); //todo: move to service param

    const model = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
      useResponsesApi: true,
      apiKey: apiKey,
    });

    const configured = model.withConfig({
      tools: [{ type: 'file_search', vector_store_ids: [vectorStore] }],
      tool_choice: 'auto',
      previous_response_id: responseId ?? null,
    });

    const messages = [systemMessage, new HumanMessage(message.data.text)];

    //sets sets headers for sse response
    /*
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    "X-Accel-Buffering": "no" // tells nginx not to buffer, as a backup
    res.flushHeaders();*/

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // tells nginx not to buffer, as a backup
    });

    const eventStream = configured.streamEvents(messages, { version: 'v2' });
    const buffer: any[] = [];

    for await (const event of eventStream) {
      if (event.event == 'on_chat_model_start') {
        res.write(`data: ${JSON.stringify({ event: 'started' })}\n\n`);
      } else if (event.event == 'on_chat_model_stream') {
        const chunk = event.data.chunk as AIMessageChunk;
        const meta = chunk.response_metadata;
        if (chunk.content.length) {
          const content = chunk.content[0] as MessageContentText;
          buffer.push(content.text);
        }

        if (buffer.length > 5 || meta.status == 'completed') {
          res.write(`data: ${JSON.stringify({ event: 'data', text: buffer.join('') })}\n\n`);
          res.flushHeaders();
          buffer.length = 0;
        }
      } else if (event.event == 'on_chat_model_end') {
        const chunk = event.data.output as AIMessageChunk;
        const newResponseId = chunk.response_metadata.id;
        const expiration = new Date(Date.now() + DURATION);

        const result = {
          conversationId: conversationId,
          responseId: newResponseId,
          content: chunk.content,
          expires: expiration,
        };

        //update cache
        conversations.set(conversationId, { conversationId, lastResponseId: newResponseId });

        res.write(`data: ${JSON.stringify({ event: 'ended', result })}\n\n`);
      } else {
        console.warn('unhandled event:', event);
      }
    }

    res.status(200);
    res.end();
  });
}
