import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { apiLimiter } from './middleware/rateLimit';
import { paginationMiddleware } from './middleware/pagination';
import { errorHandler, notFoundHandler } from './middleware/error';
import { logger } from './lib/logger';
import v1Router from './routes/v1';

const app = express();

// Trust the proxy when behind docker-compose / reverse proxies
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(paginationMiddleware);
app.use(apiLimiter);

// Minimal request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health check (unauthenticated, used by compose + CI)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Versioned API
app.use('/api/v1', v1Router);

// 404 + central error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
