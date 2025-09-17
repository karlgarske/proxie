import 'dotenv/config';
import express from 'express';
import { registerRoutes } from './routes.js';
import { createHelloServiceFromEnv } from './service/HelloService.js';

const app = express();
app.use(express.json());

const service = createHelloServiceFromEnv();
registerRoutes(app, service);

const PORT = 3001; // fixed per requirements
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});

