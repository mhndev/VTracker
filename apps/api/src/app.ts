import express from 'express';
import { attachActor } from './middleware/auth.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { healthRouter } from './routes/health.routes.js';
import { apiRouter } from './routes/index.js';
import { env } from './config/env.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // CORS — allow portal/admin origins from env
  app.use((request, response, next) => {
    const origins = env.corsOrigin;
    const origin = request.headers.origin as string | undefined;
    if (origins && origin && origins.includes(origin)) {
      response.header('Access-Control-Allow-Origin', origin);
      response.header('Vary', 'Origin');
      response.header('Access-Control-Allow-Credentials', 'true');
      response.header('Access-Control-Allow-Headers', 'content-type, x-demo-actor, authorization');
      response.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    } else if (!origins && env.nodeEnv === 'development') {
      // permissive in dev when not configured
      if (origin) {
        response.header('Access-Control-Allow-Origin', origin);
        response.header('Vary', 'Origin');
        response.header('Access-Control-Allow-Headers', 'content-type, x-demo-actor, authorization');
        response.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      }
    }
    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/health', healthRouter);
  app.use('/api', attachActor, apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
