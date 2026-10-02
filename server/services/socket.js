// Socket.io for real-time notifications. Each logged-in user joins a private room.
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer, corsOrigin) {
  io = new Server(httpServer, { cors: { origin: corsOrigin } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('unauthorized'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.id);
      next();
    } catch (e) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
  });

  return io;
}

function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${String(userId)}`).emit(event, payload);
}

module.exports = { initSocket, emitToUser };
