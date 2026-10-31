require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { apiLimiter } = require('./middleware/rateLimit.middleware');

const app = express();

if (process.env.TRUST_PROXY) {
  const n = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isFinite(n) ? n : process.env.TRUST_PROXY);
}
app.disable('x-powered-by');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

// ─── BODY PARSERS ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' })); // foto profil dikirim sebagai data-URL
app.use(express.urlencoded({ extended: true }));

// ─── STATIC ───────────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'BuildOptima API' }));

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/rooms',        require('./routes/room.routes'));
app.use('/api/schedules',    require('./routes/schedule.routes'));
app.use('/api/devices',      require('./routes/device.routes'));
app.use('/api/sensors',      require('./routes/sensor.routes'));
app.use('/api/energy',       require('./routes/energy.routes'));
app.use('/api/assets',       require('./routes/asset.routes'));
app.use('/api/notifications',require('./routes/notification.routes'));
app.use('/api/ai-verification', require('./routes/aiVerification.routes'));
app.use('/api/automation',   require('./routes/automation.routes'));
app.use('/api/dashboard',    require('./routes/dashboard.routes'));

// ── Aliases added to match the frontend's expected contract ──────────────────
app.use('/api/users',        require('./routes/user.routes'));
app.use('/api/inventory',    require('./routes/inventory.routes'));   // = /api/assets + health/scan
app.use('/api/alerts',       require('./routes/alert.routes'));       // = /api/notifications (PATCH)
app.use('/api/reports',      require('./routes/reports.routes'));

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);

  if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Invalid JSON body' });
  if (err.name === 'MulterError') return res.status(400).json({ success: false, message: err.message });
  if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Data already exists' });
  if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Record not found' });

  const status = err.status || err.statusCode;
  if (status && status < 500) return res.status(status).json({ success: false, message: err.message });
  if (status) return res.status(status).json({ success: false, message: err.message || 'Server error' }); // 502/503 buatan sendiri
  return res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;