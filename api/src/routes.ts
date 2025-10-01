import 'dotenv/config';
import type { Express, Request, Response } from 'express';
import { HelloRequestSchema } from './models/hello.js';
import { HelloService } from './service/HelloService.js';
import { ConversationService } from './service/ConversationService.js';
//import { CONVERSATION_TTL_MS } from './models/conversation.js';
import { ChatOpenAI } from '@langchain/openai';
import { Firestore } from '@google-cloud/firestore';
import { readFileSync } from 'node:fs';

import {
  AIMessageChunk,
  HumanMessage,
  MessageContentText,
  SystemMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import { env } from 'node:process';

console.warn(`Using firestore for project:${process.env.PROJECT}`);
const firestore = new Firestore({ projectId: process.env.PROJECT });
const conversationsCollection = firestore.collection('conversations');

const MessageSchema = z.object({
  conversationId: z.string().nonempty('conversationId is required'),
  text: z.string().nonempty('text is required'),
  responseId: z.string().nullable().optional(),
});

const systemPrompt = readFileSync(new URL('../prompts/systemMessage.md', import.meta.url), 'utf-8');
const systemMessage = new SystemMessage(systemPrompt);

export function registerRoutes(
  app: Express,
  helloService: HelloService,
  conversationService: ConversationService
) {
  app.get('/api/hello', (req: Request, res: Response) => {
    const parsed = HelloRequestSchema.safeParse({ name: req.query.name });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const result = helloService.hello(parsed.data.name);
    return res.json(result);
  });

  app.post('/api/conversations', async (req, res) => {
    console.log('posting conversation');
    const conversation = conversationService.createConversation();
    res.status(200).json(conversation);
  });

  app.post('/api/response/sse', async (req, res) => {
    const message = MessageSchema.safeParse(req.body);
    if (!message.success) {
      console.error('error:', message.error.flatten());
      return res.status(400).json({ error: message.error });
    }

    const { conversationId, responseId } = message.data;
    let conversation = conversationService.getConversation(conversationId);
    if (!conversation) {
      //cache missed, so try loading conversation from firestore
      const doc = await conversationsCollection.doc(conversationId).get();
      if (!doc.exists)
        return res.status(404).json({ error: 'Conversation does not exist and may have expired.' });
      else {
        const data = doc.data();
        const now = Date.now(); // current time in ms
        const expiration = new Date(data?.expiration).getTime();
        if (now > expiration) return res.status(404).json({ error: 'Conversation has expired.' });
        conversation = { conversationId: doc.id, lastResponseId: data?.responseId };
        conversationService.cacheConversation(conversation);
      }
    }

    if (conversation.lastResponseId) {
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
        const expiration = new Date(Date.now() + 1000 * 60 * 5); //todo: use cache expire method

        const result = {
          conversationId: conversationId,
          responseId: newResponseId,
          content: chunk.content,
          expires: expiration,
        };

        try {
          await conversationsCollection.doc(conversationId).set(
            {
              //conversationId,
              responseId: result.responseId, //pointer
              //content: chunk.content,
              expires: expiration.toISOString(),
              env: env.ENV || 'development',
              //updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          await conversationsCollection
            .doc(conversationId)
            .collection('responses')
            .doc(result.responseId)
            .set(
              {
                //conversationId,
                //responseId: result.responseId,
                prompt: message.data.text,
                content: chunk.content,
                created: Date.now(),
                //expires: expiration.toISOString(),
                //updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
        } catch (error) {
          console.error('failed to update Firestore conversation', error);
        }

        conversationService.cacheConversation({ conversationId, lastResponseId: newResponseId });

        res.write(`data: ${JSON.stringify({ event: 'ended', result })}\n\n`);
      } else {
        console.warn('unhandled event:', event);
      }
    }

    res.status(200);
    res.end();
  });
}
