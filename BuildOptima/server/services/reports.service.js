const prisma = require('../config/prisma');
const dayjs  = require('dayjs');
const notificationService = require('./notification.service');
const assetService = require('./asset.service');
const { TYPE_TO_UI } = notificationService;

/**
 * Count this month's notifications grouped into the same 4 UI categories used
 * on the Notifikasi page (info/warn/danger/success).
 */
const getAlertSummary = async () => {
  const startOfMonth = dayjs().startOf('month').toDate();
  const notifs = await prisma.notification.findMany({
    where: { created_at: { gte: startOfMonth } },
    select: { type: true },
  });

  const summary = { danger: 0, warn: 0, info: 0, success: 0 };
  for (const n of notifs) {
    const uiType = TYPE_TO_UI[n.type] || 'info';
    summary[uiType] = (summary[uiType] || 0) + 1;
  }
  return summary;
};

const OPEN_STATUSES = ['pending', 'in_progress'];
const ALLOWED_NEXT = {
  pending:     ['pending', 'in_progress', 'done', 'cancelled'],
  in_progress: ['in_progress', 'pending', 'done', 'cancelled'],
  done:        [],
  cancelled:   [],
};
const CONDITIONS = ['Baik', 'Ada Yang Rusak', 'Rusak'];

const roomLabels = async (logs) => {
  const ids = [...new Set(logs.map((l) => l.room_id).filter(Boolean))];
  if (!ids.length) return new Map();
  const rooms = await prisma.room.findMany({ where: { id: { in: ids } }, select: { id: true, room_code: true } });
  return new Map(rooms.map((r) => [r.id, r.room_code]));
};

// Frontend menampilkan `room_id` langsung sebagai label, jadi diganti kode ruangan.
const withRoomLabel = (log, map) => ({ ...log, room_id: log.room_id ? map.get(log.room_id) ?? null : null });

const getMaintenanceHistory = async () => {
  const logs = await prisma.maintenanceLog.findMany({ orderBy: { performed_at: 'desc' }, take: 200 });
  const map = await roomLabels(logs);
  const when = (l) => new Date(l.scheduled_date || l.performed_at).getTime();
  return logs
    .map((l) => withRoomLabel(l, map))
    // pekerjaan yang masih terbuka tampil paling atas (yang paling dekat jadwalnya dulu), sisanya terbaru dulu
    .sort((a, b) => {
      const ao = OPEN_STATUSES.includes(a.status), bo = OPEN_STATUSES.includes(b.status);
      if (ao !== bo) return ao ? -1 : 1;
      return ao ? when(a) - when(b) : when(b) - when(a);
    })
    .slice(0, 100);
};

const actorName = async (actor = {}) => {
  if (!actor.id) return null;
  const u = await prisma.user.findUnique({ where: { id: parseInt(actor.id, 10) }, select: { name: true, username: true } });
  return u ? (u.name || u.username) : null;
};

const parseDate = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw { status: 422, message: 'Invalid date' };
  return d;
};

/**
 * Dipanggil tombol "+ Jadwalkan" di panel AI Predictive Maintenance (halaman Inventaris).
 * Membuat pekerjaan perawatan berstatus pending (Terjadwal). Satu aset hanya boleh punya satu
 * pekerjaan yang masih terbuka, supaya klik berulang tidak membuat duplikat.
 */
