import jwt from "jsonwebtoken";
import { promisify } from "util";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

/**
 * Middleware to protect routes that require authentication
 */
export const protect = catchAsync(async (req, res, next) => {
  // 1) Get token from header or cookie
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError("You are not logged in. Please log in to get access.", 401),
    );
  }

  // 2) Verify token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(
      new AppError("The user belonging to this token no longer exists.", 401),
    );
  }

  // 4) Check if user changed password after the token was issued
  if (user.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again.", 401),
    );
  }

  // 5) Check if user account is active
  if (user.status !== "active") {
    return next(
      new AppError(
        `Your account is ${user.status}. Please contact administrator.`,
        403,
      ),
    );
  }

  // Grant access to protected route
  req.user = user;
  res.locals.user = user;
  next();
});

/**
 * Middleware to restrict access to certain roles
 * @param  {...String} roles - Roles allowed to access the route
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
};

/**
 * Middleware to check if user has required permissions
 * @param  {...String} permissions - Required permissions to access the route
 */
export const requirePermission = (...permissions) => {
  return catchAsync(async (req, res, next) => {
    // Get permissions from role permissions mapping
    const user = await User.findById(req.user.id).select("+permissions");

    // If no specific permissions required, proceed
    if (permissions.length === 0) {
      return next();
    }

    // Check each required permission
    const hasAllPermissions = permissions.every((permission) => {
      return checkPermission(user, permission);
    });

    if (!hasAllPermissions) {
      return next(
        new AppError(
          "You do not have sufficient permissions to perform this action",
          403,
        ),
      );
    }

    next();
  });
};

/**
 * Helper function to check permissions with role-based rules
 */
const checkPermission = (user, permission) => {
  // Role-based Permissions Mapping
  const rolesPermissions = {
    superAdmin: ["*"], // All permissions
    admin: [
      "create:*",
      "read:*",
      "update:*",
      "delete:*",
      "manage:users",
      "manage:departments",
      "manage:courses",
      "manage:batches",
      "manage:faculty",
      "manage:students",
    ],
    hod: [
      "read:*",
      "create:attendance",
      "create:result",
      "update:result",
      "create:timetable",
      "update:timetable",
      "read:reports",
      "manage:department",
      "manage:faculty",
      "approve:leave",
    ],
    faculty: [
      "create:attendance",
      "read:attendance",
      "update:attendance",
      "create:assignment",
      "read:assignment",
      "update:assignment",
      "create:result",
      "read:result",
      "update:result",
      "read:student",
      "read:course",
      "read:batch",
      "create:leave",
      "read:leave",
    ],
    proctor: [
      "read:student",
      "read:attendance",
      "read:result",
      "create:counseling",
      "read:counseling",
      "update:counseling",
      "read:report",
    ],
    student: [
      "read:course",
      "read:timetable",
      "read:assignment",
      "create:submission",
      "read:submission",
      "update:submission",
      "read:result",
      "read:attendance",
      "create:leave",
      "read:leave",
      "read:fee",
      "create:feedback",
    ],
    studentGuardian: [
      "read:attendance",
      "read:result",
      "read:fee",
      "read:timetable",
      "read:leave",
    ],
    accountant: [
      "create:fee",
      "read:fee",
      "update:fee",
      "create:payment",
      "read:payment",
      "update:payment",
      "create:salary",
      "read:salary",
      "update:salary",
      "read:reports",
    ],
    librarian: [
      "create:book",
      "read:book",
      "update:book",
      "delete:book",
      "create:issue",
      "read:issue",
      "update:issue",
      "delete:issue",
      "read:student",
      "read:faculty",
    ],
    staff: [
      "read:student",
      "read:faculty",
      "read:department",
      "read:course",
      "read:batch",
      "read:timetable",
    ],
    guest: ["read:public", "create:inquiry"],
  };

  // Get role permissions
  const userRolePermissions = rolesPermissions[user.role] || [];

  // Check wildcard permission for role
  if (userRolePermissions.includes("*")) return true;

  // Check specific permission for role
  if (userRolePermissions.includes(permission)) return true;

  // Check wildcard for action category
  const category = permission.split(":")[0];
  if (userRolePermissions.includes(`${category}:*`)) return true;

  // Check custom user permissions
  if (user.permissions && user.permissions.includes(permission)) return true;

  return false;
};

/**
 * Middleware to log user activity
 */
export const logActivity = catchAsync(async (req, res, next) => {
  // Skip activity logging for certain routes
  const excludedPaths = ["/api/v1/health", "/api/v1/metrics"];
  if (excludedPaths.includes(req.path)) {
    return next();
  }

  // Create activity log if user is logged in
  if (req.user) {
    // Activity logging logic here (can be implemented in a separate service)
    console.log(
      `User ${req.user.id} accessed ${req.method} ${req.path} at ${new Date()}`,
    );
  }

  next();
});
