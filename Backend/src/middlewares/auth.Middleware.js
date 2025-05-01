// src/middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import { promisify } from "util";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { redisClient } from "../db/redis.connection.js";

dotenv.config();

/**
 * Verifies the JWT token and attaches the user to the request
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  // 1) Get token from Authorization header
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(
      new ApiError(401, "You are not logged in. Please log in to get access."),
    );
  }

  // 2) Verify token
  const decoded = await promisify(jwt.verify)(
    token,
    process.env.JWT_ACCESS_SECRET,
  ).catch((err) => {
    if (err.name === "JsonWebTokenError") {
      return next(new ApiError(401, "Invalid token. Please log in again."));
    }
    if (err.name === "TokenExpiredError") {
      return next(
        new ApiError(401, "Your token has expired. Please log in again."),
      );
    }
    return next(
      new ApiError(401, "Authentication failed. Please log in again."),
    );
  });

  // 3) Check if token is blacklisted
  const isBlacklisted = await redisClient.get(`blacklist:${token}`);
  if (isBlacklisted) {
    return next(
      new ApiError(401, "Token has been revoked. Please log in again."),
    );
  }

  // 4) Check if user still exists
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(
      new ApiError(401, "The user belonging to this token no longer exists."),
    );
  }

  // 5) Check if user changed password after token was issued
  if (user.changedPasswordAfter(decoded.iat)) {
    return next(
      new ApiError(401, "User recently changed password. Please log in again."),
    );
  }

  // 6) Check if account is active
  if (user.status !== "active") {
    return next(
      new ApiError(
        403,
        `Your account is ${user.status}. Please contact the administrator.`,
      ),
    );
  }

  // 7) Grant access to protected route
  req.user = user;
  next();
});

/**
 * Role-based access control middleware
 * Restricts access based on user role
 * @param {...String} roles - Allowed roles
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new ApiError(
          401,
          "Authentication required before checking authorization.",
        ),
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, "You do not have permission to perform this action."),
      );
    }

    next();
  };
};

/**
 * Permission-based access control middleware
 * Restricts access based on user permissions
 * @param {...String} requiredPermissions - Permissions required
 */
export const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new ApiError(
          401,
          "Authentication required before checking permissions.",
        ),
      );
    }

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      req.user.permissions.includes(permission),
    );

    if (!hasAllPermissions) {
      return next(
        new ApiError(
          403,
          "You do not have the necessary permissions to perform this action.",
        ),
      );
    }

    next();
  };
};

/**
 * Verified email middleware
 * Ensures user has verified their email
 */
export const requireVerifiedEmail = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(
      new ApiError(
        401,
        "Authentication required before checking email verification.",
      ),
    );
  }

  if (!req.user.isEmailVerified) {
    return next(
      new ApiError(
        403,
        "Email verification required. Please verify your email.",
      ),
    );
  }

  next();
});

/**
 * Multi-factor Authentication middleware
 * Ensures MFA is verified for users with MFA enabled
 */
export const requireMfaVerification = asyncHandler(async (req, res, next) => {
  // Skip MFA check if user doesn't have MFA enabled
  if (!req.user.mfaEnabled) {
    return next();
  }

  // Check if MFA session is verified
  const mfaVerified = req.session?.mfaVerified === true;

  if (!mfaVerified) {
    return next(
      new ApiError(
        403,
        "Multi-factor authentication required. Please complete the verification.",
      ),
    );
  }

  next();
});

/**
 * Active session check middleware
 * Ensures the session is still valid and hasn't been invalidated
 */
export const requireActiveSession = asyncHandler(async (req, res, next) => {
  const sessionId = req.sessionID;

  // Check if session exists in Redis
  const sessionExists = await redisClient.exists(`session:${sessionId}`);

  if (!sessionExists) {
    return next(
      new ApiError(
        401,
        "Session has expired or been invalidated. Please log in again.",
      ),
    );
  }

  next();
});

/**
 * Rate limiting for specific routes
 * Uses Redis to track request counts by IP or user ID
 * @param {Number} maxRequests - Maximum requests allowed in the window
 * @param {Number} windowMs - Time window in milliseconds
 * @param {String} keyPrefix - Prefix for the Redis key
 */
export const rateLimit = (maxRequests, windowMs, keyPrefix = "ratelimit") => {
  return asyncHandler(async (req, res, next) => {
    const key = `${keyPrefix}:${req.ip}`;

    // Get current count from Redis
    const currentRequests = await redisClient.get(key);

    if (!currentRequests) {
      // First request, set counter and expiry
      await redisClient.set(key, 1, "EX", Math.ceil(windowMs / 1000));
    } else if (parseInt(currentRequests) >= maxRequests) {
      // Too many requests
      return next(
        new ApiError(
          429,
          "Too many requests from this IP, please try again later.",
        ),
      );
    } else {
      // Increment counter
      await redisClient.incr(key);
    }

    next();
  });
};

/**
 * Login rate limiting middleware
 * Specialized rate limiting for login attempts
 */
export const loginRateLimit = rateLimit(5, 15 * 60 * 1000, "login");

/**
 * Account lockout middleware
 * Checks if user account is locked due to failed login attempts
 */
export const checkAccountLockout = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ApiError(400, "Email is required."));
  }

  const user = await User.findOne({ email });

  if (user && user.lockedUntil && user.lockedUntil > Date.now()) {
    const remainingTimeMs = user.lockedUntil - Date.now();
    const remainingMinutes = Math.ceil(remainingTimeMs / (60 * 1000));

    return next(
      new ApiError(
        403,
        `Account is temporarily locked. Please try again in ${remainingMinutes} minutes.`,
      ),
    );
  }

  next();
});
