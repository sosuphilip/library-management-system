import pino from 'pino';
import { env } from '../config/env';

const isDev = env.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' }
        }
      }
    : {})
});

export default logger;
