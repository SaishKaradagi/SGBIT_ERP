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

adminSchema.methods.hasAccessTo = function (moduleName) {
  const accessMap = {
    full: ['academic', 'finance', 'hr', 'limited'],
    academic: ['academic'],
    finance: ['finance'],
    hr: ['hr'],
    limited: []
  };

  return accessMap[this.accessLevel]?.includes(moduleName) || this.accessLevel === 'full';
};



const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;