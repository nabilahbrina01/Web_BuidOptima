const sensorService = require('../services/sensor.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getAll  = asyncHandler(async (req, res) => res.json({ success: true, data: await sensorService.getAll(req.query) }));
const create  = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await sensorService.create(req.body) }));
const remove  = asyncHandler(async (req, res) => { await sensorService.remove(req.params.id); res.json({ success: true }); });
const getLogs = asyncHandler(async (req, res) => {
  const data = await sensorService.getLogs(req.params.id, req.query.period);
  res.json({ success: true, data });
});

module.exports = { getAll, create, remove, getLogs };
