/**
 * Device Heartbeat Simulator
 * Sends heartbeat pings for all registered devices.
 */

const { publish } = require('../mqtt/client');
const prisma      = require('../config/prisma');

const INTERVAL_MS = 15000;

let timer = null;

const start = async () => {
  console.log('[SIM] Device heartbeat simulator started');

  timer = setInterval(async () => {
    try {
      const devices = await prisma.device.findMany({ select: { esp_id: true } });

      for (const device of devices) {
        const topic   = `buildoptima/device/${device.esp_id}/heartbeat`;
        const payload = { esp_id: device.esp_id, ts: Date.now() };
        publish(topic, JSON.stringify(payload));
      }
    } catch (err) {
      console.error('[SIM] Heartbeat error:', err.message);
    }
  }, INTERVAL_MS);
};

const stop = () => {
  if (timer) { clearInterval(timer); timer = null; }
  console.log('[SIM] Heartbeat simulator stopped');
};

module.exports = { start, stop };
