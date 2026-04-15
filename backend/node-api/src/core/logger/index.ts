import winston from 'winston';
import { config } from '../../config';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Human-readable format for development
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${stack ? `\n${stack}` : ''}${metaStr}`;
  }),
);

// JSON format for production (structured for log aggregators)
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

export const logger = winston.createLogger({
  level:      config.isDev ? 'debug' : 'info',
  format:     config.isDev ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
  // Suppress noisy logs during tests
  silent: config.isTest,
});
