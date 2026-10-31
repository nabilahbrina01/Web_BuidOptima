const dayjs = require('dayjs');
require('dayjs/locale/id');
const prisma = require('../config/prisma');
const mailer = require('../utils/mailer');

const OPEN = ['pending', 'in_progress'];
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Menyusun data laporan harian: ringkasan KEMARIN (energi) + kondisi saat ini (peringatan 24 jam,
 * perangkat offline, aset, perawatan). Angka energi memakai sumber yang sama dengan dashboard.
 */
const build = async (now = new Date()) => {
  const today0 = dayjs(now).startOf('day');
  const y0 = today0.subtract(1, 'day');
  const d0 = today0.subtract(2, 'day');

  const [yLogs, prevLogs, notifs, offline, attention, critical, open, overdue] = await Promise.all([
    prisma.energyLog.findMany({ where: { recorded_at: { gte: y0.toDate(), lt: today0.toDate() } }, select: { room_id: true, energy_kwh: true, estimated_cost: true } }),
    prisma.energyLog.findMany({ where: { recorded_at: { gte: d0.toDate(), lt: y0.toDate() } }, select: { energy_kwh: true } }),
    prisma.notification.findMany({ where: { created_at: { gte: dayjs(now).subtract(24, 'hour').toDate() } }, select: { type: true } }),
    prisma.device.count({ where: { status: 'offline' } }),
    prisma.asset.count({ where: { condition_status: { not: 'Baik' } } }),
    prisma.asset.count({ where: { condition_status: 'Rusak' } }),
    prisma.maintenanceLog.count({ where: { status: { in: OPEN } } }),
    prisma.maintenanceLog.count({ where: { status: { in: OPEN }, scheduled_date: { lt: today0.toDate() } } }),
  ]);

  const kwh = round2(yLogs.reduce((s, l) => s + parseFloat(l.energy_kwh), 0));
  const cost = Math.round(yLogs.reduce((s, l) => s + parseFloat(l.estimated_cost), 0));
  const prevKwh = prevLogs.reduce((s, l) => s + parseFloat(l.energy_kwh), 0);
  const changePct = prevKwh > 0 ? Math.round(((kwh - prevKwh) / prevKwh) * 100) : null;

  // ruangan terboros kemarin
  const perRoom = new Map();
  yLogs.forEach((l) => perRoom.set(l.room_id, (perRoom.get(l.room_id) || 0) + parseFloat(l.energy_kwh)));
  let topRoom = null;
  if (perRoom.size) {
    const [roomId, roomKwh] = [...perRoom.entries()].sort((a, b) => b[1] - a[1])[0];
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { room_code: true } });
    topRoom = { code: room?.room_code || `ID ${roomId}`, kwh: round2(roomKwh), share: kwh > 0 ? Math.round((roomKwh / kwh) * 100) : 0 };
  }

  return {
    dateLabel: y0.locale('id').format('dddd, D MMMM YYYY'),
    energy: { kwh, cost, prevKwh: round2(prevKwh), changePct, topRoom },
    alerts: {
      total: notifs.length,
      danger: notifs.filter((n) => n.type === 'device_offline').length,
      warn: notifs.filter((n) => n.type === 'energy_anomaly').length,
    },
    devices: { offline },
    assets: { attention, critical },
    maintenance: { open, overdue },
  };
};

// ─── PENJADWALAN ──────────────────────────────────────────────────────────────
const dailyTime = () => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(process.env.DAILY_REPORT_TIME || '07:00').trim());
  const h = m ? parseInt(m[1], 10) : 7; const min = m ? parseInt(m[2], 10) : 0;
  return h < 24 && min < 60 ? { h, min } : { h: 7, min: 0 };
};
const catchupMs = () => {
  const n = parseInt(process.env.DAILY_REPORT_CATCHUP_HOURS, 10);
  return (Number.isFinite(n) && n >= 0 ? n : 3) * 3600 * 1000;
};

const enabled = () => process.env.ENABLE_DAILY_REPORT !== 'false' && mailer.isConfigured();

/**
 * Kirim laporan harian ke user (notif_daily = true, email terverifikasi) yang belum menerimanya HARI INI,
 * bila waktu sekarang berada pada jendela [DAILY_REPORT_TIME, +DAILY_REPORT_CATCHUP_HOURS jam].
 * Penanda daily_report_sent_at di database mencegah kirim ganda (mis. server restart di jam yang sama).
 */
const runIfDue = async (now = new Date()) => {
  if (!enabled()) return { sent: 0, reason: 'disabled' };
  const { h, min } = dailyTime();
  const start = dayjs(now).startOf('day').hour(h).minute(min);
  if (dayjs(now).isBefore(start) || dayjs(now).valueOf() >= start.valueOf() + catchupMs()) return { sent: 0, reason: 'not-due' };

  const today0 = dayjs(now).startOf('day').toDate();
  const users = await prisma.user.findMany({
    where: { notif_daily: true, email_verified: true, OR: [{ daily_report_sent_at: null }, { daily_report_sent_at: { lt: today0 } }] },
    select: { id: true, email: true },
  });
  if (!users.length) return { sent: 0, reason: 'no-recipients' };

  const report = await build(now);
  let sent = 0;
  for (const u of users) {
    try {
      await mailer.sendDailyReportEmail(u.email, report);
      await prisma.user.update({ where: { id: u.id }, data: { daily_report_sent_at: new Date(now) } });
      sent += 1;
    } catch (err) {
      console.warn(`[MAIL] Gagal kirim laporan harian ke user ${u.id}: ${err.message}`);
    }
  }
  console.log(`[REPORT] Laporan harian terkirim ke ${sent}/${users.length} pengguna`);
  return { sent };
};

let timer = null;
const start = () => {
  if (timer) return;
  if (!enabled()) { console.log('[REPORT] Laporan harian nonaktif (SMTP belum diisi atau ENABLE_DAILY_REPORT=false)'); return; }
  const { h, min } = dailyTime();
  console.log(`[REPORT] Laporan harian dijadwalkan pukul ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  timer = setInterval(() => runIfDue().catch((e) => console.warn('[REPORT] Gagal:', e.message)), 60 * 1000);
  if (timer.unref) timer.unref();
};
const stop = () => { if (timer) clearInterval(timer); timer = null; };

module.exports = { build, runIfDue, start, stop };