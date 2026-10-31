const mqtt       = require('mqtt');
const { MQTT }   = require('../config/constants');
const processors = require('./processors');
const mqttClient = require('./client');
const { getIo }  = require('../sockets');
const { SOCKET_EVENTS } = require('../config/constants');

const emitStatus = (connected) => {
  try { getIo().emit(SOCKET_EVENTS.MQTT_STATUS, { connected }); } catch { /* socket belum siap */ }
};

let client = null;

const initMqtt = () => {
  const options = {
    clientId:  MQTT.CLIENT_ID + '-' + Math.random().toString(16).slice(2, 8),
    clean:     true,
    reconnectPeriod: 5000,
  };
  if (MQTT.USERNAME) options.username = MQTT.USERNAME;
  if (MQTT.PASSWORD) options.password = MQTT.PASSWORD;

  client = mqtt.connect(MQTT.BROKER_URL, options);

  mqttClient.setClient(client);

  client.on('connect', () => {
    console.log('[MQTT] Connected to broker:', MQTT.BROKER_URL);
    emitStatus(true);
    const topics = Object.values(MQTT.TOPICS);
    client.subscribe(topics, { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] Subscribe error:', err);
      else      console.log('[MQTT] Subscribed to topics:', topics);
    });
  });

  client.on('message', handleMessage);

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting…');
  });

  client.on('offline', () => {
    console.warn('[MQTT] Client offline');
    emitStatus(false);
  });

  client.on('close', () => emitStatus(false));

  return client;
};

/**
 * Route incoming MQTT messages to the correct processor.
 * Topic format: buildoptima/{category}/{esp_id}[/{sub}]
 */
const handleMessage = async (topic, messageBuffer) => {
  let payload;
  try {
    payload = JSON.parse(messageBuffer.toString());
  } catch {
    console.warn('[MQTT] Non-JSON message on topic:', topic);
    return;
  }

  const parts = topic.split('/'); // ['buildoptima', category, esp_id, ...]
  if (parts.length < 3) return;

  const category = parts[1];
  const espId    = parts[2];

  try {
    switch (category) {
      case 'mmwave':
        await processors.processOccupancy(espId, payload);
        break;

      case 'sensor': {
        const sensorType = parts[3] || 'unknown';
        await processors.processSensor(espId, sensorType, payload);
        break;
      }

      case 'energy':
        await processors.processEnergy(espId, payload);
        break;

      case 'device': {
        const subCmd = parts[3];
        if (subCmd === 'heartbeat') await processors.processHeartbeat(espId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`[MQTT] Handler error on topic ${topic}:`, err.message);
  }
};

module.exports = { initMqtt };
