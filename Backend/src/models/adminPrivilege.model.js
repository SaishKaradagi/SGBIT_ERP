import mongoose from "mongoose";

/**
 * AdminPrivilege Schema
 * Maps admin users to their granular privileges and scopes.
 * Designed for Indian college ERP systems.
 */
const adminPrivilegeSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: [true, "Admin reference is required"],
      index: true,
    },
    privilege: {
      type: String,
      enum: {
        values: ["USER_MGMT", "COURSE_MGMT", "FEE_MGMT", "REPORT_GEN"],
        message: "{VALUE} is not a valid privilege type",
      },
      required: [true, "Privilege type is required"],
    },
    scope: {
      type: String,
      enum: {
        values: ["GLOBAL", "DEPARTMENT", "COURSE"],
        message: "{VALUE} is not a valid privilege scope",
      },
      required: [true, "Scope is required"],
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for privilege and scope for faster lookups
adminPrivilegeSchema.index({ privilege: 1, scope: 1 });

/**
 * Checks if a specific admin has a particular privilege with the given scope.
 * Global scope includes all lower scopes.
 * @param {mongoose.Types.ObjectId} adminId
 * @param {string} requiredPrivilege
 * @param {string} requiredScope
 * @returns {Promise<boolean>}
 */
adminPrivilegeSchema.statics.hasPrivilege = async function (
  adminId,
  requiredPrivilege,
  requiredScope,
) {
  const validScopes = ["GLOBAL", "DEPARTMENT", "COURSE"];
  if (!validScopes.includes(requiredScope)) return false;

  // If GLOBAL privilege exists, it covers all
  const privilege = await this.findOne({
    admin: adminId,
    privilege: requiredPrivilege,
    scope: { $in: [requiredScope, "GLOBAL"] },
  });
  return !!privilege;
};

/**
 * Grants a new privilege to an admin.
 * @param {mongoose.Types.ObjectId} adminId
 * @param {string} privilege
 * @param {string} scope
 * @returns {Promise<Object>} Created document
 */
adminPrivilegeSchema.statics.grantPrivilege = async function (
  adminId,
  privilege,
  scope,
) {
  // Prevent duplicate privilege for same admin, privilege, and scope
  const exists = await this.findOne({ admin: adminId, privilege, scope });
  if (exists) return exists;

  return await this.create({
    admin: adminId,
    privilege,
    scope,
  });
};

/**
 * Revokes a privilege from an admin.
 * @param {mongoose.Types.ObjectId} adminId
 * @param {string} privilege
 * @param {string} scope
 * @returns {Promise<Object>} Deletion result
 */
adminPrivilegeSchema.statics.revokePrivilege = async function (
  adminId,
  privilege,
  scope,
) {
  return await this.deleteOne({
    admin: adminId,
    privilege,
    scope,
  });
};

const AdminPrivilege = mongoose.model("AdminPrivilege", adminPrivilegeSchema);

export default AdminPrivilege;
