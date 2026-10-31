const authService = require('../services/auth.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  res.status(201).json({ success: true, message: 'Registration successful. Check email for OTP.', data });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const data = await authService.verifyOtp(req.body);
  res.json({ success: true, message: 'OTP verified', data });
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  res.json({ success: true, message: 'Login successful', data });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body);
  res.json({ success: true, message: 'If that email exists, an OTP was sent.' });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  res.json({ success: true, message: 'Password reset successful' });
});

const verifyResetOtp = asyncHandler(async (req, res) => {
  await authService.verifyResetOtp(req.body);
  res.json({ success: true, message: 'OTP valid' });
});

const resendOtp = asyncHandler(async (req, res) => {
  await authService.resendOtp(req.body);
  res.json({ success: true, message: 'If that email exists, a new OTP was sent.' });
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  res.json({ success: true, message: 'Password changed' });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await authService.me(req.user.id) });
});

module.exports = { register, verifyOtp, resendOtp, login, forgotPassword, verifyResetOtp, resetPassword, changePassword, me };
