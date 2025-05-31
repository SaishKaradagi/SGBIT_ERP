// auth.Controllers.js
import mongoose from "mongoose";
import User from "../models/user.model.js";
import Admin from "../models/admin.model.js";
import AdminPrivilege from "../models/adminPrivilege.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendEmail } from "../utils/emailService.js";
import { rateLimit } from "../utils/rateLimit.js";
import dotenv from "dotenv";

dotenv.config();

// Import environment variables from .env file
const {
  JWT_SECRET,
  JWT_EXPIRY,
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRY,
  NODE_ENV,
} = process.env;

// Helper function to generate JWT token
export const generateTokens = (userId) => {
  const token = jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });

  const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
  });

  return { token, refreshToken };
};

// Fix for createSuperAdmin function in auth.Controllers.js

// export const createSuperAdmin = asyncHandler(async (req, res) => {
//   const {
//     firstName,
//     middleName,
//     lastName,
//     email,
//     password,
//     dob,
//     gender,
//     phone,
//     designation,
//     departmentScope,
//   } = req.body;

//   // Check if request is from another Super Admin (if not initialization)
//   if (req.user && req.user.role !== "superAdmin") {
//     throw new ApiError(403, "Only Super Admins can create other Super Admins");
//   }

//   const User = mongoose.model("User");
//   const Admin = mongoose.model("Admin");

//   // Check if user with the same email already exists
//   const existingUser = await User.findOne({ email });
//   if (existingUser) {
//     throw new ApiError(409, "User with this email already exists");
//   }

//   let user; // Declare user variable in outer scope

//   try {
//     // Create user with SuperAdmin role and active status
//     user = await User.create({
//       firstName,
//       middleName,
//       lastName,
//       email,
//       password, // Will be hashed in the pre-save hook
//       role: "superAdmin",
//       dob: new Date(dob),
//       gender,
//       phone,
//       designation: designation,
//       status: "active", // Super Admins are immediately active
//       isEmailVerified: true, // Auto-verify Super Admin email
//       createdBy: req.user ? req.user._id : null, // Track creator if not initialization
//     });

//     // Handle department scope conversion for Super Admin
//     let departmentIds = [];

//     if (
//       departmentScope &&
//       Array.isArray(departmentScope) &&
//       departmentScope.length > 0
//     ) {
//       // Convert department codes to ObjectIds
//       const Department = mongoose.model("Department");
//       const departments = await Department.find({
//         code: { $in: departmentScope },
//       });

//       if (departments.length !== departmentScope.length) {
//         throw new ApiError(400, "Some department codes are invalid");
//       }

//       departmentIds = departments.map((dept) => dept._id);
//     } else {
//       // For Super Admins, if no departmentScope provided, give them access to all departments
//       const Department = mongoose.model("Department");
//       const allDepartments = await Department.find({ status: "active" });
//       departmentIds = allDepartments.map((dept) => dept._id);
//     }

//     // Create admin record for the Super Admin
//     const admin = await Admin.create({
//       user: user._id, // Reference to the created user
//       departmentScope: departmentIds, // All departments for Super Admins or specified ones
//       designation: designation || "Super Admin",
//     });

//     // Generate tokens
//     const { token, refreshToken } = generateTokens(user._id);

//     // Return success response
//     return res.status(201).json(
//       new ApiResponse(
//         201,
//         {
//           user: {
//             id: user._id,
//             uuid: user.uuid,
//             name: user.fullName,
//             email: user.email,
//             role: user.role,
//             status: user.status,
//           },
//           admin: {
//             id: admin._id,
//             departmentScope: admin.departmentScope,
//             designation: admin.designation,
//           },
//           token,
//           refreshToken,
//         },
//         "Super Admin created successfully",
//       ),
//     );
//   } catch (error) {
//     // If any step fails, clean up the user if it was created
//     if (user && user._id) {
//       try {
//         await User.findByIdAndDelete(user._id);
//         console.log("Cleaned up user record due to error");
//       } catch (cleanupError) {
//         console.error("Error during cleanup:", cleanupError.message);
//       }
//     }

//     throw new ApiError(500, `Error creating Super Admin: ${error.message}`);
//   }
// });

// Initialize Super Admin - utility function for system initialization
// Fix for initializeSuperAdmin function
// export const initializeSuperAdmin = async (superAdminDetails) => {
//   try {
//     // Check if any Super Admin already exists
//     const existingSuperAdmin = await User.findOne({ role: "superAdmin" });

