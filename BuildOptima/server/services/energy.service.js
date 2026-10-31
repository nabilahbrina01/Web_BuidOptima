const prisma  = require('../config/prisma');
const dayjs   = require('dayjs');
const { ELECTRICITY_RATE_IDR } = require('../config/constants');
const notificationService      = require('./notification.service');
const { getIo }                = require('../sockets');
const { SOCKET_EVENTS }        = require('../config/constants');

// Anomaly threshold: spike > 3× average of last 10 readings
const ANOMALY_MULTIPLIER = 3;

/**
 * Store an energy reading.  estimated_cost is calculated automatically.
 */
const logEnergy = async ({ roomId, voltage, current, power, energy_kwh }) => {
  const estimated_cost = parseFloat(energy_kwh) * ELECTRICITY_RATE_IDR;

  const record = await prisma.energyLog.create({
    data: {
      room_id: parseInt(roomId, 10),
      voltage:        parseFloat(voltage),
      current:        parseFloat(current),
      power:          parseFloat(power),
      energy_kwh:     parseFloat(energy_kwh),
      estimated_cost,
    },
  });

  // Broadcast to dashboard
  try { getIo().emit(SOCKET_EVENTS.ENERGY_DATA, record); } catch {}

  // Anomaly detection
  await detectAnomaly(roomId, parseFloat(power));

  return record;
};

const detectAnomaly = async (roomId, currentPower) => {
  const recent = await prisma.energyLog.findMany({
    where: { room_id: parseInt(roomId, 10) },
    orderBy: { recorded_at: 'desc' },
    take: 10,
    select: { power: true },
  });

  if (recent.length < 5) return; // need enough data

  const avg = recent.reduce((s, r) => s + parseFloat(r.power), 0) / recent.length;

  if (currentPower > avg * ANOMALY_MULTIPLIER) {
    const room = await prisma.room.findUnique({ where: { id: parseInt(roomId, 10) }, select: { room_code: true } });
    await notificationService.create({
      title: 'Lonjakan Daya Terdeteksi',
      message: `Ruangan ${room?.room_code ?? `ID ${roomId}`}: daya melonjak ke ${currentPower.toFixed(1)} W (rata-rata ${avg.toFixed(1)} W).`,
      type: 'energy_anomaly',
      dedupeKey: `energy_anomaly:room:${roomId}`,
    });
  }
};

const getLatest = async ({ roomId } = {}) => {
  const where = roomId ? { room_id: parseInt(roomId, 10) } : {};
  return prisma.energyLog.findMany({
    where,
    orderBy: { recorded_at: 'desc' },
    take: 100,
    include: { room: { select: { room_code: true, room_name: true } } },
  });
};

/**
 * Aggregate analytics by period.
 * @param {string} period - 'daily' | 'weekly' | 'monthly'
 * @param {number} roomId  - optional
 */
const getAnalytics = async ({ period = 'daily', roomId } = {}) => {
  const periodMap = { daily: 1, weekly: 7, monthly: 30 };
  const days      = periodMap[period] || 1;
  const since     = dayjs().subtract(days, 'day').toDate();

  const where = { recorded_at: { gte: since } };
  if (roomId) where.room_id = parseInt(roomId, 10);

  const logs = await prisma.energyLog.findMany({
    where,
    include: { room: { select: { room_code: true, room_name: true } } },
    orderBy: { recorded_at: 'asc' },
  });

  // Aggregate totals
  const totalKwh  = logs.reduce((s, l) => s + parseFloat(l.energy_kwh), 0);
  const totalCost = logs.reduce((s, l) => s + parseFloat(l.estimated_cost), 0);
  const avgPower  = logs.length ? logs.reduce((s, l) => s + parseFloat(l.power), 0) / logs.length : 0;

  return { period, totalKwh, totalCost, avgPower, count: logs.length, logs };
};

/**
 * Today's energy totals vs yesterday/month, for the dashboard summary widget.
 */
