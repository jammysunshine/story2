const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // In GCloud/Production, we log raw JSON to stdout. 
  // In development, we use pino-pretty for human-readable logs.
  transport: isProduction ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'MM-dd HH:mm:ss.l',
    },
  },
});

module.exports = logger;
