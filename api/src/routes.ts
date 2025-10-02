import 'dotenv/config';
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { HelloRequestSchema } from './models/hello.js';
import { HelloService } from './service/HelloService.js';
import { ConversationError, ConversationService } from './service/ConversationService.js';

const MessageSchema = z.object({
  conversationId: z.string().nonempty('conversationId is required'),
  text: z.string().nonempty('text is required'),
  responseId: z.string().nullable().optional(),
});

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

  app.post('/api/conversations', async (_req, res) => {
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

    try {
      res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const stream = conversationService.streamResponse({
        conversationId: message.data.conversationId,
        text: message.data.text,
        responseId: message.data.responseId ?? null,
      });

      for await (const event of stream) {
        res.flushHeaders();
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      res.status(200).end();
    } catch (error: any) {
      const message = error.message ?? error;
      console.error('Conversation response stream error:', message);
      const event = { event: 'error', message: message };
      return res.status(500).json(event);
    }
  });
}
