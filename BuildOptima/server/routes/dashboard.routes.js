const router  = require('express').Router();
const service = require('../services/dashboard.service');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/summary', async (_req, res, next) => {
  try {
    const data = await service.getSummary();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
