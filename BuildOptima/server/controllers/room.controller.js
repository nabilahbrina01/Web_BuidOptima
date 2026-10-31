const roomService = require('../services/room.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getAll     = asyncHandler(async (req, res) => {
  const data = await roomService.getAll(req.query);
  res.json({ success: true, data });
});

const getById    = asyncHandler(async (req, res) => {
  const data = await roomService.getById(req.params.id);
  res.json({ success: true, data });
});

const create     = asyncHandler(async (req, res) => {
  const data = await roomService.create(req.body);
  res.status(201).json({ success: true, message: 'Room created', data });
});

const update     = asyncHandler(async (req, res) => {
  const data = await roomService.update(req.params.id, req.body);
  res.json({ success: true, message: 'Room updated', data });
});

const remove     = asyncHandler(async (req, res) => {
  await roomService.remove(req.params.id);
  res.json({ success: true, message: 'Room deleted' });
});

const getStatus  = asyncHandler(async (req, res) => {
  const data = await roomService.getStatus();
  res.json({ success: true, data });
});

module.exports = { getAll, getById, create, update, remove, getStatus };
