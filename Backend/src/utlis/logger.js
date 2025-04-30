/**
 * Logger utility module for SGBIT ERP Application
 * Handles various logging needs throughout the application
 * @module utils/logger
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Handle __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create logs directory if it doesn't exist
 */
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/**
 * Define log file paths
 */
const errorLogPath = path.join(logDir, 'error.log');
const combinedLogPath = path.join(logDir, 'combined.log');
const exceptionLogPath = path.join(logDir, 'exceptions.log');

/**
 * Custom format for console output
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

/**
 * Custom format for file output
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Create logger instance
 */
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'sgbit-erp' },
  transports: [
    new winston.transports.File({
      filename: errorLogPath,
      level: 'error',
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: combinedLogPath,
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test',
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: exceptionLogPath,
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test',
    })
  ],
  exitOnError: false
});

/**
 * Custom logger helpers
 */
logger.database = function(message) {
  this.info(`[DATABASE] ${message}`);
};

logger.api = function(message) {
  this.info(`[API] ${message}`);
};

logger.security = function(message) {
  this.warn(`[SECURITY] ${message}`);
};

logger.audit = function(userId, action, details) {
  this.info({
    message: `[AUDIT] User ${userId} performed ${action}`,
    userId,
    action,
    details,
    timestamp: new Date().toISOString()
  });
};

logger.http = function(req, res, responseTime) {
  const { method, url, ip } = req;
  const status = res.statusCode;

  const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

  this[logLevel]({
    message: `HTTP ${method} ${url} ${status} ${responseTime}ms`,
    method,
    url,
    status,
    responseTime,
    ip,
    userAgent: req.headers['user-agent'] || '',
    timestamp: new Date().toISOString()
  });
};

if (process.env.NODE_ENV !== 'production') {
  logger.mongooseDebug = function(collectionName, method, query, doc) {
    this.debug(`[MONGOOSE] ${collectionName}.${method} ${JSON.stringify(query)} ${doc ? JSON.stringify(doc) : ''}`);
  };
}

// Export the logger
export default logger;
