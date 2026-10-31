const deviceService = require('../services/device.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getAll    = asyncHandler(async (req, res) => res.json({ success: true, data: await deviceService.getAll(req.query) }));
const getById   = asyncHandler(async (req, res) => res.json({ success: true, data: await deviceService.getById(req.params.id) }));
const register  = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await deviceService.register(req.body) }));
const update    = asyncHandler(async (req, res) => res.json({ success: true, data: await deviceService.update(req.params.id, req.body) }));
const remove    = asyncHandler(async (req, res) => { await deviceService.remove(req.params.id); res.json({ success: true }); });
const heartbeat = asyncHandler(async (req, res) => {
  const data = await deviceService.heartbeat(req.body.esp_id);
  res.json({ success: true, data });
});

const toggle  = asyncHandler(async (req, res) => res.json({ success: true, data: await deviceService.toggle(req.params.id, req.body.on) }));
const setAuto = asyncHandler(async (req, res) => res.json({ success: true, data: await deviceService.setAuto(req.params.id, req.body.auto) }));

module.exports = { getAll, getById, register, update, remove, heartbeat, toggle, setAuto };
