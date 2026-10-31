const router = require('express').Router();
const ctrl   = require('../controllers/reports.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/alert-summary',        ctrl.getAlertSummary);
router.get('/maintenance-history',  ctrl.getMaintenanceHistory);
router.post('/maintenance',         ctrl.createMaintenance);
router.patch('/maintenance/:id',    ctrl.updateMaintenance);                     // teknisi & admin
router.delete('/maintenance/:id',   authorize('admin'), ctrl.deleteMaintenance); // hanya admin

module.exports = router;