const getTodaySummary = async () => {
  const startOfToday     = dayjs().startOf('day').toDate();
  const startOfYesterday = dayjs().subtract(1, 'day').startOf('day').toDate();
  const startOfMonth     = dayjs().startOf('month').toDate();

  const [todayLogs, yesterdayLogs, monthLogs] = await Promise.all([
    prisma.energyLog.findMany({ where: { recorded_at: { gte: startOfToday } } }),
    prisma.energyLog.findMany({ where: { recorded_at: { gte: startOfYesterday, lt: startOfToday } } }),
    prisma.energyLog.findMany({ where: { recorded_at: { gte: startOfMonth } } }),
  ]);

  const sum = (logs, field) => logs.reduce((s, l) => s + parseFloat(l[field]), 0);

  const todayKwh     = sum(todayLogs, 'energy_kwh');
  const yesterdayKwh = sum(yesterdayLogs, 'energy_kwh');
  const monthKwh     = sum(monthLogs, 'energy_kwh');
  const biayaToday   = sum(todayLogs, 'estimated_cost');

  const daysSoFarInMonth   = dayjs().date();
  const projectedMonthKwh  = daysSoFarInMonth > 0 ? (monthKwh / daysSoFarInMonth) * dayjs().daysInMonth() : 0;
  const biayaMonthEstimate = projectedMonthKwh * ELECTRICITY_RATE_IDR;

  const efficiencyPct = yesterdayKwh > 0
    ? Math.round(((yesterdayKwh - todayKwh) / yesterdayKwh) * 100)
    : 0;

  const r2 = (n) => Math.round(n * 100) / 100;

  return {
    todayKwh:     r2(todayKwh),
    yesterdayKwh: r2(yesterdayKwh),
    monthKwh:     r2(monthKwh),
    efficiencyPct,
    biayaToday:         Math.round(biayaToday),
    biayaMonthEstimate: Math.round(biayaMonthEstimate),
    tarif: ELECTRICITY_RATE_IDR,
  };
};

/**
 * Time-bucketed series for charts: daily -> hourly buckets (00-23),
 * weekly -> Mon..Sun, monthly -> Jan..Dec (this year), yearly -> last 5 years.
 */
const getTimeline = async ({ period = 'daily', roomId } = {}) => {
  const now = dayjs();
  let since, labels, bucketFn;

  if (period === 'weekly') {
    since = now.subtract(6, 'day').startOf('day');
    labels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    bucketFn = (d) => (dayjs(d).day() + 6) % 7; // day(): Sun=0..Sat=6 -> Mon=0..Sun=6
  } else if (period === 'monthly') {
    since = now.startOf('year');
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    bucketFn = (d) => dayjs(d).month();
  } else if (period === 'yearly') {
    since = now.subtract(4, 'year').startOf('year');
    const startYear = now.year() - 4;
    labels = Array.from({ length: 5 }, (_, i) => String(startYear + i));
    bucketFn = (d) => dayjs(d).year() - startYear;
  } else {
    // daily -> hourly buckets for today
    since = now.startOf('day');
    labels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    bucketFn = (d) => dayjs(d).hour();
  }

  const where = { recorded_at: { gte: since.toDate() } };
  if (roomId) where.room_id = parseInt(roomId, 10);

  const logs = await prisma.energyLog.findMany({ where, select: { energy_kwh: true, recorded_at: true } });

  const vals = labels.map(() => 0);
  for (const log of logs) {
    const idx = bucketFn(log.recorded_at);
    if (idx >= 0 && idx < vals.length) vals[idx] += parseFloat(log.energy_kwh);
  }

  return { period, labels, vals: vals.map((v) => Math.round(v * 100) / 100), unit: 'kWh', tarif: ELECTRICITY_RATE_IDR };
};

/**
 * Total kWh per room this month, for the Reports page's "Konsumsi per Ruangan" bar list.
 * NOTE: `room_id` here deliberately holds the room's display code (e.g. "R101"), not the
 * numeric database id — this endpoint's only consumer renders it directly as a label.
 */
const getPerRoom = async ({ period } = {}) => {
  // Rentang waktu sama dengan getTimeline supaya angka per-ruangan konsisten dengan tab laporan yang dipilih.
  // Tanpa `period` = bulan ini (perilaku lama, dipakai halaman Energi).
  const now = dayjs();
  const startOfMonth =
    period === 'weekly'  ? now.subtract(6, 'day').startOf('day').toDate()
    : period === 'monthly' ? now.startOf('year').toDate()
    : period === 'yearly'  ? now.subtract(4, 'year').startOf('year').toDate()
    : now.startOf('month').toDate();
  const rooms = await prisma.room.findMany({ select: { id: true, room_code: true } });

  const logs = await prisma.energyLog.groupBy({
    by: ['room_id'],
    where: { recorded_at: { gte: startOfMonth } },
    _sum: { energy_kwh: true },
  });

  const totals = new Map(logs.map(l => [l.room_id, parseFloat(l._sum.energy_kwh || 0)]));

  return rooms
    .map(r => ({ room_id: r.room_code, total: Math.round((totals.get(r.id) || 0) * 100) / 100 }))
    .filter(r => r.total > 0);
};

module.exports = { logEnergy, getLatest, getAnalytics, getTodaySummary, getTimeline, getPerRoom };
