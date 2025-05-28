// import mongoose from "mongoose";

// /**
//  * AdminPrivilege Schema
//  * Maps admin users to their granular privileges and scopes.
//  * Designed for Indian college ERP systems.
//  */
// const adminPrivilegeSchema = new mongoose.Schema(
//   {
//     admin: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Admin",
//       required: [true, "Admin reference is always required"],
//       index: true,
//     },
//     privilege: {
//       type: String,
//       enum: {
//         values: ["USER_MGMT", "COURSE_MGMT", "FEE_MGMT", "REPORT_GEN"],
//         message: "{VALUE} is not a valid privilege type",
//       },
//       required: [true, "Privilege type is required"],
//     },
//     scope: {
//       type: String,
//       enum: {
//         values: ["GLOBAL", "DEPARTMENT", "COURSE"],
//         message: "{VALUE} is not a valid privilege scope",
//       },
//       required: [true, "Scope is required"],
//     },
//     grantedAt: {
//       type: Date,
//       default: Date.now,
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// // Compound index for privilege and scope for faster lookups
// adminPrivilegeSchema.index({ privilege: 1, scope: 1 });

// /**
//  * Checks if a specific admin has a particular privilege with the given scope.
//  * Global scope includes all lower scopes.
//  * @param {mongoose.Types.ObjectId} adminId
//  * @param {string} requiredPrivilege
//  * @param {string} requiredScope
//  * @returns {Promise<boolean>}
//  */
// adminPrivilegeSchema.statics.hasPrivilege = async function (
//   adminId,
//   requiredPrivilege,
//   requiredScope,
// ) {
//   const validScopes = ["GLOBAL", "DEPARTMENT", "COURSE"];
//   if (!validScopes.includes(requiredScope)) return false;

//   // If GLOBAL privilege exists, it covers all
//   const privilege = await this.findOne({
//     admin: adminId,
//     privilege: requiredPrivilege,
//     scope: { $in: [requiredScope, "GLOBAL"] },
//   });
//   return !!privilege;
// };

// /**
//  * Grants a new privilege to an admin.
//  * @param {mongoose.Types.ObjectId} adminId
//  * @param {string} privilege
//  * @param {string} scope
//  * @returns {Promise<Object>} Created document
//  */
// adminPrivilegeSchema.statics.grantPrivilege = async function (
//   adminId,
//   privilege,
//   scope,
// ) {
//   // Prevent duplicate privilege for same admin, privilege, and scope
//   const exists = await this.findOne({ admin: adminId, privilege, scope });
//   if (exists) return exists;

//   return await this.create({
//     admin: adminId,
//     privilege,
//     scope,
//   });
// };

// /**
//  * Revokes a privilege from an admin.
//  * @param {mongoose.Types.ObjectId} adminId
//  * @param {string} privilege
//  * @param {string} scope
//  * @returns {Promise<Object>} Deletion result
//  */
// adminPrivilegeSchema.statics.revokePrivilege = async function (
//   adminId,
//   privilege,
//   scope,
// ) {
//   return await this.deleteOne({
//     admin: adminId,
//     privilege,
//     scope,
//   });
// };

// const AdminPrivilege = mongoose.model("AdminPrivilege", adminPrivilegeSchema);

// export default AdminPrivilege;

import mongoose from "mongoose";
import Admin from "./admin.model.js";

/**
 * AdminPrivilege Schema with case-insensitivity and better ID handling
 */
const adminPrivilegeSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.Mixed, // Allow either ObjectId OR string
      ref: "Admin",
      required: [true, "Admin reference is required"],
      index: true,
    },
    privilege: {
      type: [String],
      required: [true, "Privilege type is required"],
      enum: {
        values: [
          // User management
          "CREATE_ADMIN",
          "CREATE_HOD",
          "CREATE_FACULTY",
          "CREATE_STUDENT",
          "CREATE_STAFF",
          "EDIT_USER",
          "DELETE_USER",
          "VIEW_USER",
          // Department management
          "CREATE_DEPARTMENT",
          "EDIT_DEPARTMENT",
          "DELETE_DEPARTMENT",
          "VIEW_DEPARTMENT",
          // Course management
          "CREATE_COURSE",
          "EDIT_COURSE",
          "DELETE_COURSE",
          "VIEW_COURSE",
          // System management
          "SYSTEM_SETTINGS",
          "VIEW_LOGS",
          "BACKUP_DATA",
          // Add more as needed
        ],
        message: "{VALUE} is not a valid privilege type",
      },
    },
    scope: {
      type: String,
      required: true,
      default: "GLOBAL", // Can be "GLOBAL", or department ID strings
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Granting user reference is required"],
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
adminPrivilegeSchema.index({ admin: 1, scope: 1 });

/**
 * Static Method: Check if an admin has a given privilege for a scope.
 * Super admins bypass this check and return true.
 *
 * Fixed version with case-insensitive comparison and better ID handling
 */
adminPrivilegeSchema.statics.hasPrivilege = async function (
  adminId,
  privilege,
  scope = "GLOBAL",
) {
  // Log parameters for debugging
  console.log("hasPrivilege check:", {
    adminId: typeof adminId === "object" ? adminId.toString() : adminId,
    privilege,
    scope,
    adminIdType: typeof adminId,
  });

  // Find the admin to check if superadmin
  const admin = await Admin.findById(adminId);

  // SuperAdmin has all privileges
  if (admin?.isSuperAdmin) return true;

  // Convert IDs to strings for consistent comparison
  const adminIdString =
    typeof adminId === "object" ? adminId.toString() : adminId;

  // Also look up the user ID associated with this admin
  const adminRecord = await Admin.findById(adminId).populate("user");
  const userId = adminRecord?.user?._id;
  const userIdString = userId ? userId.toString() : null;

  console.log("Looking up privileges for admin:", adminIdString);
  if (userIdString) {
    console.log("Also looking up privileges for user:", userIdString);
  }

  // Convert scope to uppercase for case-insensitive comparison
  const scopeUpper =
    typeof scope === "string"
      ? scope.toUpperCase()
      : scope.toString().toUpperCase();

  // Query with multiple potential admin identifiers and check if privilege array includes the given privilege
  const query = {
    $or: [{ admin: adminIdString }, { admin: adminId }],
    privilege: privilege, // This still works because MongoDB `$in` applies to arrays
  };

  // Add user ID to query if available
  if (userIdString) {
    query.$or.push({ admin: userIdString });
    query.$or.push({ admin: userId });
  }

  // Use MongoDB `$in` to check for `privilege` inside array
  query.privilege = { $in: [privilege] };

  console.log("Query:", JSON.stringify(query));

  // Fetch all matching privilege documents
  const privileges = await this.find(query);
  console.log("Found privileges:", privileges);

  // Check if any match the scope (case-insensitive)
  const match = privileges.some((p) => {
    const privScopeUpper = p.scope.toUpperCase();
    return privScopeUpper === "GLOBAL" || privScopeUpper === scopeUpper;
  });

  console.log("Match result:", match);
  return match;
};

/**
 * Static Method: Grant a privilege to an admin if not already granted.
 */
adminPrivilegeSchema.statics.grantPrivilege = async function (
  adminId,
  privilege,
  scope = "GLOBAL",
  grantedBy,
) {
  // Convert IDs to strings for consistency
  const adminIdString =
    typeof adminId === "object" ? adminId.toString() : adminId;

  // Store scope as uppercase for consistency
  const scopeString = typeof scope === "string" ? scope : scope.toString();

  // Check if a document exists for this admin and scope
  let existing = await this.findOne({
    admin: adminIdString,
    scope: new RegExp(`^${scopeString}$`, "i"), // case-insensitive match
  });

  // If exists, update the privilege array only if it's not already included
  if (existing) {
    if (!existing.privilege.includes(privilege)) {
      existing.privilege.push(privilege);
      await existing.save();
    }
    return existing;
  }

  // Else, create a new document with the privilege inside an array
  return await this.create({
    admin: adminIdString,
    privilege: [privilege],
    scope: scopeString.toUpperCase(),
    grantedBy,
  });
};

/**
 * Static Method: Revoke a privilege from an admin.
 */
adminPrivilegeSchema.statics.revokePrivilege = async function (
  adminId,
  privilege,
  scope = "GLOBAL",
) {
  // Convert admin ID to string
  const adminIdString =
    typeof adminId === "object" ? adminId.toString() : adminId;

  const scopeUpper =
    typeof scope === "string"
      ? scope.toUpperCase()
      : scope.toString().toUpperCase();

  // Find the document for this admin and scope (case-insensitive)
  const record = await this.findOne({
    admin: adminIdString,
    scope: new RegExp(`^${scopeUpper}$`, "i"),
  });

  if (!record) {
    return { modifiedCount: 0, message: "No matching document found" };
  }

  // Remove the specified privilege from the array
  const initialLength = record.privilege.length;
  record.privilege = record.privilege.filter((p) => p !== privilege);

  if (record.privilege.length === 0) {
    // If no privileges left, delete the document
    await record.deleteOne();
    return {
      deletedCount: 1,
      message: "Privilege removed and document deleted",
    };
  }

  if (record.privilege.length < initialLength) {
    // If privileges were removed, save the document
    await record.save();
    return { modifiedCount: 1, message: "Privilege removed" };
  }

  return { modifiedCount: 0, message: "Privilege not found in array" };
};

const AdminPrivilege = mongoose.model("AdminPrivilege", adminPrivilegeSchema);
export default AdminPrivilege;
