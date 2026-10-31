const assetService = require('../services/asset.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getAll  = asyncHandler(async (req, res) => res.json({ success: true, data: await assetService.getAll(req.query) }));
const getById = asyncHandler(async (req, res) => res.json({ success: true, data: await assetService.getById(req.params.id) }));
const create  = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await assetService.create(req.body) }));
const update  = asyncHandler(async (req, res) => res.json({ success: true, data: await assetService.update(req.params.id, req.body) }));
const remove  = asyncHandler(async (req, res) => { await assetService.remove(req.params.id); res.json({ success: true }); });
const getHealth = asyncHandler(async (req, res) => res.json({ success: true, data: await assetService.getHealth() }));
const scan       = asyncHandler(async (req, res) => res.json({ success: true, data: await assetService.scanByCode(req.params.code) }));

module.exports = { getAll, getById, create, update, remove, getHealth, scan };
