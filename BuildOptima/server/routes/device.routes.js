const router = require('express').Router();
const ctrl   = require('../controllers/device.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/',           ctrl.getAll);
router.get('/:id',        ctrl.getById);
router.post('/',          authorize('admin'), ctrl.register);
router.put('/:id',        authorize('admin'), ctrl.update);
router.delete('/:id',     authorize('admin'), ctrl.remove);
router.patch('/:id/toggle', ctrl.toggle);
router.patch('/:id/auto',   ctrl.setAuto);
router.post('/heartbeat',   ctrl.heartbeat); // ESP32 can call this too (no role restriction)

module.exports = router;
