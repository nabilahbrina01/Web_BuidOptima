/**
 * Periodic device health checker.
 * Marks devices offline if they haven't sent a heartbeat within the timeout window.
 * Start this after server boot.
 */

const deviceService = require('../services/device.service');

const POLL_INTERVAL_MS = 20000; // check every 20 seconds

let timer = null;

const start = () => {
  console.log('[HEALTH] Device offline checker started');

  timer = setInterval(async () => {
    try {
      const count = await deviceService.checkOfflineDevices();
      if (count > 0) console.log(`[HEALTH] Marked ${count} device(s) offline`);
    } catch (err) {
      console.error('[HEALTH] Checker error:', err.message);
    }
  }, POLL_INTERVAL_MS);
};

const stop = () => {
  if (timer) { clearInterval(timer); timer = null; }
};

module.exports = { start, stop };
