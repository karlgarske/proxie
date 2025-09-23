import 'dotenv/config';
import express from 'express';
import { registerRoutes } from './routes.js';
import { createHelloServiceFromEnv } from './service/HelloService.js';

const app = express();
app.use(express.json());

const service = createHelloServiceFromEnv();
registerRoutes(app, service);

const PORT = 3001; // fixed per requirements
//const PORT = process.env.PORT ?? 3001;

try {
  const server = app.listen(PORT, () => {
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
