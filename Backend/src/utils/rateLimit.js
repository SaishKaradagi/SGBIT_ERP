// rateLimit.js
import mongoose from "mongoose";
import { ApiError } from "./ApiError.js";

// Create rate limiter schema
const rateLimitSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 1,
    },
    firstRequest: {
      type: Date,
      default: Date.now,
    },
    lastRequest: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Use TTL index to auto-remove expired documents
    },
  },
  { timestamps: false },
);

// Define once to avoid creating multiple models
let RateLimit;
try {
  // Check if model already exists
  RateLimit = mongoose.model("RateLimit");
} catch (e) {
  // Create model if it doesn't exist
  RateLimit = mongoose.model("RateLimit", rateLimitSchema);
}

/**
 * Rate limiter middleware using MongoDB
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of requests in the time window
 * @param {string} options.message - Error message when rate limit is exceeded
 * @param {Function} options.keyGenerator - Function to generate a unique key for rate limiting
 * @returns {Function} Express middleware function
 */
export const rateLimit = (options) => {
  const {
    windowMs = 60 * 1000,
    max = 5,
    message = "Too many requests",
    keyGenerator,
  } = options;

  return async (req, res, next) => {
    try {
      // Generate key based on IP or custom function
      const key = keyGenerator
        ? keyGenerator(req)
        : req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

      // Find or create rate limit document
      let rateLimit = await RateLimit.findOne({ key });
      const now = new Date();

      if (!rateLimit) {
        // Create new rate limit record
        rateLimit = new RateLimit({
          key,
          count: 1,
          firstRequest: now,
          lastRequest: now,
          expiresAt: new Date(now.getTime() + windowMs),
        });
        await rateLimit.save();
        return next();
      }

      // Check if the time window has passed
      if (now > rateLimit.expiresAt) {
        // Reset count and timestamps
        rateLimit.count = 1;
        rateLimit.firstRequest = now;
        rateLimit.lastRequest = now;
        rateLimit.expiresAt = new Date(now.getTime() + windowMs);
        await rateLimit.save();
        return next();
      }

      // Increment request count and update last request time
      rateLimit.count += 1;
      rateLimit.lastRequest = now;

      // Check if rate limit exceeded
      if (rateLimit.count > max) {
        // Calculate remaining time
        const remainingMs = rateLimit.expiresAt.getTime() - now.getTime();
        const remainingMins = Math.ceil(remainingMs / 60000);

        // Save the updated rate limit document
        await rateLimit.save();

        // Throw error with retry-after header
        const retryAfterSeconds = Math.ceil(remainingMs / 1000);
        res.set("Retry-After", String(retryAfterSeconds));
        res.status(429);

        throw new ApiError(
          429,
          message ||
            `Too many requests. Please try again after ${remainingMins} minutes.`,
          [
            {
              time: `Retry after ${remainingMins} minutes`,
              limit: max,
              windowMs: windowMs,
            },
          ],
        );
      }

      // Save the updated rate limit document
      await rateLimit.save();

      // Continue to the next middleware
      next();
    } catch (error) {
      next(error);
    }
  };
};
