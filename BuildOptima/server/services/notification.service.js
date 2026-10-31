const prisma = require('../config/prisma');
const emailNotifier = require('./emailNotifier.service');
const { getIo }         = require('../sockets');
const { SOCKET_EVENTS } = require('../config/constants');

const TYPE_TO_UI = {
  system:           'info',
  device_offline:   'danger',
  energy_anomaly:   'warn',
  occupancy_alert:  'success',
};

const SUMMARY_MAX = 90;
const enrichNotification = (n) => ({
  ...n,
  type: TYPE_TO_UI[n.type] || 'info',
  summary: n.message && n.message.length > SUMMARY_MAX ? `${n.message.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : n.message,
  detail: n.message,
});

const getAll = async ({ unreadOnly } = {}) => {
  const where = unreadOnly === 'true' ? { is_read: false } : {};
  const notifs = await prisma.notification.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 100,
  });
  return notifs.map(enrichNotification);
};

/**
 * @param {string} [dedupeKey] kunci sumber notifikasi (mis. "device_offline:12") — dipakai pembatas email
 *                             agar kejadian yang sama tidak mengirim email berulang dalam waktu singkat.
 */
const create = async ({ title, message, type = 'system', dedupeKey }) => {
  const notif = await prisma.notification.create({
    data: { title, message, type },
  });

  const enriched = enrichNotification(notif);
  try { getIo().emit(SOCKET_EVENTS.NOTIFICATION, enriched); } catch {}

  emailNotifier
    .notify({ type, title, message, created_at: notif.created_at }, { dedupeKey })
    .catch((err) => console.warn('[MAIL] Notifikasi email gagal:', err.message));

  return enriched;
};

const markRead = async (id) => {
  const updated = await prisma.notification.update({
    where: { id: parseInt(id, 10) },
    data: { is_read: true },
  });
  return enrichNotification(updated);
};

const markAllRead = async () => {
  return prisma.notification.updateMany({
    where: { is_read: false },
    data: { is_read: true },
  });
};

const remove = async (id) => {
  await prisma.notification.delete({ where: { id: parseInt(id, 10) } });
};

module.exports = { getAll, create, markRead, markAllRead, remove, TYPE_TO_UI };