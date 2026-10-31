const router = require('express').Router();
const ctrl   = require('../controllers/asset.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/health',        ctrl.getHealth);
router.get('/scan/:code',    ctrl.scan);
router.get('/',               ctrl.getAll);
router.get('/:id',            ctrl.getById);
router.post('/',              authorize('admin'), ctrl.create);
router.put('/:id',            authorize('admin'), ctrl.update);
router.delete('/:id',         authorize('admin'), ctrl.remove);

module.exports = router;
