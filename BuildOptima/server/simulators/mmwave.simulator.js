/**
 * mmWave Occupancy Simulator
 * Publishes random presence detection events via MQTT.
 * Useful for frontend testing without physical hardware.
 */

const { publish } = require('../mqtt/client');
const prisma      = require('../config/prisma');

const INTERVAL_MS = 8000; // every 8 seconds

let timer = null;

const start = async () => {
  console.log('[SIM] mmWave occupancy simulator started');

  timer = setInterval(async () => {
    try {
      const rooms = await prisma.room.findMany({ include: { devices: true } });
      if (!rooms.length) return;

      for (const room of rooms) {
        const device = room.devices[0];
        if (!device) continue;

        const presence = Math.random() > 0.4; // 60% chance occupied
        const topic    = `buildoptima/mmwave/${device.esp_id}`;
        const payload  = { presence, room_id: room.id, ts: Date.now() };

        publish(topic, JSON.stringify(payload));
      }
    } catch (err) {
      console.error('[SIM] mmWave error:', err.message);
    }
  }, INTERVAL_MS);
};

const stop = () => {
  if (timer) { clearInterval(timer); timer = null; }
  console.log('[SIM] mmWave occupancy simulator stopped');
};

module.exports = { start, stop };
