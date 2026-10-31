const router = require('express').Router();
const ctrl   = require('../controllers/sensor.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/',            ctrl.getAll);
router.post('/',           authorize('admin'), ctrl.create);
router.delete('/:id',      authorize('admin'), ctrl.remove);
router.get('/logs/:id',    ctrl.getLogs);

module.exports = router;
