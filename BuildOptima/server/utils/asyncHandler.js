/**
 * Wraps an async Express route handler to catch errors and pass them to next().
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (err.status && !err.stack) {
      const e = new Error(err.message);
      e.status = err.status;
      return next(e);
    }
    next(err);
  });

module.exports = asyncHandler;
