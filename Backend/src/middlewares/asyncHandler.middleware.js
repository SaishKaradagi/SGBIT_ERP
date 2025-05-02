// asyncHandler.middleware.js
/**
 * Async handler to eliminate try-catch blocks in route handlers
 * @param {Function} fn - The async function to handle
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