const createMaintenance = async ({ asset_id, activity, scheduled_date, technician, notes }, actor = {}) => {
  const asset = await prisma.asset.findUnique({
    where: { id: parseInt(asset_id, 10) },
    include: { room: { select: { room_code: true } } },
  });
  if (!asset) throw { status: 404, message: 'Asset not found' };

  const open = await prisma.maintenanceLog.findFirst({ where: { asset_id: asset.id, status: { in: OPEN_STATUSES } } });
  if (open) throw { status: 409, message: 'Maintenance job for this asset is already open' };

  // Rusak -> segera (hari ini); Ada Yang Rusak -> 7 hari lagi (sama dengan next_service_days di panel AI)
  const planned = scheduled_date
    ? parseDate(scheduled_date)
    : dayjs().add(asset.condition_status === 'Rusak' ? 0 : 7, 'day').startOf('day').toDate();

  const log = await prisma.maintenanceLog.create({
    data: {
      asset_id: asset.id,
      asset_name: asset.asset_name,
      room_id: asset.room_id,
      activity: (activity && String(activity).trim().slice(0, 150)) || 'Servis Terjadwal',
      technician: technician ? String(technician).trim().slice(0, 100) : null,
      notes: notes ? String(notes).trim().slice(0, 500) : null,
      scheduled_date: planned,
      status: 'pending',
    },
  });

  await notificationService.create({
    title: 'Perawatan Dijadwalkan',
    message: `${asset.asset_name}${asset.room ? ` (${asset.room.room_code})` : ''} dijadwalkan untuk ${log.activity.toLowerCase()} pada ${dayjs(planned).format('DD/MM/YYYY')}.`,
    type: 'system',
  }).catch((e) => console.warn('[MAINT] Gagal membuat notifikasi:', e.message));

  return { ...log, room_id: asset.room?.room_code ?? null };
};

/**
 * Ubah pekerjaan perawatan: ganti teknisi / tanggal / kegiatan / catatan, atau pindahkan status.
 * `condition_after` (hanya saat status -> done) = kondisi aset setelah perawatan, default 'Baik'.
 */
const updateMaintenance = async (id, data, actor = {}) => {
  const logId = parseInt(id, 10);
  const log = await prisma.maintenanceLog.findUnique({ where: { id: logId } });
  if (!log) throw { status: 404, message: 'Maintenance job not found' };
  if (!OPEN_STATUSES.includes(log.status)) throw { status: 409, message: 'Maintenance job is already closed' };

  const prevStatus = log.status;
  const next = data.status ?? prevStatus;
  if (!ALLOWED_NEXT[prevStatus].includes(next)) throw { status: 422, message: 'Invalid status transition' };

  const patch = {};
  if (data.activity !== undefined) {
    const a = String(data.activity).trim();
    if (!a) throw { status: 422, message: 'Activity is required' };
    patch.activity = a.slice(0, 150);
  }
  if (data.technician !== undefined) patch.technician = data.technician ? String(data.technician).trim().slice(0, 100) : null;
  if (data.notes !== undefined) patch.notes = data.notes ? String(data.notes).trim().slice(0, 500) : null;
  if (data.scheduled_date !== undefined) patch.scheduled_date = data.scheduled_date ? parseDate(data.scheduled_date) : null;
  patch.status = next;

  if (next === 'in_progress' && !(patch.technician ?? log.technician)) patch.technician = await actorName(actor);

  let assetNote = '';
  if (next === 'done') {
    patch.completed_at = new Date();
    if (!(patch.technician ?? log.technician)) patch.technician = await actorName(actor);

    if (log.asset_id) {
      const condition = CONDITIONS.includes(data.condition_after) ? data.condition_after : 'Baik';
      const exists = await prisma.asset.findUnique({ where: { id: log.asset_id }, select: { id: true } });
      if (exists) {
        await assetService.update(log.asset_id, { condition_status: condition });
        assetNote = ` Kondisi aset: ${condition}.`;
      }
    }
  }

  const updated = await prisma.maintenanceLog.update({ where: { id: logId }, data: patch });

  if (next === 'done' && prevStatus !== 'done') {
    await notificationService.create({
      title: 'Perawatan Selesai',
      message: `${log.asset_name}: ${updated.activity} selesai dikerjakan${updated.technician ? ` oleh ${updated.technician}` : ''}.${assetNote}`,
      type: 'system',
    }).catch((e) => console.warn('[MAINT] Gagal membuat notifikasi:', e.message));
  }

  const map = await roomLabels([updated]);
  return withRoomLabel(updated, map);
};

const deleteMaintenance = async (id) => {
  const log = await prisma.maintenanceLog.findUnique({ where: { id: parseInt(id, 10) } });
  if (!log) throw { status: 404, message: 'Maintenance job not found' };
  await prisma.maintenanceLog.delete({ where: { id: log.id } });
};

module.exports = { getAlertSummary, getMaintenanceHistory, createMaintenance, updateMaintenance, deleteMaintenance };