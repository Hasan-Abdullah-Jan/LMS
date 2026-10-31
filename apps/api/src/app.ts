import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiLimiter } from './middleware/rate-limits.js';
import { apiRouter } from './routes/index.js';

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: env.SERVE_WEB
        ? {
            directives: {
              defaultSrc: ["'self'"],
              connectSrc: ["'self'", env.SUPABASE_URL, env.SUPABASE_URL.replace(/^http/, 'ws')],
              imgSrc: ["'self'", 'data:', 'blob:'],
              styleSrc: ["'self'", "'unsafe-inline'"],
              fontSrc: ["'self'", 'data:'],
            },
          }
        : undefined,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    '/api',
    cors({
      origin(origin, callback) {
        // Same-origin and non-browser requests have no Origin header.
        if (!origin || env.CLIENT_ORIGIN.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      maxAge: 600,
    }),
  );
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', apiLimiter, apiRouter);
  app.use('/api', notFoundHandler);

  // Optional single-service deployment: serve the built SPA with client-side routing.
  if (env.SERVE_WEB && existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
