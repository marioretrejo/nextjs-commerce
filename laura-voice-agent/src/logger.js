import winston from 'winston';
import { mkdirSync } from 'fs';

mkdirSync('./logs', { recursive: true });

const { combine, timestamp, printf } = winston.format;

const logFormat = printf(({ level, message, timestamp, module }) => {
  return `[${timestamp}] [${level.toUpperCase().padEnd(5)}] [${(module || 'SYSTEM').padEnd(16)}] ${message}`;
});

const winstonLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

export function getLogger(module) {
  return {
    info:  (msg) => winstonLogger.info(msg,  { module }),
    warn:  (msg) => winstonLogger.warn(msg,  { module }),
    error: (msg) => winstonLogger.error(msg, { module }),
  };
}

export default winstonLogger;
