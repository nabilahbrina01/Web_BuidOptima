const router = require('express').Router();
const ctrl   = require('../controllers/automation.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post('/relay', authorize('admin', 'staff'), ctrl.relay);
router.post('/ir',    authorize('admin', 'staff'), ctrl.ir);

module.exports = router;
