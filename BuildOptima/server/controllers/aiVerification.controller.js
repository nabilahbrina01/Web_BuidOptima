const aiService = require('../ai/aiVerification.service');
const upload    = require('../middleware/upload.middleware');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const verify = asyncHandler(async (req, res) => {
  const data = await aiService.verify(req.body.room_id, req.file);
  res.status(201).json({ success: true, data });
});

const getHistory = asyncHandler(async (req, res) => {
  const data = await aiService.getHistory(req.query.roomId);
  res.json({ success: true, data });
});

module.exports = { verify, getHistory, upload };
