const prisma   = require('../config/prisma');
const mqttClient = require('../mqtt/client');
const { getIo } = require('../sockets');
const { SOCKET_EVENTS } = require('../config/constants');

// ─── RELAY CONTROL ────────────────────────────────────────────────────────────
/**
 * Set an actuator (relay) state.
 * Publishes MQTT command so ESP32 picks it up.
 */
const setRelay = async ({ actuatorId, state }) => {
  const actuator = await prisma.actuator.findUnique({
    where: { id: parseInt(actuatorId, 10) },
    include: { device: true },
  });
  if (!actuator) throw { status: 404, message: 'Actuator not found' };

  const status = state === 'on' ? 'on' : 'off';

  // Publish MQTT control command
  const topic   = `buildoptima/control/${actuator.device.esp_id}/relay/${actuatorId}`;
  const payload = JSON.stringify({ state: status, ts: Date.now() });
  const sent = mqttClient.publish(topic, payload);
  if (!sent) {
    // Jangan ubah status di DB bila perintah tidak sampai ke perangkat (UI menampilkan "Periksa koneksi broker MQTT")
    throw { status: 503, message: 'MQTT broker is not connected' };
  }

  // Update DB state
  const updated = await prisma.actuator.update({
    where: { id: parseInt(actuatorId, 10) },
    data:  { status },
  });

  try {
    getIo().emit(SOCKET_EVENTS.DEVICE_UPDATE, { deviceId: actuator.device_id, actuatorId: updated.id, status });
  } catch { /* socket belum siap */ }

  return updated;
};

// ─── IR SENDER ────────────────────────────────────────────────────────────────
/**
 * Send an IR command (e.g., AC on/off, fan speed, etc.)
 */
const sendIr = async ({ deviceId, command, data: irData }) => {
  const device = await prisma.device.findUnique({ where: { id: parseInt(deviceId, 10) } });
  if (!device) throw { status: 404, message: 'Device not found' };

  const topic   = `buildoptima/control/${device.esp_id}/ir`;
  const payload = JSON.stringify({ command, data: irData, ts: Date.now() });
  const sent = mqttClient.publish(topic, payload);
  if (!sent) throw { status: 503, message: 'MQTT broker is not connected' };

  return { device_id: device.id, command, sent_at: new Date() };
};

// ─── AUTO CONTROL (called from MQTT occupancy processor) ─────────────────────
/**
 * When a room becomes empty, turn off all relays in that room.
 */
const autoControlOnEmpty = async (roomId) => {
  const devices = await prisma.device.findMany({
    where: { room_id: parseInt(roomId, 10) },
    include: { actuators: true },
  });

  for (const device of devices) {
    for (const actuator of device.actuators) {
      if (actuator.status === 'on') {
        try {
          await setRelay({ actuatorId: actuator.id, state: 'off' });
          console.log(`[AUTO] Turned off actuator ${actuator.actuator_name} in room ${roomId}`);
        } catch (err) {
          console.warn(`[AUTO] Gagal mematikan ${actuator.actuator_name} di room ${roomId}: ${err.message}`);
        }
      }
    }
  }
};

/**
 * When a room becomes occupied (during scheduled hours), optionally turn on defaults.
 * Extend this logic as needed.
 */
const autoControlOnOccupied = async (roomId) => {
  // Placeholder: extend with logic to restore preferred device states
  console.log(`[AUTO] Room ${roomId} occupied. Custom automation can be added here.`);
};

module.exports = { setRelay, sendIr, autoControlOnEmpty, autoControlOnOccupied };
