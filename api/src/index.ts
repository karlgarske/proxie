import 'dotenv/config';
import express from 'express';
import type { Server } from 'http';
import { readFileSync } from 'node:fs';
import { Firestore } from '@google-cloud/firestore';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage } from '@langchain/core/messages';
import { registerRoutes } from './routes.js';
import { createHelloServiceFromEnv } from './service/HelloService.js';
import { ConversationService } from './service/ConversationService.js';
import { ClassifyService } from './service/ClassifyService.js';
import type { Conversation } from './models/conversation.js';
import { lru } from 'tiny-lru';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

const helloService = createHelloServiceFromEnv();

const openAIApiKey = process.env.OPENAI_API_KEY;
if (!openAIApiKey) throw new Error('OPENAI_API_KEY is not set');

const vectorStoreId = process.env.VECTOR_STORE;
if (!vectorStoreId) throw new Error('VECTOR_STORE is not set');

const projectId = process.env.PROJECT;
if (!projectId) throw new Error('PROJECT is not set');

console.warn(`Using firestore for project:${projectId}`);
const firestore = new Firestore({ projectId });

const systemPrompt = readFileSync(new URL('../prompts/systemMessage.md', import.meta.url), 'utf-8');
const systemMessage = new SystemMessage(systemPrompt);

const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
  useResponsesApi: true,
  apiKey: openAIApiKey,
});

const environment = process.env.ENV || 'development';

// builds conversation service with dependencies injected as config
const CONVERSATION_TTL_MS = 1000 * 60 * 5; // 5 minutes
const conversationCache = lru<Conversation>(100, CONVERSATION_TTL_MS);
const conversationService = new ConversationService({
  idGenerator: uuidv4,
  cache: {
    get: (conversationId) => conversationCache.get(conversationId),
    set: (conversationId, conversation) => conversationCache.set(conversationId, conversation),
    expire: () => new Date(Date.now() + CONVERSATION_TTL_MS),
  },
  firestore,
  env: environment,
  systemMessage,
  model,
  vectorStoreId,
});

const classifyPrompt = readFileSync(
  new URL('../prompts/classify/systemMessage.md', import.meta.url),
  'utf-8'
);
const classifyMessage = new SystemMessage(systemPrompt);
const visualizationService = new ClassifyService({
  model,
  firestore,
  env: environment,
  systemMessage,
});

registerRoutes(app, helloService, conversationService, visualizationService);

const PORT = 3001; // fixed in current nginx config

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
