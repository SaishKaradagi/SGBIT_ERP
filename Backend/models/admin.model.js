const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const adminSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  designation: {
    type: String,
    required: true,
    trim: true
  },
  // Optional addition - permissions field
  accessLevel: {
    type: String,
    enum: ['full', 'academic', 'finance', 'hr', 'limited'],
    default: 'limited'
  }
}, {
  timestamps: true
});

// Create index on user reference for faster lookups
adminSchema.index({ user: 1 });

// Virtual to get admin's name and email via populated user
adminSchema.virtual('adminInfo').get(function() {
  if (this.populated('user')) {
    return {
      name: this.user.fullName,
      email: this.user.email,
      role: this.user.role
    };
  }
  return null;
});

// Method to check if this admin has specific permissions
adminSchema.methods.hasAccess = function(requiredAccess) {
  if (this.accessLevel === 'full') return true;
  return this.accessLevel === requiredAccess;
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;