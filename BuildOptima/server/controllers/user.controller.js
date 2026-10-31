const userService = require('../services/user.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getAll  = asyncHandler(async (req, res) => res.json({ success: true, data: await userService.getAll() }));
const getById = asyncHandler(async (req, res) => res.json({ success: true, data: await userService.getById(req.params.id) }));
const create  = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await userService.create(req.body) }));
const update  = asyncHandler(async (req, res) => res.json({ success: true, data: await userService.update(req.params.id, req.body, req.user) }));
const remove  = asyncHandler(async (req, res) => { await userService.remove(req.params.id); res.json({ success: true }); });

module.exports = { getAll, getById, create, update, remove };
