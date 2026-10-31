const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const v      = require('../validators/auth.validator');
const val    = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { loginLimiters, otpLimiters, sendLimiters, changePasswordLimiter } = require('../middleware/rateLimit.middleware');

router.post('/register',        v.registerRules, val, sendLimiters, ctrl.register);
router.post('/verify-otp',      v.otpRules, val, otpLimiters, ctrl.verifyOtp);
router.post('/resend-otp',      v.emailOnlyRules, val, sendLimiters, ctrl.resendOtp);
router.post('/login',           v.loginRules, val, loginLimiters, ctrl.login);
router.post('/forgot-password', v.forgotPasswordRules, val, sendLimiters, ctrl.forgotPassword);
router.post('/forgot',          v.forgotPasswordRules, val, sendLimiters, ctrl.forgotPassword); // alias: dipakai frontend (halaman Lupa Password)
router.post('/verify-reset-otp', v.otpRules, val, otpLimiters, ctrl.verifyResetOtp);
router.post('/reset-password',  v.resetPasswordRules, val, otpLimiters, ctrl.resetPassword);
router.post('/change-password', authenticate, v.changePasswordRules, val, changePasswordLimiter, ctrl.changePassword);
router.get('/me',               authenticate,              ctrl.me);

module.exports = router;