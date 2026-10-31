const { MQTT } = require('../config/constants'); // eslint-disable-line no-unused-vars

let client = null;

/** Dipanggil sekali oleh mqtt/index.js setelah mqtt.connect(). */
const setClient = (c) => { client = c; };

const getClient = () => {
  if (!client) throw new Error('MQTT client not initialized. Call initMqtt() first.');
  return client;
};

const isConnected = () => !!(client && client.connected);

/**
 * Safe publish — tidak melempar error bila broker belum tersambung.
 * @returns {boolean} true jika pesan benar-benar dikirim ke broker.
 */
const publish = (topic, payload, opts = { qos: 1 }) => {
  try {
    const c = getClient();
    if (!c.connected) return false;
    c.publish(topic, typeof payload === 'string' ? payload : JSON.stringify(payload), opts);
    return true;
  } catch (err) {
    console.warn('[MQTT] Publish skipped:', err.message);
    return false;
  }
};

module.exports = { setClient, getClient, isConnected, publish };
