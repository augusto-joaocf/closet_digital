import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { ApiError } from './utils/errors.js';
import { createAuthMiddleware } from './middlewares/authMiddleware.js';
import { createErrorMiddleware } from './middlewares/errorMiddleware.js';
import { createAuthRoutes } from './routes/authRoutes.js';

export function createApp({ config, authService, database, logger = console, clock }) {
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.set('trust proxy', config.trustProxy);
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set('X-Request-ID', req.requestId);
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      if (origin === undefined) return callback(null, false);
      if (config.allowedOrigins.includes(origin)) return callback(null, origin);
      return callback(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não autorizada.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Protection'],
    exposedHeaders: ['X-Request-ID', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 600,
  }));
  app.use('/api', rateLimit({
    windowMs: config.rateLimit.windowMs, limit: config.rateLimit.apiMax,
    standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Limite de requisições atingido. Tente novamente mais tarde.' } }),
  }));
  app.use(express.json({ limit: config.jsonLimit, strict: true }));
  app.use(cookieParser());
  app.get('/api/health', async (req, res) => {
    await database.check();
    res.json({ data: { status: 'ok', database: 'up' } });
  });
  app.use('/api/auth', createAuthRoutes({ config, authService, clock }));
  app.get('/api/users/me', createAuthMiddleware(authService), (req, res) => res.json({ data: req.auth.user }));
  app.use((req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'Rota não encontrada.')));
  app.use(createErrorMiddleware(logger));
  return app;
}
