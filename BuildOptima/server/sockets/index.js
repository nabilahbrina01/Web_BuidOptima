const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mqttClient = require('../mqtt/client');
const { SOCKET_EVENTS, JWT_SECRET } = require('../config/constants');

let io = null;

/**
 * Initialize Socket.IO on the HTTP server.
 * Must be called once from server.js before any service uses getIo().
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      socket.data.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // Dashboard yang baru connect langsung tahu status broker MQTT saat ini
    socket.emit(SOCKET_EVENTS.MQTT_STATUS, { connected: mqttClient.isConnected() });

    // Client can join room-specific channel for targeted updates
    socket.on('join:room', (roomId) => {
      socket.join(`room:${roomId}`);
      console.log(`[SOCKET] ${socket.id} joined room:${roomId}`);
    });

    socket.on('leave:room', (roomId) => {
      socket.leave(`room:${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[SOCKET] Socket.IO initialized');
  return io;
};

/**
 * Returns the active io instance.
 * Throws if initSocket() has not been called yet.
 */
const getIo = () => {
  if (!io) throw new Error('Socket.IO not initialized. Call initSocket(server) first.');
  return io;
};

module.exports = { initSocket, getIo };
