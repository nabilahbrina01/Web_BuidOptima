const { body } = require('express-validator');

const email = () => body('email').trim().toLowerCase().isEmail().withMessage('Invalid email');

const registerRules = [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3–50 chars'),
  email(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').optional({ values: 'falsy' }).trim().isLength({ max: 100 }).withMessage('Name must be at most 100 chars'),
  body('nip').optional({ values: 'falsy' }).trim().isLength({ max: 50 }).withMessage('NIP must be at most 50 chars'),
];

const loginRules = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const otpRules = [
  email(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
];

const emailOnlyRules = [email()];

const forgotPasswordRules = emailOnlyRules;

const resetPasswordRules = [
  email(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

const changePasswordRules = [
  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

module.exports = {
  registerRules, loginRules, otpRules, emailOnlyRules,
  forgotPasswordRules, resetPasswordRules, changePasswordRules,
};
