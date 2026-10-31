const notifService = require('../services/notification.service');

const prisma = require('../config/prisma');
const mailer = require('../utils/mailer');
const dailyReport = require('../services/dailyReport.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getAll     = asyncHandler(async (req, res) => res.json({ success: true, data: await notifService.getAll(req.query) }));
const markRead   = asyncHandler(async (req, res) => res.json({ success: true, data: await notifService.markRead(req.params.id) }));
const markAll    = asyncHandler(async (req, res) => { await notifService.markAllRead(); res.json({ success: true }); });
const remove     = asyncHandler(async (req, res) => { await notifService.remove(req.params.id); res.json({ success: true }); });

// Kirim email CONTOH ke alamat email akun yang sedang login (untuk memastikan SMTP & preferensi bekerja).
const testEmail = asyncHandler(async (req, res) => {
  const kind = req.body?.kind;
  if (!['alert', 'daily'].includes(kind)) throw { status: 400, message: 'kind must be "alert" or "daily"' };
  if (!mailer.isConfigured()) throw { status: 503, message: 'Email (SMTP) is not configured on the server' };

  const user = await prisma.user.findUnique({ where: { id: parseInt(req.user.id, 10) }, select: { email: true } });
  if (!user) throw { status: 404, message: 'User not found' };

  try {
    if (kind === 'alert') {
      await mailer.sendAlertEmail(user.email, {
        type: 'energy_anomaly',
        title: 'Contoh: Lonjakan Daya Terdeteksi',
        message: 'Ruangan R-101: daya melonjak ke 1850.0 W (rata-rata 620.0 W). Ini hanya contoh dari tombol tes.',
        created_at: new Date(),
      }, { test: true });
    } else {
      await mailer.sendDailyReportEmail(user.email, await dailyReport.build(new Date()), { test: true });
    }
  } catch (err) {
    console.error('[MAIL] Email tes gagal:', err.message);
    throw { status: 502, message: 'Failed to send test email. Check the SMTP settings on the server.' };
  }
  res.json({ success: true, message: 'Test email sent', data: { to: user.email } });
});

module.exports = { getAll, markRead, markAll, remove, testEmail };