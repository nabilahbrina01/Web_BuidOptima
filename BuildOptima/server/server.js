require('dotenv').config();

// Jadwal & status ruangan dihitung dengan jam server; UI menampilkan WIB.
process.env.TZ = process.env.TZ || 'Asia/Jakarta';

const http = require('http');
const app  = require('./app');
const { initSocket } = require('./sockets');
const { initMqtt }   = require('./mqtt');
const { startSimulators } = require('./simulators');
const deviceHealthChecker = require('./utils/deviceHealthChecker');
const dailyReport = require('./services/dailyReport.service');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
initSocket(server);

// ─── MQTT ─────────────────────────────────────────────────────────────────────
initMqtt();

// ─── OPTIONAL SIMULATORS ──────────────────────────────────────────────────────
if (process.env.ENABLE_SIMULATORS === 'true') {
  startSimulators();
}

// ─── START ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('[DB] Prisma connected to MySQL');

    server.listen(PORT, () => {
      console.log(`[SERVER] BuildOptima API running on port ${PORT}`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
      deviceHealthChecker.start();
      dailyReport.start();
    });
  } catch (err) {
    console.error('[SERVER] Startup error:', err);
    process.exit(1);
  }
}

start();

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function shutdown(signal) {
  console.log(`\n[SERVER] Received ${signal}. Shutting down gracefully…`);
  deviceHealthChecker.stop();
  dailyReport.stop();
  await prisma.$disconnect();
  server.close(() => {
    console.log('[SERVER] HTTP server closed.');
    process.exit(0);
  });
}
