const router = require('express').Router();
const ctrl   = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { testEmailLimiter } = require('../middleware/rateLimit.middleware');

router.use(authenticate);

router.post('/test-email', testEmailLimiter, ctrl.testEmail); // kirim email contoh ke akun sendiri
router.get('/',            ctrl.getAll);
router.put('/read-all',    ctrl.markAll);
router.put('/:id/read',   ctrl.markRead);
router.delete('/:id',     ctrl.remove);

module.exports = router;
