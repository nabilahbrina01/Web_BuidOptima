/**
 * DHT22 Sensor Simulator
 * Publishes temperature and humidity readings via MQTT.
 */

const { publish } = require('../mqtt/client');
const prisma      = require('../config/prisma');

const INTERVAL_MS = 10000;

let timer = null;

const fluctuate = (base, range) =>
  parseFloat((base + (Math.random() * range * 2 - range)).toFixed(2));

const start = async () => {
  console.log('[SIM] DHT22 sensor simulator started');

  timer = setInterval(async () => {
    try {
      const sensors = await prisma.sensor.findMany({
        where: { sensor_type: { in: ['dht22_temp', 'dht22_hum'] } },
        include: { device: true },
      });

      for (const sensor of sensors) {
        const value = sensor.sensor_type === 'dht22_temp'
          ? fluctuate(26.5, 1.5)   // ~25–28°C
          : fluctuate(65, 8);       // ~57–73% RH

        const topic   = `buildoptima/sensor/${sensor.device.esp_id}/${sensor.sensor_type}`;
        const payload = { sensor_id: sensor.id, value, ts: Date.now() };
        publish(topic, JSON.stringify(payload));
      }
    } catch (err) {
      console.error('[SIM] DHT22 error:', err.message);
    }
  }, INTERVAL_MS);
};

const stop = () => {
  if (timer) { clearInterval(timer); timer = null; }
  console.log('[SIM] DHT22 simulator stopped');
};

module.exports = { start, stop };
