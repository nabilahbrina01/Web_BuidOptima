const prisma   = require('../config/prisma');
const QRCode   = require('qrcode');
const path     = require('path');
const fs       = require('fs');
const { UPLOAD_PATH } = require('../config/constants');

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

// Frontend expects a flat shape { name, room_id (as label), qty, condition_status, note }
// on top of the raw Asset row. Adds those aliases without removing the real columns.
const makeQrCode = (asset) => `SB-${new Date().getFullYear()}-${String(asset.id).padStart(3, '0')}`;

const enrichAsset = (asset) => ({
  ...asset,
  name: asset.asset_name,
  qr_image: asset.qr_code ? `uploads/qrcodes/asset-${asset.id}.png` : null,
  room_code: asset.room?.room_code ?? null,
  room_name: asset.room?.room_name ?? null,
});

const getAll = async ({ roomId, category, status } = {}) => {
  const where = {};
  if (roomId)   where.room_id  = parseInt(roomId, 10);
  if (category) where.category = category;
  if (status)   where.status   = status;

  const assets = await prisma.asset.findMany({
    where,
    include: { room: { select: { room_code: true, room_name: true } } },
    orderBy: { created_at: 'desc' },
  });
  return assets.map(enrichAsset);
};

const getById = async (id) => {
  const a = await prisma.asset.findUnique({
    where: { id: parseInt(id, 10) },
    include: { room: true },
  });
  if (!a) throw { status: 404, message: 'Asset not found' };
  return enrichAsset(a);
};

// Map condition_status ('Baik'/'Ada Yang Rusak'/'Rusak') to the legacy `condition`
// enum too, so anything still reading the old field stays consistent.
const legacyConditionFrom = (status) =>
  status === 'Rusak' ? 'missing' : status === 'Ada Yang Rusak' ? 'damaged' : 'good';

const create = async (data) => {
  const asset_name = data.asset_name || data.name;
  if (!asset_name) throw { status: 400, message: 'Asset name is required' };

  const condition_status = data.condition_status || 'Baik';

  const asset = await prisma.asset.create({
    data: {
      asset_name,
      category: data.category || 'Umum',
      room_id: data.room_id ? parseInt(data.room_id, 10) : null,
      qty: data.qty !== undefined ? parseInt(data.qty, 10) : 1,
      note: data.note || null,
      condition_status,
      condition: legacyConditionFrom(condition_status),
    },
  });

  // Kode QR pendek (mis. SB-2026-007): inilah yang ditampilkan frontend, di-encode ke QR,
  // dan dicari lagi oleh endpoint scan. (Sebelumnya berisi path file PNG sehingga scan 404.)
  const qr_code = makeQrCode(asset);

  // Gambar PNG tetap dibuat sebagai arsip (best-effort; kegagalan tulis file tidak boleh membatalkan aset)
  try {
    const qrDir = path.join(__dirname, '..', UPLOAD_PATH, 'qrcodes');
    ensureDir(qrDir);
    await QRCode.toFile(path.join(qrDir, `asset-${asset.id}.png`), qr_code);
  } catch (err) {
    console.warn('[ASSET] Gagal menyimpan gambar QR:', err.message);
  }

  const updated = await prisma.asset.update({
    where: { id: asset.id },
    data: { qr_code },
    include: { room: true },
  });
  return enrichAsset(updated);
};

const update = async (id, data) => {
  const a = await prisma.asset.findUnique({ where: { id: parseInt(id, 10) } });
  if (!a) throw { status: 404, message: 'Asset not found' };

  const updateData = {};
  if (data.asset_name !== undefined || data.name !== undefined) updateData.asset_name = data.asset_name ?? data.name;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.room_id !== undefined) updateData.room_id = data.room_id ? parseInt(data.room_id, 10) : null;
  if (data.qty !== undefined) updateData.qty = parseInt(data.qty, 10);
  if (data.note !== undefined) updateData.note = data.note;
  if (data.condition_status !== undefined) {
    updateData.condition_status = data.condition_status;
    updateData.condition = legacyConditionFrom(data.condition_status);
  }

  const updated = await prisma.asset.update({
    where: { id: parseInt(id, 10) },
    data: updateData,
    include: { room: true },
  });
  return enrichAsset(updated);
};

const remove = async (id) => {
  const a = await prisma.asset.findUnique({ where: { id: parseInt(id, 10) } });
  if (!a) throw { status: 404, message: 'Asset not found' };
  await prisma.asset.delete({ where: { id: parseInt(id, 10) } });
};

/**
 * NOTE: there is no real predictive-maintenance / AI risk-scoring data tracked yet
 * (that would need e.g. a maintenance-history table). This derives `risk`,
 * `health_pct`, and `notes` from the simple condition_status field just so the
 * frontend's AI Predictive Maintenance panel has something real to render.
 * Treat as a placeholder — replace with real logic once history data exists.
 */
const getHealth = async () => {
  const assets = await prisma.asset.findMany({
    include: { room: { select: { room_code: true, room_name: true } } },
    orderBy: { created_at: 'desc' },
  });

  // Aset yang sudah punya pekerjaan perawatan terbuka (Terjadwal / Dikerjakan)
  const openJobs = await prisma.maintenanceLog.findMany({
    where: { status: { in: ['pending', 'in_progress'] }, asset_id: { not: null } },
    select: { asset_id: true, status: true },
  });
  const openByAsset = new Map(openJobs.map((j) => [j.asset_id, j.status]));

  return assets.map((a) => {
    const risk = a.condition_status === 'Baik' ? 'ok' : a.condition_status === 'Ada Yang Rusak' ? 'warn' : 'critical';
    const ageDays = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000);
    const next_service_days = risk === 'ok' ? Math.max(90 - ageDays, 7) : risk === 'warn' ? 7 : 0;
    const health_pct = risk === 'ok' ? 100 : risk === 'warn' ? 60 : 20;
    const notes = risk === 'ok'
      ? 'Kondisi baik, tidak perlu tindakan.'
      : risk === 'warn'
        ? 'Sebagian unit perlu pengecekan.'
        : 'Perlu perbaikan/penggantian segera.';
    return {
      ...enrichAsset(a),
      risk,
      next_service_days,
      health_pct,
      notes,
      maintenance_status: openByAsset.get(a.id) || null, // null | 'pending' | 'in_progress'
    };
  });
};

/**
 * Cari aset dari isi QR / kode manual.
 * Urutan: (1) kode QR persis (mis. "SB-2026-007"), (2) payload JSON lama { id, name },
 * (3) id numerik. Dua terakhir menjaga kompatibilitas dengan stiker QR yang sudah tercetak.
 */
const scanByCode = async (code) => {
  const raw = String(code || '').trim();

  const byCode = await prisma.asset.findFirst({ where: { qr_code: raw }, include: { room: true } });
  if (byCode) return enrichAsset(byCode);

  let id = null;
  if (/^\d+$/.test(raw)) {
    id = parseInt(raw, 10);
  } else {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id) id = parseInt(parsed.id, 10);
    } catch { /* bukan JSON */ }
  }
  if (!id) throw { status: 404, message: 'Asset with that code was not found' };

  const a = await prisma.asset.findUnique({ where: { id }, include: { room: true } });
  if (!a) throw { status: 404, message: 'Asset with that code was not found' };
  return enrichAsset(a);
};

module.exports = { getAll, getById, create, update, remove, getHealth, scanByCode };