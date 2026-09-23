import logger from '../utils/logger.js';

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    // Join specific order room
    socket.on('join_order', (orderCode) => {
      socket.join(`order_${orderCode}`);
      logger.debug(`Socket ${socket.id} joined room order_${orderCode}`);
    });

    // Join admin dashboard room
    socket.on('join_admin', () => {
      socket.join('admin_room');
      logger.debug(`Socket ${socket.id} joined room admin_room`);
    });

    // Join user room for real-time plan activation and user events
    socket.on('join_user', (email) => {
      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        socket.join(`user_${cleanEmail}`);
        logger.debug(`Socket ${socket.id} joined room user_${cleanEmail}`);
      }
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });
}

export default setupSocketHandlers;
