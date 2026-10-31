/**
 * PZEM-004T Energy Sensor Simulator
 * Publishes voltage, current, power, and kWh readings via MQTT.
 */

const { publish } = require('../mqtt/client');
const prisma      = require('../config/prisma');

const INTERVAL_MS = 12000;

let timer     = null;

const fluctuate = (base, range) =>
  parseFloat((base + (Math.random() * range * 2 - range)).toFixed(3));

const start = async () => {
  console.log('[SIM] PZEM-004T energy simulator started');

  timer = setInterval(async () => {
    try {
      const rooms = await prisma.room.findMany({
        include: { devices: { take: 1 } },
      });

      for (const room of rooms) {
        const device = room.devices[0];
        if (!device) continue;

        const voltage    = fluctuate(220.0, 3.0);
        const current    = room.occupancy_status === 'occupied'
          ? fluctuate(3.5, 1.0)   // higher draw when occupied
          : fluctuate(0.4, 0.2);  // standby draw
        const power      = parseFloat((voltage * current).toFixed(2));
        // kWh increment: power(W) × interval(h) / 1000
        const deltaKwh   = parseFloat(((power * (INTERVAL_MS / 1000)) / 3600000).toFixed(6));

        const topic   = `buildoptima/energy/${device.esp_id}`;
        const payload = {
          room_id:    room.id,
          voltage,
          current,
          power,
          energy_kwh: deltaKwh, // delta per interval (bukan kumulatif) — sesuai kontrak server
          ts:         Date.now(),
        };
        publish(topic, JSON.stringify(payload));
      }
    } catch (err) {
      console.error('[SIM] PZEM error:', err.message);
    }
  }, INTERVAL_MS);
};

const stop = () => {
  if (timer) { clearInterval(timer); timer = null; }
  console.log('[SIM] PZEM-004T simulator stopped');
};

module.exports = { start, stop };
