// auth.Middleware.js
import jwt from "jsonwebtoken";
import { asyncHandler } from "./asyncHandler.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import User from "../models/user.model.js";
import AdminPrivilege from "../models/adminPrivilege.model.js";
import Admin from "../models/admin.model.js";
import mongoose from "mongoose";
import Department from "../models/department.model.js";

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
    req.user = {
      _id: user._id,
      email: user.email,
      role: user.role, // <- make sure this is included!
    };
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
  const allowedRoles = roles.map((role) => role.toLowerCase());

  return asyncHandler(async (req, res, next) => {
    console.log("🔍 Incoming user: ", req.user);
    const userRole = req.user?.role?.toLowerCase();

    console.log("🔍 User role:", userRole);
    console.log("🔒 Allowed roles:", allowedRoles);

    if (!userRole || !allowedRoles.includes(userRole)) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action",
      );
    }

    next();
  });
};

// Enhance the admin permission middleware to also handle department-scoped permissions
export const hasAdminPermission = (privilege, scope = "GLOBAL") => {
  return asyncHandler(async (req, res, next) => {
    const user = req.user;
    console.log("User:", user);

    // Only applicable to admin roles
    if (!["admin", "superAdmin"].includes(user.role)) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action",
      );
    }

    // SuperAdmins bypass all checks
    if (user.role.toLowerCase() === "superadmin") {
      return next();
    }

    // Get the admin record
    const admin = await Admin.findOne({ user: user._id });
    if (!admin) {
      throw new ApiError(
        403,
        "Admin record not found. Please contact system administrator.",
      );
    }

    console.log("Admin record:", admin);

    const targetDepartmentId = req.body.departmentId || req.params.departmentId;
    console.log("Target Department ID:", targetDepartmentId);

    let targetDeptUpper = null;

    // Convert departmentId to departmentCode (uppercase)
    if (
      targetDepartmentId &&
      mongoose.Types.ObjectId.isValid(targetDepartmentId._id)
    ) {
      const dept = await Department.findById(targetDepartmentId._id);
      if (!dept || !dept.departmentCode) {
        throw new ApiError(
          400,
          "Invalid or misconfigured department: missing department code.",
        );
      }
      targetDeptUpper = dept.departmentCode.toLowerCase(); // Convert to uppercase for consistency
    } else if (typeof targetDepartmentId === "string") {
      targetDeptUpper = targetDepartmentId.toLowerCase(); // If departmentCode is passed directly
    }

    // Query admin privileges by user ID first
    let allPrivileges = await AdminPrivilege.find({
      admin: user._id.toString(),
    });

    // Fallback to admin._id if nothing found
    if (allPrivileges.length === 0) {
      const fallbackPrivileges = await AdminPrivilege.find({
        admin: admin._id.toString(),
      });
      allPrivileges.push(...fallbackPrivileges);
    }

    // Final fallback: full scan
    if (allPrivileges.length === 0) {
      const allRecords = await AdminPrivilege.find({});
      const userIdStr = user._id.toString();
      const adminIdStr = admin._id.toString();
      const matches = allRecords.filter((rec) => {
        const adminStr =
          typeof rec.admin === "object" ? rec.admin.toString() : rec.admin;
        return adminStr === userIdStr || adminStr === adminIdStr;
      });
      allPrivileges.push(...matches);
    }

    // Perform the actual privilege check
    const hasPrivilege = allPrivileges.some((p) => {
      const scopeId = p.scope?.toString?.(); // Convert ObjectId to string
      const targetScopeId = targetDepartmentId?.toString?.(); // Convert target dept to string

      const privileges = Array.isArray(p.privilege)
        ? p.privilege
        : [p.privilege];

      return (
        privileges.includes(privilege) &&
        (scopeId === "GLOBAL" || (targetScopeId && scopeId === targetScopeId))
      );
    });

    console.log(
      `Permission check for ${privilege} in scope ${targetDeptUpper || "GLOBAL"}: ${hasPrivilege}`,
    );

    if (!hasPrivilege) {
      throw new ApiError(
        403,
        "You do not have the required privileges for this department",
      );
    }

    next();
  });
};

// Middleware for faculty-specific permissions
// Enhanced version of hasFacultyPermission middleware
// With department-based permissions logic
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

    // If departmentCheck is true, verify department relationship
    if (departmentCheck) {
      const Faculty = mongoose.model("Faculty");
      const Department = mongoose.model("Department");

      // Get the current user's faculty record
      const faculty = await Faculty.findOne({ user: user._id });

      if (!faculty) {
        throw new ApiError(
          403,
          "Faculty record not found. Please contact administrator.",
        );
      }

      // Extract department ID - either from request body (for new users) or from params
      const targetDepartmentId =
        req.body.departmentId || req.params.departmentId;

      if (!targetDepartmentId) {
        throw new ApiError(
          400,
          "Department ID is required when creating users",
        );
      }

      // For HODs, check if they are the HOD of the target department
      if (user.role === "hod") {
        const department = await Department.findOne({
          _id: targetDepartmentId,
          hod: faculty._id,
        });

        if (!department) {
          throw new ApiError(
            403,
            "You can only create users for departments where you are the HOD",
          );
        }
      }
      // For regular faculty, check if they belong to the department
      else if (user.role === "faculty") {
        if (faculty.department.toString() !== targetDepartmentId.toString()) {
          throw new ApiError(
            403,
            "You can only create users for your own department",
          );
        }

        // Check if the faculty member is a Class Teacher or Proctor
        // This check assumes you have a field indicating this role in the Faculty model
        // if (!faculty.isClassTeacher && !faculty.isProctor) {
        //   throw new ApiError(
        //     403,
        //     "Only Class Teachers or Proctors can create student accounts",
        //   );
        // }
      }
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
