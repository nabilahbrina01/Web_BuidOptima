const scheduleService = require('../services/schedule.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getAll        = asyncHandler(async (req, res) => res.json({ success: true, data: await scheduleService.getAll(req.query) }));
const getById       = asyncHandler(async (req, res) => res.json({ success: true, data: await scheduleService.getById(req.params.id) }));
const create        = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await scheduleService.create(req.body) }));
const update        = asyncHandler(async (req, res) => res.json({ success: true, data: await scheduleService.update(req.params.id, req.body) }));
const remove        = asyncHandler(async (req, res) => { await scheduleService.remove(req.params.id); res.json({ success: true, message: 'Deleted' }); });
const checkConflict = asyncHandler(async (req, res) => res.json({ success: true, data: await scheduleService.checkConflicts(req.body) }));

module.exports = { getAll, getById, create, update, remove, checkConflict };
