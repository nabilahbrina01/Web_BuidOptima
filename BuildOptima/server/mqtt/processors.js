const prisma   = require('../config/prisma');
const dayjs    = require('dayjs');
const roomService    = require('../services/room.service');
const sensorService  = require('../services/sensor.service');
const energyService  = require('../services/energy.service');
const deviceService  = require('../services/device.service');
const autoService    = require('../services/automation.service');
const notifService   = require('../services/notification.service');
const { getIo }      = require('../sockets');
const { SOCKET_EVENTS } = require('../config/constants');

// ─── mmWAVE OCCUPANCY ─────────────────────────────────────────────────────────
/**
 * Topic: buildoptima/mmwave/{esp_id}
 * Payload: { "presence": true|false, "room_id": 1 }
 */
const processOccupancy = async (espId, payload) => {
  const { presence, room_id } = payload;
  const status = presence ? 'occupied' : 'empty';

  // Update room status
  const room = await prisma.room.findFirst({ where: { id: parseInt(room_id, 10) } });
  if (!room) return;

  if (room.occupancy_status !== status) {
    await roomService.updateOccupancy(room_id, status);

    // Log occupancy change
    await prisma.occupancyLog.create({
      data: { room_id: parseInt(room_id, 10), status, detected_at: new Date() },
    });

    // Broadcast to socket clients
    try {
      getIo().emit(SOCKET_EVENTS.ROOM_OCCUPANCY, { room_id, status, ts: Date.now() });
      getIo().to(`room:${room_id}`).emit(SOCKET_EVENTS.ROOM_OCCUPANCY, { room_id, status });
    } catch {}

    // Smart automation
    if (status === 'empty') {
      await autoService.autoControlOnEmpty(room_id);
      await notifService.create({
        title: 'Ruangan Kosong',
        message: `Ruangan "${room.room_name}" kosong. Perangkat dimatikan otomatis.`,
        type: 'occupancy_alert',
      });
    } else {
      await autoService.autoControlOnOccupied(room_id);
    }
  }
};

// ─── GENERIC SENSOR ───────────────────────────────────────────────────────────
/**
 * Topic: buildoptima/sensor/{esp_id}/{sensor_type}
 * Payload: { "sensor_id": 3, "value": 26.5 }
 */
const processSensor = async (espId, sensorType, payload) => {
  const { sensor_id, value } = payload;
  if (sensor_id == null || value == null) return;

  const log = await sensorService.log(sensor_id, value);

  // Frontend perlu tahu ruangan mana yang sensornya update (untuk suhu/kelembapan real-time)
  const sensor = await prisma.sensor.findUnique({
    where: { id: parseInt(sensor_id, 10) },
    include: { device: { select: { room_id: true } } },
  });

  try {
    getIo().emit(SOCKET_EVENTS.SENSOR_DATA, {
      esp_id: espId,
      room_id: sensor?.device?.room_id ?? null,
      sensor_type: sensor?.sensor_type || sensorType,
      value,
      recorded_at: log.recorded_at,
    });
  } catch {}
};

// ─── ENERGY ───────────────────────────────────────────────────────────────────
/**
 * Topic: buildoptima/energy/{esp_id}
 * Payload: { "room_id": 1, "voltage": 220.1, "current": 2.3, "power": 506.2, "energy_kwh": 0.0014 }
 *          (energy_kwh = delta per interval; atau kirim "energy_total_kwh" kumulatif)
 */
// Kontrak energi (lihat juga server/README.md):
//  - `energy_kwh`       : konsumsi PADA INTERVAL pembacaan ini (delta, kWh) — itulah yang dijumlahkan dashboard.
//  - `energy_total_kwh` : alternatif untuk firmware yang hanya punya register kumulatif PZEM-004T;
//                         server menghitung delta-nya sendiri terhadap pembacaan sebelumnya.
const lastTotals = new Map(); // `${esp}:${room}` -> total kumulatif terakhir

const processEnergy = async (espId, payload) => {
  const { room_id, voltage, current, power } = payload;
  if (!room_id) return;

  let energy_kwh = payload.energy_kwh;
  if (energy_kwh == null && payload.energy_total_kwh != null) {
    const key   = `${espId}:${room_id}`;
    const total = parseFloat(payload.energy_total_kwh);
    const prev  = lastTotals.get(key);
    lastTotals.set(key, total);
    // pembacaan pertama = baseline (0); total turun = meter di-reset → anggap total baru sebagai delta
    energy_kwh = prev == null ? 0 : (total >= prev ? total - prev : total);
  }
  if (energy_kwh == null) return;

  await energyService.logEnergy({ roomId: room_id, voltage, current, power, energy_kwh });
};

// ─── DEVICE HEARTBEAT ─────────────────────────────────────────────────────────
/**
 * Topic: buildoptima/device/{esp_id}/heartbeat
 * Payload: { "esp_id": "ESP32_ABC" }
 */
const processHeartbeat = async (espId) => {
  try {
    await deviceService.heartbeat(espId);
  } catch (err) {
    console.warn(`[MQTT] Heartbeat for unknown device: ${espId}`);
  }
};

module.exports = { processOccupancy, processSensor, processEnergy, processHeartbeat };
