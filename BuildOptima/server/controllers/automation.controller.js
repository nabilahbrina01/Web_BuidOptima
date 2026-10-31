const autoService = require('../services/automation.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const relay = asyncHandler(async (req, res) => {
  const data = await autoService.setRelay(req.body);
  res.json({ success: true, data });
});

const ir = asyncHandler(async (req, res) => {
  const data = await autoService.sendIr(req.body);
  res.json({ success: true, data });
});

module.exports = { relay, ir };
