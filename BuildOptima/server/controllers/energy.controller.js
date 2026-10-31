const energyService = require('../services/energy.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getLatest     = asyncHandler(async (req, res) => res.json({ success: true, data: await energyService.getLatest(req.query) }));
const logEnergy     = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await energyService.logEnergy(req.body) }));
const getAnalytics  = asyncHandler(async (req, res) => res.json({ success: true, data: await energyService.getAnalytics(req.query) }));
const getTodaySummary = asyncHandler(async (req, res) => res.json({ success: true, data: await energyService.getTodaySummary() }));
const getTimeline     = asyncHandler(async (req, res) => res.json({ success: true, data: await energyService.getTimeline(req.query) }));
const getPerRoom      = asyncHandler(async (req, res) => res.json({ success: true, data: await energyService.getPerRoom(req.query) }));

module.exports = { getLatest, logEnergy, getAnalytics, getTodaySummary, getTimeline, getPerRoom };
