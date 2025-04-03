const mongoose = require('mongoose');

const adminPrivilegeSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  privilege: {
    type: String,
    enum: ['USER_MGMT', 'COURSE_MGMT', 'FEE_MGMT', 'REPORT_GEN'],
    required: true
  },
  scope: {
    type: String,
    enum: ['GLOBAL', 'DEPARTMENT', 'COURSE'],
    required: true
  },
  grantedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create compound index for privilege and scope for faster lookups
adminPrivilegeSchema.index({ privilege: 1, scope: 1 });

// Create index on admin reference for faster lookups
adminPrivilegeSchema.index({ admin: 1 });

// Method to check if a specific admin has a particular privilege with the given scope
adminPrivilegeSchema.statics.hasPrivilege = async function(adminId, requiredPrivilege, requiredScope) {
  const privilege = await this.findOne({
    admin: adminId,
    privilege: requiredPrivilege,
    scope: { $in: [requiredScope, 'GLOBAL'] } // Global scope includes all lower scopes
  });
  return !!privilege;
};

// Method to grant a new privilege to an admin
adminPrivilegeSchema.statics.grantPrivilege = async function(adminId, privilege, scope) {
  return await this.create({
    admin: adminId,
    privilege,
    scope
  });
};

// Method to revoke a privilege from an admin
adminPrivilegeSchema.statics.revokePrivilege = async function(adminId, privilege, scope) {
  return await this.deleteOne({
    admin: adminId,
    privilege,
    scope
  });
};

const AdminPrivilege = mongoose.model('AdminPrivilege', adminPrivilegeSchema);

module.exports = AdminPrivilege;