//     if (existingSuperAdmin) {
//       console.log("✅ Super Admin already exists, skipping initialization");
//       return { success: true, message: "Super Admin already exists" };
//     }

//     // Create the first Super Admin
//     const result = await createSuperAdmin({
//       body: superAdminDetails,
//       user: null, // Explicitly set user to null for initialization
//     });

//     // Check if the result contains user and admin
//     if (!result || !result.user) {
//       throw new Error("Failed to create Super Admin - no user returned");
//     }

//     console.log(`✅ Initial Super Admin created: ${result.user.email}`);
//     return {
//       success: true,
//       message: "Super Admin initialized successfully",
//       user: {
//         id: result.user._id,
//         email: result.user.email,
//         name: result.user.fullName,
//       },
//     };
//   } catch (error) {
//     console.error("❌ Failed to initialize Super Admin:", error);
//     return { success: false, message: error.message };
//   }
// };

// export const createUser = asyncHandler(async (req, res) => {
//   const {
//     firstName,
//     middleName,
//     lastName,
//     email,
//     password,
//     role: requestedRole,
//     dob,
//     gender,
//     phone,
//     departmentId,
//     departmentScope = [],
//     designation,
//     facultyId,
//     isProctorOrAdvisor,
//     isActive,
//     dateOfJoining,
//     dateOfRelieving,
//     tenureStatus,
//     qualification,
//     employeeId,
//     specialization,
//     employmentType,
//     usn,
//     admissionYear,
//     batch,
//     section,
//     proctor,
//   } = req.body;

//   const User = mongoose.model("User");
//   const Department = mongoose.model("Department");

//   // 1. Email Duplication Check
//   const existingUser = await User.findOne({ email });
//   if (existingUser) {
//     throw new ApiError(409, "User with this email already exists");
//   }

//   // 2. Role-based Authorization
//   const creatorRole = req.user.role.toLowerCase();
//   const rolePermissions = {
//     superadmin: ["admin", "hod", "faculty", "student", "staff"],
//     admin: ["hod", "faculty", "student", "staff"],
//     hod: ["faculty", "student"],
//     faculty: ["student"],
//   };

//   if (
//     !rolePermissions[creatorRole] ||
//     !rolePermissions[creatorRole].includes(requestedRole.toLowerCase())
//   ) {
//     throw new ApiError(
//       403,
//       `${creatorRole} cannot create users with ${requestedRole} role`,
//     );
//   }

//   // 3. Validate departmentId if role is department-based
//   let department = null; // Initialize department variable
//   if (["hod", "faculty", "student"].includes(requestedRole)) {
//     if (!departmentId) {
//       throw new ApiError(400, "Department ID is required for this role");
//     }

//     department = await Department.findOne({ _id: departmentId });
//     if (!department) throw new ApiError(404, "Department not found");
//     if (department.status !== "active")
//       throw new ApiError(400, "Department is not active");

//     if (requestedRole === "hod" && department.hod) {
//       throw new ApiError(409, "Department already has an HOD assigned");
//     }
//   }

//   // 4. Create the user
//   const user = await User.create({
//     firstName,
//     middleName,
//     lastName,
//     email,
//     password, // to be hashed in pre-save
//     role: requestedRole,
//     dob: new Date(dob),
//     gender,
//     phone,
//     designation,
//     status: "pending",
//     createdBy: req.user._id,
//   });

//   // 5. Create Role-Specific Records
//   try {
//     if (requestedRole === "faculty") {
//       const Faculty = mongoose.model("Faculty");
//       await Faculty.create({
//         user: user._id,
//         departmentId: departmentId,
//         facultyId: facultyId,
//         designation: designation,
//         role: requestedRole,
//         isProctorOrAdvisor: isProctorOrAdvisor,
//         isActive: isActive,
//         dateOfJoining: dateOfJoining,
//         dateOfRelieving: dateOfRelieving,
//         tenureStatus: tenureStatus,
//         qualification: qualification,
//         employeeId: employeeId,
//         specialization: specialization,
//         employmentType: employmentType,
//       }).catch((err) => {
//         console.log(err);
//         console.log("Error creating faculty record:", err.message);
//       });
//     } else if (requestedRole === "hod") {
//       const Faculty = mongoose.model("Faculty");
//       const faculty = await Faculty.create({
//         user: user._id,
//         departmentId: departmentId,
//         facultyId: facultyId,
//         designation: designation,
//         role: requestedRole,
//         isProctorOrAdvisor: isProctorOrAdvisor,
//         isActive: isActive,
//         dateOfJoining: dateOfJoining,
//         dateOfRelieving: dateOfRelieving,
//         tenureStatus: tenureStatus,
//         qualification: qualification,
//         employeeId: employeeId,
//         specialization: specialization,
//         employmentType: employmentType,
//         department: department, // Now properly initialized
//       });

