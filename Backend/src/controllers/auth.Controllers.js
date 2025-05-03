// auth.Controllers.js
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
import { error } from "console";

dotenv.config();

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "1d";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";

// Helper function to generate JWT token
const generateTokens = (userId) => {
  const token = jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });

  const refreshToken = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
  });

  return { token, refreshToken };
};

// Register a new user
export const registerUser = asyncHandler(async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    email,
    password,
    role,
    dob,
    gender,
    phone,
  } = req.body;

  // Check if user with the same email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  // Check if role is valid for self-registration
  const allowedRoles = ["student", "faculty", "staff", "guest"];
  if (!allowedRoles.includes(role)) {
    throw new ApiError(403, "Cannot self-register with the requested role");
  }

  // Create user with initial status as pending
  const user = await User.create({
    firstName,
    middleName,
    lastName,
    email,
    password, // Will be hashed in the pre-save hook
    role,
    dob: new Date(dob),
    gender,
    phone,
    status: "pending",
  });

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");
  // Store verification token and expiry in user's metadata
  user.metadata.emailVerificationToken = hashedToken;
  user.metadata.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  console.log("🌱 Saving hashed token to DB:", hashedToken);

  await user.save();

  console.log("✅ Saved user token info:");
  console.log("Token:", user.metadata.emailVerificationToken);
  console.log("Expires:", user.metadata.emailVerificationExpires);

  // Send verification email
  const verificationURL = `${req.protocol}://${req.get(
    "host",
  )}/api/v1/auth/verify-email/${verificationToken}`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Email Verification",
      template: "email-verification",
      data: {
        name: user.firstName,
        verificationURL,
      },
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          user: {
            id: user._id,
            uuid: user.uuid,
            name: user.fullName,
            email: user.email,
            role: user.role,
            status: user.status,
          },
        },
        "User registered successfully. Please verify your email.",
      ),
    );
  } catch (error) {
    // Email couldn't be sent, but user is created
    // Reset verification token fields
    user.metadata.emailVerificationToken = undefined;
    user.metadata.emailVerificationExpires = undefined;
    await user.save();

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          user: {
            id: user._id,
            uuid: user.uuid,
            name: user.fullName,
            email: user.email,
            role: user.role,
            status: user.status,
          },
        },
        "User registered successfully but email verification could not be sent.",
      ),
    );
  }
});

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
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: "strict",
  };

  return res
    .status(200)
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
          token,
        },
        "Logged in successfully",
      ),
    );
});

// Verify email
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
    secure: process.env.NODE_ENV === "production",
  });

  return res
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
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "strict",
    };

    return res
      .status(200)
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
  user.metadata.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.metadata.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

  await user.save();

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

  if (user.role === "admin" || user.role === "superAdmin") {
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
