const router = require('express').Router();
const ctrl   = require('../controllers/room.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/status',   ctrl.getStatus);
router.get('/',         ctrl.getAll);
router.get('/:id',      ctrl.getById);
router.post('/',        authorize('admin'), ctrl.create);
router.put('/:id',      authorize('admin'), ctrl.update);
router.delete('/:id',   authorize('admin'), ctrl.remove);

module.exports = router;
