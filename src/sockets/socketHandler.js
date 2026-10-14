import logger from '../utils/logger.js';
import { config } from '../../config.js';
import jwt from 'jsonwebtoken';

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    // Join specific order room (Public for checkout customer session)
    socket.on('join_order', (orderCode) => {
      if (orderCode && typeof orderCode === 'string') {
        const cleanCode = orderCode.trim();
        socket.join(`order_${cleanCode}`);
        logger.debug(`Socket ${socket.id} joined room order_${cleanCode}`);
      }
    });

    // Join admin dashboard room (Requires Valid Admin Secret Key)
    socket.on('join_admin', (data) => {
      const providedKey = (typeof data === 'object' ? (data?.adminKey || data?.adminSecret) : data) || socket.handshake.auth?.adminKey;
      if (config.adminSecret && providedKey === config.adminSecret) {
        socket.join('admin_room');
        logger.debug(`Socket ${socket.id} authenticated and joined room admin_room`);
      } else {
        logger.warn(`Socket ${socket.id} failed admin authentication for admin_room`);
        socket.emit('error', { message: 'Unauthorized: Invalid admin credentials' });
      }
    });

    // Join user room for real-time plan activation and user events (Requires Valid JWT Token)
    socket.on('join_user', (data) => {
      try {
        let email = typeof data === 'string' ? data : data?.email;
        const token = (typeof data === 'object' ? data?.token : null) || socket.handshake.auth?.token;

        if (token) {
          try {
            const decoded = jwt.verify(token, config.jwtSecret);
            if (decoded && decoded.email) {
              email = decoded.email;
            }
          } catch (_) {
            return socket.emit('error', { message: 'Invalid or expired user session token' });
          }
        }

        if (email) {
          const cleanEmail = email.trim().toLowerCase();
          socket.join(`user_${cleanEmail}`);
          logger.debug(`Socket ${socket.id} joined room user_${cleanEmail}`);
        }
      } catch (err) {
        logger.warn(`[Socket] join_user error: ${err.message}`);
      }
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });
}

export default setupSocketHandlers;
