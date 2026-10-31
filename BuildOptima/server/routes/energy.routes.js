const router = require('express').Router();
const ctrl   = require('../controllers/energy.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/',                ctrl.getLatest);
router.post('/',               ctrl.logEnergy);
router.get('/analytics',       ctrl.getAnalytics);
router.get('/today-summary',   ctrl.getTodaySummary);
router.get('/timeline',        ctrl.getTimeline);
router.get('/per-room',        ctrl.getPerRoom);

module.exports = router;
