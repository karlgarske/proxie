import 'dotenv/config';
import express from 'express';
import type { Server } from 'http';
import { registerRoutes } from './routes.js';
import { createHelloServiceFromEnv } from './service/HelloService.js';

const app = express();
app.use(express.json());

const service = createHelloServiceFromEnv();
registerRoutes(app, service);

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