//       // Use the department variable that was already fetched and validated
//       await department.assignHOD(faculty._id);
//     } else if (requestedRole === "student") {
//       const Student = mongoose.model("Student");

//       // Validate required student fields
//       if (!usn) {
//         throw new ApiError(400, "USN is required for student");
//       }
//       if (!admissionYear) {
//         throw new ApiError(400, "Admission year is required for student");
//       }
//       if (!section) {
//         throw new ApiError(400, "Section is required for student");
//       }
//       if (!batch) {
//         throw new ApiError(400, "Batch is required for student");
//       }

//       await Student.create({
//         firstName,
//         middleName,
//         lastName,
//         email,
//         phone,
//         dob: new Date(dob),
//         gender,
//         usn,
//         admissionYear: parseInt(admissionYear),
//         section,
//         department: departmentId,
//         batch,
//         proctor,
//         user: user._id,
//       });
//     } else if (requestedRole === "admin") {
//       const Admin = mongoose.model("Admin");

//       // Convert departmentScope codes to ObjectIds
//       if (!Array.isArray(departmentScope)) {
//         throw new ApiError(400, "departmentScope must be an array");
//       }

//       const departments = await Department.find({
//         code: { $in: departmentScope },
//       });

//       if (
//         !user.isSuperAdmin &&
//         (departments.length === 0 ||
//           departments.length !== departmentScope.length)
//       ) {
//         throw new ApiError(
//           400,
//           "Invalid or missing department codes in departmentScope",
//         );
//       }

//       const departmentIds = departments.map((d) => d._id);

//       await Admin.create({
//         user: user._id,
//         departmentScope: departmentIds,
//         designation: designation || "Admin",
//       });
//     }

//     // Add other role branches if needed
//   } catch (err) {
//     await User.findByIdAndDelete(user._id); // Rollback on failure
//     throw new ApiError(
//       500,
//       `Error creating ${requestedRole} record: ${err.message}`,
//     );
//   }

//   // 6. Email Verification Setup
//   const verificationToken = crypto.randomBytes(32).toString("hex");
//   const hashedToken = crypto
//     .createHash("sha256")
//     .update(verificationToken)
//     .digest("hex");

//   user.metadata = {
//     emailVerificationToken: hashedToken,
//     emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
//   };

//   await user.save();

//   const verificationURL = `${req.protocol}://${req.get(
//     "host",
//   )}/api/v1/auth/verify-email/${verificationToken}`;

//   try {
//     await sendEmail({
//       email: user.email,
//       subject: "Your Account Has Been Created - Email Verification",
//       template: "email-verification",
//       data: {
//         name: user.firstName,
//         creatorName: req.user.fullName,
//         creatorRole,
//         verificationURL,
//       },
//     });
//   } catch (emailErr) {
//     user.metadata.emailVerificationToken = undefined;
//     user.metadata.emailVerificationExpires = undefined;
//     await user.save();
//   }

//   // 7. Final Response
//   return res.status(201).json(
//     new ApiResponse(
//       201,
//       {
//         user: {
//           id: user._id,
//           uuid: user.uuid,
//           name: user.fullName,
//           email: user.email,
//           role: user.role,
//           status: user.status,
//         },
//       },
//       `${requestedRole} account created successfully. Email verification ${
//         user.metadata?.emailVerificationToken ? "sent." : "failed to send."
//       }`,
//     ),
//   );
// });

// Rate limiter for login attempts - 5 attempts per 15 minutes from the same IP
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: "Too many login attempts, please try again after 15 minutes",
  keyGenerator: (req) => req.ip + ":" + req.body.email, // Rate limit per IP and email combination
});

// Apply rate limiter to login
export const loginRateLimit = loginRateLimiter;

