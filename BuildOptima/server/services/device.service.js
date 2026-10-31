const prisma = require('../config/prisma');
const dayjs  = require('dayjs');
const { DEVICE_TIMEOUT_SEC } = require('../config/constants');
const notificationService    = require('./notification.service');
const { getIo }              = require('../sockets');
const { SOCKET_EVENTS }      = require('../config/constants');

// Frontend expects a flat shape { name, type, power_watt, is_on, room_id (as label) }
// on top of the raw Device row. This adds those without removing the real columns.
const enrichDevice = (device) => ({
  ...device,
  name: device.device_name,
  type: device.device_type,
  is_on: device.actuators?.[0]?.status === 'on',
  room_code: device.room?.room_code ?? null,
  room_name: device.room?.room_name ?? null,
});

const getAll = async ({ roomId } = {}) => {
  const where = roomId ? { room_id: parseInt(roomId, 10) } : {};
  const devices = await prisma.device.findMany({
    where,
    include: {
      room: { select: { room_code: true, room_name: true } },
      sensors: true,
      actuators: true,
    },
    orderBy: { created_at: 'desc' },
  });
  return devices.map(enrichDevice);
};

const getById = async (id) => {
  const d = await prisma.device.findUnique({
    where: { id: parseInt(id, 10) },
    include: { room: true, sensors: true, actuators: true },
  });
  if (!d) throw { status: 404, message: 'Device not found' };
  return enrichDevice(d);
};

// The "Tambah Perangkat" form has no esp_id field (it's meant for manually adding
// an appliance, not registering real ESP32 hardware) — synthesize one, and also
// create a default actuator so toggle-on/off works immediately without extra setup.
const register = async (data) => {
  const device_name = data.device_name || data.name;
  if (!device_name) throw { status: 400, message: 'Device name is required' };

  const esp_id = data.esp_id || `MANUAL_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const device = await prisma.device.create({
    data: {
      esp_id,
      device_name,
      device_type: data.device_type || data.type || 'AC',
      power_watt: parseInt(data.power_watt, 10) || 0,
      room_id: data.room_id ? parseInt(data.room_id, 10) : null,
      status: 'offline',
      actuators: { create: [{ actuator_name: 'Relay Utama', status: 'off' }] },
    },
    include: { room: true, actuators: true },
  });
  return enrichDevice(device);
};

const update = async (id, data) => {
  const d = await prisma.device.findUnique({ where: { id: parseInt(id, 10) } });
  if (!d) throw { status: 404, message: 'Device not found' };

  const updateData = {};
  if (data.device_name !== undefined || data.name !== undefined) updateData.device_name = data.device_name ?? data.name;
  if (data.device_type !== undefined || data.type !== undefined) updateData.device_type = data.device_type ?? data.type;
  if (data.power_watt !== undefined) updateData.power_watt = parseInt(data.power_watt, 10) || 0;
  if (data.room_id !== undefined) updateData.room_id = data.room_id ? parseInt(data.room_id, 10) : null;

  const updated = await prisma.device.update({
    where: { id: parseInt(id, 10) },
    data: updateData,
    include: { room: true, actuators: true },
  });
  return enrichDevice(updated);
};

const remove = async (id) => {
  const d = await prisma.device.findUnique({ where: { id: parseInt(id, 10) } });
  if (!d) throw { status: 404, message: 'Device not found' };
  await prisma.device.delete({ where: { id: parseInt(id, 10) } });
};

/**
 * Called when an ESP32 sends a heartbeat (via MQTT or HTTP).
 * Marks device online and resets last_seen.
 */
const heartbeat = async (espId) => {
  const device = await prisma.device.findUnique({ where: { esp_id: espId } });
  if (!device) throw { status: 404, message: 'Device not found' };

  const wasOffline = device.status === 'offline';

  const updated = await prisma.device.update({
    where: { esp_id: espId },
    data: { status: 'online', last_seen: new Date() },
  });

  if (wasOffline) {
    try { getIo().emit(SOCKET_EVENTS.DEVICE_STATUS, { espId, status: 'online', deviceId: device.id }); } catch {}
  }

  return updated;
};

/**
 * Periodic job: mark devices offline if no heartbeat within timeout window.
 * Call this from a setInterval in server.js or a cron utility.
 */
const checkOfflineDevices = async () => {
  const threshold = dayjs().subtract(DEVICE_TIMEOUT_SEC, 'second').toDate();

  const staleDevices = await prisma.device.findMany({
    where: {
      status: 'online',
      last_seen: { lt: threshold },
    },
  });

  for (const device of staleDevices) {
    await prisma.device.update({
      where: { id: device.id },
      data: { status: 'offline' },
    });

    await notificationService.create({
      title: 'Perangkat Offline',
      message: `Perangkat "${device.device_name}" (${device.esp_id}) tidak mengirim sinyal dan dianggap offline.`,
      type: 'device_offline',
      dedupeKey: `device_offline:${device.id}`,
    });

    try {
      getIo().emit(SOCKET_EVENTS.DEVICE_STATUS, { espId: device.esp_id, status: 'offline', deviceId: device.id });
    } catch {}
  }

  return staleDevices.length;
};

/**
 * NOTE ON DATA MODEL MISMATCH:
 * The frontend (Devices.jsx) assumes one Device IS one controllable appliance,
 * with flat fields is_on / power_watt / auto_mode directly on it.
 * The real backend models a Device as an ESP32 controller that can carry
 * multiple Actuators (relays). This adapter assumes "the first actuator on
 * the device" is the one being toggled — correct for a 1-actuator-per-device
 * setup, but should be revisited if a device can have several actuators.
 */
const automationService = require('./automation.service');

const toggle = async (id, on) => {
  const device = await prisma.device.findUnique({
    where: { id: parseInt(id, 10) },
    include: { actuators: true, room: true },
  });
  if (!device) throw { status: 404, message: 'Device not found' };
  if (!device.actuators.length) {
    throw { status: 400, message: 'This device has no actuator configured yet — add one before toggling.' };
  }

  await automationService.setRelay({ actuatorId: device.actuators[0].id, state: on ? 'on' : 'off' });

  const updated = await prisma.device.findUnique({
    where: { id: parseInt(id, 10) },
    include: { actuators: true, room: true },
  });

  return enrichDevice(updated);
};

const setAuto = async (id, auto) => {
  const device = await prisma.device.findUnique({ where: { id: parseInt(id, 10) } });
  if (!device) throw { status: 404, message: 'Device not found' };
  const updated = await prisma.device.update({
    where: { id: parseInt(id, 10) },
    data: { auto_mode: !!auto },
    include: { actuators: true, room: true },
  });
  return enrichDevice(updated);
};

module.exports = { getAll, getById, register, update, remove, heartbeat, checkOfflineDevices, toggle, setAuto };