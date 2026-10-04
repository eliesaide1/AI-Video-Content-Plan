import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { apiRouter } from './controller/index.js';
import { config, isProduction } from './infrastructure/config.js';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/mongoConnection.js';
import { syncModelIndexes } from './infrastructure/database/indexManager.js';
import { createLogger } from './infrastructure/logger.js';
import { realtime } from './infrastructure/realtime/RealtimeGateway.js';
import { errorHandler, notFoundHandler, requestContext } from './middleware/index.js';

const log = createLogger('server');

/**
 * CORS: the configured origins always pass. In development any localhost port
 * is also allowed, because Vite silently moves to 5174+ when 5173 is taken.
 */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / curl / server-to-server
  if (config.corsOrigin.includes(origin)) return true;
  if (!isProduction && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
  return false;
}

function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) =>
        isAllowedOrigin(origin)
          ? callback(null, true)
          : callback(new Error(`Origin ${origin} is not allowed by CORS`)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(requestContext);

  app.use('/api', apiRouter);

  // 404 -> global error handler. Must be registered after all routes.
  app.use(notFoundHandler);
  // GLOBAL ERROR HANDLER — the last middleware, as Express requires.
  app.use(errorHandler);

  return app;
}

async function start() {
  await connectDatabase();
  await syncModelIndexes();

  const app = createApp();
  const httpServer = http.createServer(app);
  realtime.attach(httpServer);

  httpServer.listen(config.port, () => {
    log.info(`API listening on http://localhost:${config.port}/api`);
    log.info(`socket.io listening on http://localhost:${config.port}/realtime`);
    log.info(`generated content root: ${config.storage.generatedRoot}`);
  });

  const shutdown = async (signal: string) => {
    log.info(`${signal} received — shutting down`);
    httpServer.close();
    await realtime.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => log.error('unhandled rejection', reason));
  process.on('uncaughtException', (error) => log.error('uncaught exception', error));
}

start().catch((error) => {
  log.error('failed to start the server', error);
  process.exit(1);
});
