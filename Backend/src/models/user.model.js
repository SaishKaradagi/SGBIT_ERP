import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
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
    whatsappNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty
          // Indian phone number validation (10 digits, optionally with +91 prefix)
          return /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid Indian WhatsApp number!`,
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
      validate: [
        {
          validator: function (v) {
            return v.length <= 5; // Keep only last 5 password hashes
          },
          message: "Too many password history entries",
        },
      ],
    },
    // Authorization
    role: {
      type: String,
      enum: {
        values: [
          "admin",
          "superAdmin",
          "hod",
          "proctor",
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
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: function () {
        return ["hod", "faculty", "student", "proctor"].includes(this.role);
      },
    },
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
    statusReason: {
      type: String,
      trim: true,
      maxlength: [200, "Status reason cannot exceed 200 characters"],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    // Multi-Factor Authentication
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    mfaMethod: {
      type: String,
      enum: ["app", "sms", "email", null],
      default: null,
    },
    // Session Management
    lastLogin: {
      type: Date,
    },
    lastLoginIP: {
      type: String,
      trim: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    refreshTokenExpiry: {
      type: Date,
      select: false,
    },
    // Account Verification & Recovery
    verificationToken: {
      type: String,
      select: false,
    },
    verificationTokenExpiry: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
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
    gender: {
      type: String,
      enum: {
        values: ["male", "female", "other", "preferNotToSay"],
        message: "{VALUE} is not a valid gender",
      },
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty
          // Ensure person is between 5 and 100 years old
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
          return v <= fiveYearsAgo && v >= hundredYearsAgo;
        },
        message: "Date of birth must be within a valid range (5-100 years old)",
      },
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: {
        type: String,
        validate: {
          validator: function (v) {
            if (!v) return true; // Allow empty
            // Indian PIN code validation (6 digits)
            return /^\d{6}$/.test(v);
          },
          message: (props) => `${props.value} is not a valid Indian PIN code!`,
        },
      },
      country: {
        type: String,
        default: "India",
      },
    },
    // Indian-specific fields
    aadharNumber: {
      type: String,
      trim: true,
      select: false, // Hide by default due to sensitivity
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty
          // Validate Aadhar number (12 digits)
          return /^\d{12}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid Aadhar number!`,
      },
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      select: false, // Hide by default due to sensitivity
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty
          // Validate PAN number format (AAAAA9999A)
          return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid PAN number!`,
      },
    },
    // Additional Data
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        theme: "light",
        language: "en",
        notifications: {
          email: true,
          sms: false,
          app: true,
        },
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ department: 1, role: 1 });
userSchema.index({ "address.pincode": 1 });
userSchema.index({ createdAt: 1 });

// Virtuals
userSchema.virtual("fullName").get(function () {
  if (this.middleName) {
    return `${this.firstName} ${this.middleName} ${this.lastName}`.trim();
  }
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.virtual("displayName").get(function () {
  return this.fullName;
});

userSchema.virtual("initials").get(function () {
  return (this.firstName.charAt(0) + this.lastName.charAt(0)).toUpperCase();
});

userSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;

  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
});

// Reference to related models based on role
userSchema.virtual("studentInfo", {
  ref: "Student",
  localField: "_id",
  foreignField: "user",
  justOne: true,
});

userSchema.virtual("facultyInfo", {
  ref: "Faculty",
  localField: "_id",
  foreignField: "user",
  justOne: true,
});

userSchema.virtual("guardianInfo", {
  ref: "Guardian",
  localField: "_id",
  foreignField: "user",
  justOne: true,
});

// Instance methods (focused only on data operations, not business logic)

// Password comparison - basic functionality needed for the model
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Token generation - basic functionality needed for the model
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expiry to 15 minutes
  this.resetPasswordExpires = Date.now() + 15 * 60 * 1000;

  return resetToken;
};

userSchema.methods.createVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");

  this.verificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // Set expiry to 24 hours
  this.verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken;
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
