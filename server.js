import { CloudSyncService } from './src/services/cloudSync.service.js';
import http from 'http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { initDatabase, closeDatabase } from './db/database.js';
import { createApp } from './src/app.js';
import { setupSocketHandlers } from './src/sockets/socketHandler.js';
import { startExpiryCleaner, stopExpiryCleaner } from './src/jobs/expiryCleaner.job.js';
import { SettingModel } from './src/models/setting.model.js';
import { setSocketIO } from './src/services/matchingEngine.service.js';
import { syncPaymentMonitoring, stopImapListener, stopMerchantImapPoller } from './src/services/imapListener.service.js';
import { stopGmailWatcher } from './services/gmailWatcher.service.js';
import logger from './src/utils/logger.js';

// Global error handlers for uncaught process exceptions
process.on('uncaughtException', (err) => {
  logger.error(`[Process Uncaught Exception]: ${err.message}`, { stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error(`[Process Unhandled Rejection]: ${reason}`);
});

let server = null;
let io = null;

async function bootstrap() {
  logger.info('Initializing Personal UPI Payment Gateway backend...');

  // 1. Initialize SQLite Database tables
  await initDatabase();

  // 2. Hydrate dynamic settings from database into config
  await SettingModel.hydrateConfig(config);

  // 3. Create Express Application
  const app = createApp();

  // 4. Create HTTP Server from Express Application
  server = http.createServer(app);

  // 5. Attach Socket.IO to HTTP Server
  io = new Server(server, {
    cors: {
      origin: [
        'https://freefireofficial.in',
        'https://www.freefireofficial.in',
        'https://dealsbyshiv.web.app',
        'https://dealsbyshiv.firebaseapp.com',
        'https://ff-store-4a61e.web.app',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000'
      ],
      credentials: true
    }
  });
  app.set('io', io);

  // 6. Setup WebSockets & Matching Engine context
  setupSocketHandlers(io);
  setSocketIO(io);

  // 7. Schedule Background Jobs (Expired orders cleanup every 30s)
  startExpiryCleaner(io, 30000);

  // 7. Start listening on configured port (and secondary port for cloud PaaS proxy compatibility)
  const primaryPort = parseInt(process.env.PORT, 10) || config.port || 10000;
  const secondaryPort = primaryPort === 10000 ? 3000 : 10000;

  server.listen(primaryPort, '0.0.0.0', async () => {
    logger.info('======================================================');
    logger.info(`🚀 Personal UPI Gateway live on: http://localhost:${primaryPort} (and secondary: ${secondaryPort})`);
    logger.info(`📱 Admin Dashboard:            http://localhost:${primaryPort}/admin`);
    logger.info(`🩺 Health Check:                http://localhost:${primaryPort}/health`);
    logger.info(`💳 Configured UPI VPA:          ${config.merchant.upiVpa || 'NOT CONFIGURED'} (${config.merchant.name})`);
    logger.info(`📧 IMAP Realtime Alert Engine:  ${config.imap.enabled ? 'ACTIVE' : 'STANDBY'}`);
    logger.info(`🔐 Admin Master Auth:           ${config.adminSecret ? 'CONFIGURED' : 'NOT SET (SET IN .ENV)'}`);
    logger.info('======================================================');

    // 8. Start email monitoring only when a pending order exists. This also
    // restores monitoring after a process restart if orders are still active.
    await syncPaymentMonitoring(io);
  });

  try {
    const secondaryServer = http.createServer(app);
    if (io) {
      io.attach(secondaryServer);
    }
    secondaryServer.listen(secondaryPort, '0.0.0.0', () => {
      logger.info(`🚀 Dual-port bridge active on: http://localhost:${secondaryPort}`);
    });
    secondaryServer.on('error', (e) => {
      logger.warn(`[SecondaryServer] Port ${secondaryPort} not bound: ${e.message}`);
    });
  } catch (_) {}
}

// Graceful Shutdown Logic
async function handleShutdown(signal) {
  logger.info(`Received ${signal}. Gracefully terminating backend services...`);

  // Stop background jobs
  stopExpiryCleaner();
  stopGmailWatcher();
  stopMerchantImapPoller();

  // Stop IMAP connection
  try {
    await stopImapListener();
  } catch (err) {
    logger.warn(`Error during IMAP shutdown: ${err.message}`);
  }

  // Close HTTP & WebSocket server
  if (server) {
    server.close(() => {
      logger.info('HTTP & WebSocket server closed.');
    });
  }

  // Close database connection
  try {
    await closeDatabase();
    logger.info('SQLite database closed.');
  } catch (err) {
    logger.warn(`Error closing database: ${err.message}`);
  }

  setTimeout(() => {
    logger.info('Backend shutdown complete.');
    process.exit(0);
  }, 500);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Start the backend service
bootstrap().catch((err) => {
  logger.error(`[Startup Fatal Error]: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