// Login user
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email }).select(
    "+password +failedLoginAttempts +lockedUntil",
  );

  // Check if user exists
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    const timeRemaining = Math.ceil(
      (user.lockedUntil - Date.now()) / 1000 / 60,
    );
    throw new ApiError(
      423,
      `Account is locked. Please try again after ${timeRemaining} minutes`,
    );
  }

  // Check if account is active
  if (user.status !== "active") {
    if (user.status === "pending") {
      throw new ApiError(
        403,
        "Account is pending verification. Please verify your email.",
      );
    } else if (user.status === "suspended") {
      throw new ApiError(
        403,
        "Account is suspended. Please contact administrator.",
      );
    } else {
      throw new ApiError(
        403,
        `Account is ${user.status}. Please contact administrator.`,
      );
    }
  }

  // Check if password is correct
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    // Increment failed login attempts
    user.failedLoginAttempts += 1;

    // Lock account after 5 failed attempts
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
      await user.save();
      throw new ApiError(
        423,
        "Account locked due to too many failed login attempts. Please try again after 30 minutes.",
      );
    }

    await user.save();
    throw new ApiError(401, "Invalid email or password");
  }

  // Reset failed login attempts on successful login
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLogin = new Date();
  user.lastLoginIP = req.ip;
  await user.save();

  // Generate tokens
  const { token, refreshToken } = generateTokens(user._id);

  // Set refresh token in HTTP-only cookie
  const refreshTokenOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    secure: NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: "strict",
  };

  // To this:
  return res
    .status(200)
    .cookie("accessToken", token, {
      httpOnly: true,
      secure: NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (or match your JWT_EXPIRY)
      sameSite: "strict",
    })
    .cookie("refreshToken", refreshToken, refreshTokenOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            id: user._id,
            uuid: user.uuid,
            name: user.fullName,
            email: user.email,
            role: user.role,
          },
          token, // You can still send the token in the response body
        },
        "Logged in successfully",
      ),
    );
});

// Verify email
// Verify email
// Fix for verifyEmail function in auth.Controllers.js
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Corrected the typo here
  console.log("🔍 Incoming verification token:", token);

  // Hash the token for comparison
  const hashedToken = crypto
    .createHash("sha256")
    .update(token) // Using token directly from the request params
    .digest("hex");

  console.log("🔍 Hashed token:", hashedToken);

  // Find user with the verification token
  const user = await User.findOne({
    "metadata.emailVerificationToken": hashedToken,
    "metadata.emailVerificationExpires": { $gt: Date.now() },
  });

  console.log("🔍 User found with both conditions:", user ? "Yes" : "No");

  if (!user) {
    console.log("User not found or token expired", hashedToken);
    throw new ApiError(400, "Invalid or expired verification token");
  }

  // Update user status to active if pending
  if (user.status === "pending") {
    user.status = "active";
  }

  // Set email as verified
  user.isEmailVerified = true;

  // Clear verification token
  user.metadata.emailVerificationToken = undefined;
  user.metadata.emailVerificationExpires = undefined;

  await user.save();
  console.log("✅ User email verified successfully");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Email verified successfully. You can now log in.",
      ),
    );
});
// Logout user
export const logoutUser = asyncHandler(async (req, res) => {
  // Clear the refresh token cookie
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: NODE_ENV === "production",
  });

  //   return res
  //     .status(200)
  //     .json(new ApiResponse(200, {}, "Logged out successfully"));
  // });

  return res
    .clearCookie("accessToken", {
      httpOnly: true,
      secure: NODE_ENV === "production",
    })
    .clearCookie("refreshToken", {
      httpOnly: true,
      secure: NODE_ENV === "production",
    })
    .status(200)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

// Refresh token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  try {
    // Verify the refresh token
    const decodedToken = jwt.verify(incomingRefreshToken, JWT_REFRESH_SECRET);

    // Get user from the token
    const user = await User.findById(decodedToken.id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // Check if user is active
    if (user.status !== "active") {
      throw new ApiError(403, "User account is not active");
    }

    // Generate new tokens
    const { token, refreshToken } = generateTokens(user._id);

    // Set refresh token in HTTP-only cookie
    const refreshTokenOptions = {
      httpOnly: true,
      secure: NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "strict",
    };

    return res
      .status(200)
      .cookie("accessToken", token, {
        httpOnly: true,
        secure: NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours (or match your JWT_EXPIRY)
        sameSite: "strict",
      })
      .cookie("refreshToken", refreshToken, refreshTokenOptions)
      .json(new ApiResponse(200, { token }, "Access token refreshed"));
  } catch (error) {
    throw new ApiError(401, error.message || "Invalid refresh token");
  }
});

