const prisma = require('../config/prisma');
const dayjs  = require('dayjs');

const getAll = async ({ deviceId } = {}) => {
  const where = deviceId ? { device_id: parseInt(deviceId, 10) } : {};
  return prisma.sensor.findMany({
    where,
    include: { device: { select: { device_name: true, esp_id: true, room_id: true } } },
  });
};

const create = async (data) => {
  return prisma.sensor.create({ data: { ...data, device_id: parseInt(data.device_id, 10) } });
};

const remove = async (id) => {
  const s = await prisma.sensor.findUnique({ where: { id: parseInt(id, 10) } });
  if (!s) throw { status: 404, message: 'Sensor not found' };
  await prisma.sensor.delete({ where: { id: parseInt(id, 10) } });
};

/**
 * Persist a sensor reading and return the log record.
 */
const log = async (sensorId, value) => {
  return prisma.sensorLog.create({
    data: { sensor_id: parseInt(sensorId, 10), value: parseFloat(value) },
  });
};

/**
 * Retrieve recent logs for a sensor.
 * @param {number} sensorId
 * @param {string} period  - '1h' | '24h' | '7d'
 */
const getLogs = async (sensorId, period = '24h') => {
  const periodMap = { '1h': 1, '24h': 24, '7d': 168 };
  const hours     = periodMap[period] || 24;
  const since     = dayjs().subtract(hours, 'hour').toDate();

  return prisma.sensorLog.findMany({
    where: {
      sensor_id: parseInt(sensorId, 10),
      recorded_at: { gte: since },
    },
    orderBy: { recorded_at: 'asc' },
  });
};

module.exports = { getAll, create, remove, log, getLogs };
