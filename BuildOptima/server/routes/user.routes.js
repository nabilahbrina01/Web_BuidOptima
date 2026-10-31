const router = require('express').Router();
const ctrl   = require('../controllers/user.controller');
const { authenticate, authorize, authorizeSelfOrAdmin } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/',        ctrl.getAll);
router.get('/:id',     ctrl.getById);
router.post('/',       authorize('admin'), ctrl.create);
router.put('/:id',     authorizeSelfOrAdmin, ctrl.update);
router.delete('/:id',  authorize('admin'), ctrl.remove);

module.exports = router;
