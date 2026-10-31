const router = require('express').Router();
const ctrl   = require('../controllers/aiVerification.controller');
const upload = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post('/', upload.single('image'), ctrl.verify);
router.get('/',  ctrl.getHistory);

module.exports = router;