// Change password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }

  // Get user with password
  const user = await User.findById(req.user._id).select(
    "+password +passwordHistory",
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Verify current password
  const isPasswordCorrect = await user.comparePassword(currentPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Current password is incorrect");
  }

  // Check if new password is the same as current
  const isSamePassword = await bcrypt.compare(newPassword, user.password);

  if (isSamePassword) {
    throw new ApiError(
      400,
      "New password cannot be the same as the current password",
    );
  }

  // Check if password was used in the past
  if (user.passwordHistory && user.passwordHistory.length > 0) {
    const passwordReused = await Promise.all(
      user.passwordHistory.map(async (item) => {
        return await bcrypt.compare(newPassword, item.password);
      }),
    );

    if (passwordReused.includes(true)) {
      throw new ApiError(
        400,
        "New password cannot be one of your last 5 passwords",
      );
    }
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Send password change confirmation email
  try {
    await sendEmail({
      email: user.email,
      subject: "Password Changed",
      template: "password-changed",
      data: {
        name: user.firstName,
      },
    });
  } catch (error) {
    // Don't throw error if email fails, just log it
    console.error("Failed to send password change confirmation email:", error);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

// Forgot password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    // Return success even if user not found to prevent email enumeration
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {},
          "If a user with that email exists, a password reset link has been sent",
        ),
      );
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash and save the token
  // user.metadata.passwordResetToken = crypto
  //   .createHash("sha256")
  //   .update(resetToken)
  //   .digest("hex");
  user.metadata = {
    // ...user.metadata,

    passwordResetToken: crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex"),
    passwordResetExpires: Date.now() + 15 * 60 * 1000, // 15 minutes
  };
  // user.metadata.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

  await user.save();

  console.log("🔍 Password reset token:", resetToken);
  console.log("🔍 Hashed token:", user.metadata.passwordResetToken);

  // Generate reset URL
  const resetURL = `${req.protocol}://${req.get(
    "host",
  )}/api/v1/auth/reset-password/${resetToken}`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset",
      template: "password-reset",
      data: {
        name: user.firstName,
        resetURL,
        expireTime: "15 minutes",
      },
    });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password reset link sent to your email"));
  } catch (error) {
    // Reset token fields if email sending fails
    user.metadata.passwordResetToken = undefined;
    user.metadata.passwordResetExpires = undefined;
    await user.save();

    throw new ApiError(
      500,
      "Failed to send password reset email. Please try again later.",
    );
  }
});

// Reset password with token
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    throw new ApiError(400, "New password is required");
  }

  // Hash the token for comparison
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Find user with the valid reset token
  const user = await User.findOne({
    "metadata.passwordResetToken": hashedToken,
    "metadata.passwordResetExpires": { $gt: Date.now() },
  }).select("+password +passwordHistory");

  if (!user) {
    throw new ApiError(400, "Invalid or expired password reset token");
  }

  // ✅ Compare hashed password
  const isSameAsCurrent = await bcrypt.compare(password, user.password);
  if (isSameAsCurrent) {
    throw new ApiError(
      400,
      "New password cannot be the same as the current password",
    );
  }

  // Update password
  user.password = password;
  user.metadata.passwordResetToken = undefined;
  user.metadata.passwordResetExpires = undefined;

  await user.save();

  // Send password reset confirmation email
  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset Successful",
      template: "password-reset-success",
      data: {
        name: user.firstName,
      },
    });
  } catch (error) {
    // Don't throw error if email fails, just log it
    console.error("Failed to send password reset confirmation email:", error);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Password reset successfully. You can now log in with your new password.",
      ),
    );
});

// Get current user (requires authentication)
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Get role-specific data if needed
  let roleData = null;

  if (user.role === "admin" || user.role.toLowerCase() === "superadmin") {
    roleData = await Admin.findOne({ user: user._id });

    // If admin, get privileges
    if (roleData) {
      const privileges = await AdminPrivilege.find({ admin: roleData._id });
      roleData = {
        ...roleData.toObject(),
        privileges: privileges.map((p) => ({
          privilege: p.privilege,
          scope: p.scope,
        })),
      };
    }
  }
  // Add similar logic for other roles like faculty, student, etc.

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          id: user._id,
          uuid: user.uuid,
          name: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          roleData,
        },
      },
      "User fetched successfully",
    ),
  );
});
