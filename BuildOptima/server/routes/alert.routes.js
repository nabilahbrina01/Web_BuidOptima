// "Alerts" is the frontend's name for what the backend models as "Notification".
// Also note: frontend calls these with PATCH, while /api/notifications uses PUT —
// we register PATCH here to match the frontend exactly without touching the
// original /notifications routes (kept for backward compatibility).
const router = require('express').Router();
const ctrl   = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { testEmailLimiter } = require('../middleware/rateLimit.middleware');

router.use(authenticate);

router.post('/test-email', testEmailLimiter, ctrl.testEmail); // kirim email contoh ke akun sendiri
router.get('/',            ctrl.getAll);
router.patch('/read-all',  ctrl.markAll);
router.patch('/:id/read',  ctrl.markRead);
router.delete('/:id',      ctrl.remove);

module.exports = router;
