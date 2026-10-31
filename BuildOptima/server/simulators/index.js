const mmwave    = require('./mmwave.simulator');
const dht22     = require('./dht22.simulator');
const pzem      = require('./pzem.simulator');
const heartbeat = require('./heartbeat.simulator');

const startSimulators = () => {
  console.log('[SIM] Starting all sensor simulators…');

  setTimeout(() => heartbeat.start(), 3000);
  setTimeout(() => mmwave.start(),    5000);
  setTimeout(() => dht22.start(),     7000);
  setTimeout(() => pzem.start(),      9000);
};

const stopSimulators = () => {
  heartbeat.stop();
  mmwave.stop();
  dht22.stop();
  pzem.stop();
};

module.exports = { startSimulators, stopSimulators };
