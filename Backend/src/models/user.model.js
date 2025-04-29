import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const userSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    match: [/^[a-zA-Z]+$/, 'First name must only contain letters']
  },
  middleName: {
    type: String,
    trim: true,
    match: [/^[a-zA-Z]*$/, 'Middle name must only contain letters'] // Changed + to * to allow empty middle name
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    match: [/^[a-zA-Z]+$/, 'Last name must only contain letters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Improved email regex
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    // Removed redundant minlength since the regex already enforces it
    select: false,
    match: [/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/, 'Password must contain at least one uppercase letter, one number, and one special character']
  },
  role: {
    type: String,
    enum: ['admin', 'hod', 'proctor', 'faculty', 'student', 'studentGuardian'],
    required: true
  },
  mfaSecret: {
    type: String,
    select: false
  },
  lastLogin: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  refreshToken: {
    type: String,
    select: false
  },
  verificationToken: {
    type: String,
    select: false
  },
  verificationTokenExpiry: {
    type: Date,
    select: false
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  profileImage: {
    type: String
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  preferences: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for role and status
userSchema.index({ role: 1, status: 1 });

// Virtual field for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.middleName || ''} ${this.lastName}`.trim();
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    // Generate salt and hash password using bcrypt
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    // Properly pass error to next middleware
    return next(error);
  }
});

// Method to check if password is correct
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate password reset token
userSchema.methods.createPasswordResetToken = function() {
  // Generate a more secure token using crypto.randomBytes
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expiry to 10 minutes
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

// Method to generate verification token
userSchema.methods.createVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.verificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  // Set expiry to one day
  this.verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
  
  return verificationToken;
};

// Method to handle failed login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  this.failedLoginAttempts += 1;
  return await this.save();
};

userSchema.methods.resetLoginAttempts = async function() {
  this.failedLoginAttempts = 0;
  return await this.save();
};

// Role-based Permissions Mapping
const rolesPermissions = {
  admin: ['create', 'update', 'delete', 'view'],     // Admin has full permissions
  faculty: ['create', 'view'],                        // Faculty can create and view
  student: ['view'],                                  // Student can only view
  studentGuardian: ['view'],                          // Student Guardian can only view
  hod: ['create', 'update', 'view'],                  // HOD can create, update, and view
  proctor: ['view']                                   // Proctor can only view
};

// Method to check if the user has a specific permission
userSchema.methods.isAuthorized = function(action) {
  const permissions = rolesPermissions[this.role];
  
  if (permissions && permissions.includes(action)) {
    return true;
  }
  
  return false;
};

const User = mongoose.model('User', userSchema);

// Switch to ES modules export
export default User;