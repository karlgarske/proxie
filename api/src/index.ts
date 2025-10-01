import 'dotenv/config';
import express from 'express';
import type { Server } from 'http';
import { registerRoutes } from './routes.js';
import { createHelloServiceFromEnv } from './service/HelloService.js';
import { ConversationService } from './service/ConversationService.js';
import type { Conversation } from './models/conversation.js';
import { lru } from 'tiny-lru';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

const helloService = createHelloServiceFromEnv();

// builds conversation service with dependencies injected as config

const CONVERSATION_TTL_MS = 1000 * 60 * 5; // 5 minutes
const conversationCache = lru<Conversation>(100, CONVERSATION_TTL_MS);
const conversationService = new ConversationService({
  idGenerator: uuidv4,
  cache: {
    get: (conversationId) => conversationCache.get(conversationId),
    set: (conversationId, conversation) => conversationCache.set(conversationId, conversation),
  },
});

registerRoutes(app, helloService, conversationService);

const PORT = 3001; // fixed in current config

let server: Server | undefined;

try {
  server = app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('API server failed to start', err);
    process.exit(1);
  });
} catch (error) {
  console.error('Unexpected error while starting API server', error);
  process.exit(1);
}

process.once('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down API server');

  if (!server) process.exit(0);
  server.close((err?: Error) => {
    if (err) {
      console.error('Error while shutting down API server', err);
      process.exit(1);
    }
    process.exit(0);
  });
});
