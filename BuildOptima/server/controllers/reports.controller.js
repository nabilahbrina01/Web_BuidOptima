const reportsService = require('../services/reports.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getAlertSummary       = asyncHandler(async (req, res) => res.json({ success: true, data: await reportsService.getAlertSummary() }));
const getMaintenanceHistory = asyncHandler(async (req, res) => res.json({ success: true, data: await reportsService.getMaintenanceHistory() }));

const createMaintenance = asyncHandler(async (req, res) =>
  res.status(201).json({ success: true, data: await reportsService.createMaintenance(req.body, req.user) }));

const updateMaintenance = asyncHandler(async (req, res) =>
  res.json({ success: true, data: await reportsService.updateMaintenance(req.params.id, req.body, req.user) }));

const deleteMaintenance = asyncHandler(async (req, res) => {
  await reportsService.deleteMaintenance(req.params.id);
  res.json({ success: true });
});

module.exports = { getAlertSummary, getMaintenanceHistory, createMaintenance, updateMaintenance, deleteMaintenance };