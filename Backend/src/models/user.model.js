// user.model.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
// import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

const userSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      immutable: true,
      index: true,
    },
    // Personal Information
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters long"],
      maxlength: [50, "First name cannot exceed 50 characters"],
      match: [
        /^[a-zA-Z\s]+$/,
        "First name must only contain letters and spaces",
      ],
    },
    middleName: {
      type: String,
      trim: true,
      maxlength: [50, "Middle name cannot exceed 50 characters"],
      match: [
        /^[a-zA-Z\s]*$/,
        "Middle name must only contain letters and spaces",
      ],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [1, "Last name must be at least 1 character long"],
      maxlength: [50, "Last name cannot exceed 50 characters"],
      match: [
        /^[a-zA-Z\s]+$/,
        "Last name must only contain letters and spaces",
      ],
    },
    // Contact Information
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
      index: true,
    },
    alternateEmail: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty
          return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty
          // Indian phone number validation (10 digits, optionally with +91 prefix)
          return /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid Indian phone number!`,
      },
    },
    // Authentication
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
      validate: {
        validator: function (v) {
          // Only validate password on creation or modification
          if (!this.isModified("password")) return true;
          return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_\-+={}[\]|:;"'<>,.?/]).{8,32}$/.test(
            v,
          );
        },
        message:
          "Password must be 8-32 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      },
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    passwordHistory: {
      type: [
        {
          password: String,
          changedAt: Date,
        },
      ],
      select: false,
    },
    dob: {
      type: Date,
      required: [true, "Date of birth is required"],
      validate: {
        validator: function (date) {
          const now = new Date();
          const fiveYearsAgo = new Date(
            now.getFullYear() - 5,
            now.getMonth(),
            now.getDate(),
          );
          const hundredYearsAgo = new Date(
            now.getFullYear() - 100,
            now.getMonth(),
            now.getDate(),
          );
          return date <= fiveYearsAgo && date >= hundredYearsAgo;
        },
        message: "Date of birth must be within a valid range (5-100 years old)",
      },
    },
    gender: {
      type: String,
      enum: {
        values: ["male", "female", "other", "preferNotToSay"],
        message: "{VALUE} is not a valid gender",
      },
      required: [true, "Gender is required"],
    },
    bloodGroup: {
      type: String,
      trim: true,
      maxlength: [5, "Blood group cannot exceed 5 characters"],
    },
    category: {
      type: String,
      trim: true,
      maxlength: [50, "Category cannot exceed 50 characters"],
    },
    // Authorization
    role: {
      type: String,
      enum: {
        values: [
          "admin",
          "superAdmin",
          "hod",
          // "proctor",
          "faculty",
          "student",
          "studentGuardian",
          "staff",
          "accountant",
          "librarian",
          "guest",
        ],
        message: "{VALUE} is not a valid role",
      },
      required: [true, "User role is required"],
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    // Note: department field moved to respective role-specific models

    // Account Status
    status: {
      type: String,
      enum: {
        values: [
          "active",
          "inactive",
          "suspended",
          "pending",
          "graduated",
          "alumni",
          "terminated",
        ],
        message: "{VALUE} is not a valid status",
      },
      default: "pending",
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    // Session Management
    lastLogin: {
      type: Date,
    },
    lastLoginIP: {
      type: String,
      trim: true,
    },
    // Account Verification & Recovery
    // Security
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    // User Profile
    profileImage: {
      type: String,
      default: null,
    },
    // User Preferences
    metadata: {
      type: Object,
      default: {}, // or Map
    },

    // Add this new field to track who created this user
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional for backward compatibility with existing users
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1, status: 1 });

// Virtuals
userSchema.virtual("fullName").get(function () {
  if (this.middleName) {
    return `${this.firstName} ${this.middleName} ${this.lastName}`.trim();
  }
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.virtual("age").get(function () {
  if (!this.dob) return null;
  const diff = Date.now() - this.dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)); // Convert milliseconds to years
});

userSchema.virtual("displayName").get(function () {
  return this.fullName;
});

userSchema.virtual("initials").get(function () {
  return (this.firstName.charAt(0) + this.lastName.charAt(0)).toUpperCase();
});

// Instance methods (focused only on data operations, not business logic)

// Password comparison - basic functionality needed for the model
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password was changed after a JWT was issued - needed for auth middleware
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (!this.passwordChangedAt) return false;

  const changedTimestamp = parseInt(
    this.passwordChangedAt.getTime() / 1000,
    10,
  );
  return JWTTimestamp < changedTimestamp;
};

// Pre-save hooks
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();

  try {
    // Generate a strong salt and hash the password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(this.password, salt);

    // Add current password to password history
    if (this.isModified("password") && !this.isNew) {
      if (!this.passwordHistory) this.passwordHistory = [];
      this.passwordHistory.unshift({
        password: hashedPassword,
        changedAt: new Date(),
      });

      // Limit password history to last 5 entries
      if (this.passwordHistory.length > 5) {
        this.passwordHistory = this.passwordHistory.slice(0, 5);
      }

      this.passwordChangedAt = new Date();
    }

    this.password = hashedPassword;
    next();
  } catch (error) {
    return next(error);
  }
});

// Email/phone verification status update on change
userSchema.pre("save", function (next) {
  // Ensure phone and email verification status consistency
  if (this.isModified("phone")) {
    this.isPhoneVerified = false;
  }

  if (this.isModified("email")) {
    this.isEmailVerified = false;
  }

  next();
});

// Define the model and export
const User = mongoose.model("User", userSchema);
export default User;
