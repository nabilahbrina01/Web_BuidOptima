const WEAK_JWT = ['change_me_in_production', 'changeme', 'secret', 'your_super_secret_jwt_key_min_32_chars'];
const resolveJwtSecret = () => {
  const s = process.env.JWT_SECRET;
  const weak = !s || s.length < 32 || WEAK_JWT.includes(s) || /^your_|change_?me|ganti_dengan/i.test(s);
  if (!weak) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[SECURITY] JWT_SECRET kosong/lemah. Isi dengan teks acak minimal 32 karakter di .env, mis. '
      + `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);
  }
  console.warn('[SECURITY] ⚠️  JWT_SECRET kosong/lemah — hanya boleh untuk development. Buat kunci kuat dengan: '
    + `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);
  return s || 'change_me_in_production';
};

module.exports = {
  JWT_SECRET: resolveJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  ELECTRICITY_RATE_IDR: parseFloat(process.env.ELECTRICITY_RATE_IDR || '1444.70'),

  DEVICE_TIMEOUT_SEC: parseInt(process.env.DEVICE_TIMEOUT_SEC || '30', 10),

  UPLOAD_PATH: process.env.UPLOAD_PATH || 'uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),

  MQTT: {
    BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    USERNAME: process.env.MQTT_USERNAME || '',
    PASSWORD: process.env.MQTT_PASSWORD || '',
    CLIENT_ID: process.env.MQTT_CLIENT_ID || 'buildoptima-server',
    TOPICS: {
      MMWAVE: 'buildoptima/mmwave/#',
      SENSOR: 'buildoptima/sensor/#',
      DEVICE: 'buildoptima/device/#',
      ENERGY: 'buildoptima/energy/#',
      CONTROL: 'buildoptima/control/#',
    },
  },

  SOCKET_EVENTS: {
    DASHBOARD_UPDATE: 'dashboard:update',
    ROOM_OCCUPANCY: 'room:occupancy',
    DEVICE_STATUS: 'device:status',
    SENSOR_DATA: 'sensor:data',
    ENERGY_DATA: 'energy:data',
    NOTIFICATION: 'notification:new',
    DEVICE_UPDATE: 'device:update',
    MQTT_STATUS: 'mqtt-status',
  },
};
