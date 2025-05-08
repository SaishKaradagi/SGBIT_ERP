// auth.Middleware.js
import jwt from "jsonwebtoken";
import { asyncHandler } from "./asyncHandler.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import User from "../models/user.model.js";
import AdminPrivilege from "../models/adminPrivilege.model.js";
import Admin from "../models/admin.model.js";

import dotenv from "dotenv";

dotenv.config();
const { JWT_SECRET } = process.env;

// Middleware to verify JWT token
export const verifyJWT = asyncHandler(async (req, res, next) => {
  // Get token from Authorization header
  console.log("HEADERS:", req.headers);
  let token;

  // Prefer Authorization header
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // Fallback to cookie
  else if (req.cookies?.accessToken || req.cookies?.refreshToken) {
    // Use accessToken for normal auth, fallback to refreshToken only if intentional
    token = req.cookies.accessToken || req.cookies.refreshToken;
  }

  if (!token) {
    throw new ApiError(401, "Unauthorized access - No token provided");
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      throw new ApiError(401, "Invalid token - User not found");
    }

    // Check if user is active
    if (user.status !== "active") {
      throw new ApiError(403, `Account is ${user.status}. Access denied.`);
    }

    // Check if password was changed after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      throw new ApiError(
        401,
        "Password was changed recently. Please login again.",
      );
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, "Invalid or expired token. Please login again.");
  }
});

// Middleware to check roles
export const restrictTo = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action",
      );
    }

    next();
  });
};

// Middleware to check permissions for admin users
export const hasAdminPermission = (privilege, scope = "GLOBAL") => {
  return asyncHandler(async (req, res, next) => {
    const user = req.user;

    // Only applicable to admin roles
    if (!["admin", "superAdmin"].includes(user.role)) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action",
      );
    }

    // SuperAdmins have all privileges
    if (user.role === "superAdmin") {
      return next();
    }

    // Find the admin record
    const admin = await Admin.findOne({ user: user._id });

    if (!admin) {
      throw new ApiError(
        403,
        "Admin record not found. Please contact system administrator.",
      );
    }

    // Check privileges
    const hasPrivilege = await AdminPrivilege.hasPrivilege(
      admin._id,
      privilege,
      scope,
    );

    if (!hasPrivilege) {
      throw new ApiError(
        403,
        "You do not have the required privileges to perform this action",
      );
    }

    next();
  });
};

// Middleware for faculty-specific permissions
export const hasFacultyPermission = (departmentCheck = false) => {
  return asyncHandler(async (req, res, next) => {
    const user = req.user;

    // Only applicable to faculty, HOD roles
    if (!["faculty", "hod"].includes(user.role)) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action",
      );
    }

    // If departmentCheck is true, verify if faculty belongs to the requested department
    if (departmentCheck) {
      // Logic to check if faculty belongs to the department in request
      // This would depend on your specific implementation
      // Example:
      // const { departmentId } = req.params;
      // const faculty = await Faculty.findOne({ user: user._id });
      // if (!faculty || faculty.department.toString() !== departmentId) {
      //   throw new ApiError(
      //     403,
      //     "You do not have permission to access this department"
      //   );
      // }
    }

    next();
  });
};

// Verify email verification status
export const verifiedEmailOnly = asyncHandler(async (req, res, next) => {
  if (!req.user.isEmailVerified) {
    throw new ApiError(
      403,
      "Email is not verified. Please verify your email to access this resource.",
    );
  }

  next();
});

// Middleware to check if account is locked
export const accountNotLocked = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select("+lockedUntil");

  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    const timeRemaining = Math.ceil(
      (user.lockedUntil - Date.now()) / 1000 / 60,
    );
    throw new ApiError(
      423,
      `Account is locked. Please try again after ${timeRemaining} minutes`,
    );
  }

  next();
});
