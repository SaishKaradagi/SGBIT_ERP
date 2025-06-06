import mongoose from 'mongoose';
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { logger } from "../utils/logger.js";
import User from "../models/user.model.js";
import Department from "../models/department.model.js";
import Faculty from "../models/faculty.model.js";
import Admin from "../models/admin.model.js";
import Student from "../models/student.model.js";

/**
 * Delete User Controller - Soft Delete Implementation
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUser = req.user;

  // Step 1: Find the user to delete
  let userToDelete = await findUserById(id);
  
  if (!userToDelete) {
    throw new ApiError(404, "User not found");
  }

  if (userToDelete.isDeleted) {
    throw new ApiError(400, "User is already deleted");
  }

  // Step 2: Get current user's complete profile with department info
  const currentUserProfile = await getCurrentUserProfile(currentUser);
  
  // Step 3: Get target user's department info
  const targetUserProfile = await getTargetUserProfile(userToDelete);

  // Step 4: Check permissions
  await checkDeletePermissions(currentUserProfile, targetUserProfile);

  // Step 5: Perform soft delete
  const deletedUser = await User.findByIdAndUpdate(
    userToDelete._id,
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: currentUser._id,
        status: 'terminated'
      }
    },
    { 
      new: true,
      runValidators: true
    }
  );

  if (!deletedUser) {
    throw new ApiError(500, "Failed to delete user");
  }

  // Step 6: Return response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        deletedUser: {
          id: deletedUser._id,
          uuid: deletedUser.uuid,
          name: deletedUser.fullName,
          email: deletedUser.email,
          role: deletedUser.role,
          isDeleted: deletedUser.isDeleted,
          deletedAt: deletedUser.deletedAt,
          status: deletedUser.status
        },
      },
      "User deleted successfully"
    )
  );
});

/**
 * Restore Deleted User Controller
 */
export const restoreUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUser = req.user;

  // Find the deleted user
  const userToRestore = await findUserById(id);
  
  if (!userToRestore) {
    throw new ApiError(404, "User not found");
  }

  if (!userToRestore.isDeleted) {
    throw new ApiError(400, "User is not deleted");
  }

  // Check permissions (only superadmin and admin can restore)
  if (!['superadmin', 'admin'].includes(currentUser.role.toLowerCase())) {
    throw new ApiError(403, "You don't have permission to restore users");
  }

  // Restore user
  const restoredUser = await User.findByIdAndUpdate(
    userToRestore._id,
    {
      $unset: {
        deletedAt: 1,
        deletedBy: 1
      },
      $set: {
        isDeleted: false,
        status: 'active'
      }
    },
    { 
      new: true,
      runValidators: true
    }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        restoredUser: {
          id: restoredUser._id,
          uuid: restoredUser.uuid,
          name: restoredUser.fullName,
          email: restoredUser.email,
          role: restoredUser.role,
          isDeleted: restoredUser.isDeleted,
          status: restoredUser.status
        },
      },
      "User restored successfully"
    )
  );
});

/**
 * Get All Deleted Users
 */
export const getDeletedUsers = asyncHandler(async (req, res) => {
  const currentUser = req.user;
  const { page = 1, limit = 10, role, department } = req.query;

  // Check permissions
  if (!['superadmin', 'admin'].includes(currentUser.role.toLowerCase())) {
    throw new ApiError(403, "You don't have permission to view deleted users");
  }

  // Build query
  const query = { isDeleted: true };
  
  if (role) {
    query.role = role;
  }

  // Execute query with pagination
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { deletedAt: -1 }
  };

  const deletedUsers = await User.find(query)
    .populate('deletedBy', 'fullName email role')
    .sort(options.sort)
    .limit(options.limit * 1)
    .skip((options.page - 1) * options.limit);

  const total = await User.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        deletedUsers: deletedUsers.map(user => ({
          id: user._id,
          uuid: user.uuid,
          name: user.fullName,
          email: user.email,
          role: user.role,
          deletedAt: user.deletedAt,
          deletedBy: user.deletedBy,
          status: user.status
        })),
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalUsers: total,
          hasNext: options.page < Math.ceil(total / options.limit),
          hasPrev: options.page > 1
        }
      },
      "Deleted users retrieved successfully"
    )
  );
});

/**
 * Permanently Delete User (Hard Delete)
 */
export const permanentlyDeleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUser = req.user;

  // Only superadmin can permanently delete
  if (currentUser.role.toLowerCase() !== 'superadmin') {
    throw new ApiError(403, "Only super admin can permanently delete users");
  }

  const userToDelete = await findUserById(id);
  
  if (!userToDelete) {
    throw new ApiError(404, "User not found");
  }

  // User should be soft deleted first
  if (!userToDelete.isDeleted) {
    throw new ApiError(400, "User must be soft deleted before permanent deletion");
  }

  // Store user info before deletion
  const deletedUserInfo = {
    id: userToDelete._id,
    uuid: userToDelete.uuid,
    name: userToDelete.fullName,
    email: userToDelete.email,
    role: userToDelete.role
  };

  // Use MongoDB session for atomic transaction
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const userId = userToDelete._id;
      const userRole = userToDelete.role.toLowerCase();

      // Step 1: Delete from role-specific schema based on user's role
      let roleSpecificDeletion = null;
      
      switch (userRole) {
        case 'admin':
        case 'superadmin':
          // Delete from Admin schema
          roleSpecificDeletion = await Admin.findOneAndDelete(
            { userId: userId }, 
            { session }
          );
          
          // Handle admin-specific cleanup
          await handleAdminCleanup(userId, session);
          break;
          
        case 'faculty':
        case 'hod':
          // Delete from Faculty schema
          roleSpecificDeletion = await Faculty.findOneAndDelete(
            { userId: userId }, 
            { session }
          );
          
          // Handle faculty-specific cleanup
          await handleFacultyCleanup(userId, session);
          break;
          
        case 'student':
          // Delete from Student schema
          roleSpecificDeletion = await Student.findOneAndDelete(
            { userId: userId }, 
            { session }
          );
          
          // Handle student-specific cleanup
          await handleStudentCleanup(userId, session);
          break;
          
        default:
          throw new ApiError(400, `Unknown user role: ${userRole}`);
      }

      // Step 2: Delete from main User schema
      await User.findByIdAndDelete(userId, { session });
      
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          deletedUser: deletedUserInfo,
          message: `${deletedUserInfo.role} user and all related data permanently deleted successfully`
        },
        "User permanently deleted successfully"
      )
    );

  } catch (error) {
    console.error('Error during permanent user deletion:', error);
    throw new ApiError(500, `Failed to permanently delete ${userToDelete.role} user`);
  } finally {
    await session.endSession();
  }
});

// ============================================================================
// ROLE-SPECIFIC CLEANUP FUNCTIONS
// ============================================================================

// Admin/SuperAdmin cleanup
const handleAdminCleanup = async (userId, session) => {
  try {

    await Admin.deleteMany({ user: userId }, { session })

    // if needed add other remove statements
    
    console.log(`Admin cleanup completed for user: ${userId}`);
  } catch (error) {
    console.error('Admin cleanup failed:', error);
    throw error;
  }
};

// Faculty/HOD cleanup
const handleFacultyCleanup = async (userId, session) => {
  try {
    // Delete courses taught by this faculty
    
    
    
    
    await Faculty.deleteMany({ user: userId }, { session })
    
    console.log(`Faculty cleanup completed for user: ${userId}`);
  } catch (error) {
    console.error('Faculty cleanup failed:', error);
    throw error;
  }
};

// Student cleanup
const handleStudentCleanup = async (userId, session) => {
  try {
    await Student.deleteMany({ user: userId }, { session })
    
    
    // if anywhere else referred come and add here
    
    console.log(`Student cleanup completed for user: ${userId}`);
  } catch (error) {
    console.error('Student cleanup failed:', error);
    throw error;
  }
};

// ============================================================================
// ENHANCED VERSION WITH ROLE VALIDATION
// ============================================================================

export const permanentlyDeleteUserEnhanced = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUser = req.user;

  // Only superadmin can permanently delete
  if (currentUser.role.toLowerCase() !== 'superadmin') {
    throw new ApiError(403, "Only super admin can permanently delete users");
  }

  const userToDelete = await findUserById(id);
  
  if (!userToDelete) {
    throw new ApiError(404, "User not found");
  }

  // User should be soft deleted first
  if (!userToDelete.isDeleted) {
    throw new ApiError(400, "User must be soft deleted before permanent deletion");
  }

  // Prevent deleting the current user
  if (userToDelete._id.toString() === currentUser._id.toString()) {
    throw new ApiError(400, "Cannot delete your own account");
  }

  // Store user info before deletion
  const deletedUserInfo = {
    id: userToDelete._id,
    uuid: userToDelete.uuid,
    name: userToDelete.fullName,
    email: userToDelete.email,
    role: userToDelete.role
  };

  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const userId = userToDelete._id;
      const userRole = userToDelete.role.toLowerCase();

      // Validate role-specific schema exists
      const roleValidation = await validateRoleSpecificData(userId, userRole, session);
      
      if (!roleValidation.exists) {
        console.warn(`No ${userRole} record found for user ${userId}`);
      }

      // Delete from role-specific schema
      let deletionResult = null;
      
      switch (userRole) {
        case 'admin':
        case 'superadmin':
          deletionResult = await deleteAdminUser(userId, session);
          break;
          
        case 'faculty':
        case 'hod':
          deletionResult = await deleteFacultyUser(userId, session);
          break;
          
        case 'student':
          deletionResult = await deleteStudentUser(userId, session);
          break;
          
        default:
          throw new ApiError(400, `Unknown user role: ${userRole}`);
      }

      // Delete from main User schema
      await User.findByIdAndDelete(userId, { session });
      
      // Create comprehensive audit log
      await AuditLog.create([{
        action: 'USER_PERMANENTLY_DELETED',
        performedBy: currentUser._id,
        targetUser: userId,
        details: {
          deletedUser: deletedUserInfo,
          roleSpecificDeletion: deletionResult,
          timestamp: new Date(),
          deletedBy: {
            id: currentUser._id,
            name: currentUser.fullName,
            email: currentUser.email
          }
        }
      }], { session });
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          deletedUser: deletedUserInfo,
          message: `${deletedUserInfo.role} permanently deleted with all associated data`
        },
        "User permanently deleted successfully"
      )
    );

  } catch (error) {
    console.error('Error during permanent user deletion:', error);
    throw new ApiError(
      500, 
      `Failed to permanently delete ${userToDelete.role}: ${error.message}`
    );
  } finally {
    await session.endSession();
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const validateRoleSpecificData = async (userId, role, session) => {
  switch (role) {
    case 'admin':
    case 'superadmin':
      const admin = await Admin.findOne({ userId }, null, { session });
      return { exists: !!admin, data: admin };
      
    case 'faculty':
    case 'hod':
      const faculty = await Faculty.findOne({ userId }, null, { session });
      return { exists: !!faculty, data: faculty };
      
    case 'student':
      const student = await Student.findOne({ userId }, null, { session });
      return { exists: !!student, data: student };
      
    default:
      return { exists: false, data: null };
  }
};

const deleteAdminUser = async (userId, session) => {
  const adminData = await Admin.findOneAndDelete({ userId }, { session });
  await handleAdminCleanup(userId, session);
  return { adminDeleted: !!adminData, adminData };
};

const deleteFacultyUser = async (userId, session) => {
  const facultyData = await Faculty.findOneAndDelete({ userId }, { session });
  await handleFacultyCleanup(userId, session);
  return { facultyDeleted: !!facultyData, facultyData };
};

const deleteStudentUser = async (userId, session) => {
  const studentData = await Student.findOneAndDelete({ userId }, { session });
  await handleStudentCleanup(userId, session);
  return { studentDeleted: !!studentData, studentData };
};

// ============ HELPER FUNCTIONS ============



/**
 * Find user by ID (supports both UUID and ObjectId)
 */
async function findUserById(id) {
  let user;
  
  // Check if it's a UUID (36 characters) or ObjectId (24 characters)
  if (id.length === 36) {
    user = await User.findOne({ uuid: id });
  } else if (mongoose.Types.ObjectId.isValid(id)) {
    user = await User.findById(id);
  } else {
    throw new ApiError(400, "Invalid user ID format");
  }
  
  return user;
}

/**
 * Get current user's complete profile with department information
 */
async function getCurrentUserProfile(currentUser) {
  const profile = {
    _id: currentUser._id,
    role: currentUser.role,
    departments: [],
    isSuperAdmin: false
  };

  switch (currentUser.role.toLowerCase()) {
    case 'superadmin':
      profile.isSuperAdmin = true;
      break;
      
    case 'admin':
      const admin = await Admin.findOne({ user: currentUser._id })
        .populate('departmentScope', '_id departmentCode departmentName');
      
      if (!admin) {
        throw new ApiError(403, "Admin profile not found");
      }
      
      profile.isSuperAdmin = admin.isSuperAdmin;
      profile.departments = admin.departmentScope || [];
      break;
      
    case 'hod':
    case 'faculty':
      const faculty = await Faculty.findOne({ user: currentUser._id })
        .populate('department', '_id departmentCode departmentName');
      
      if (!faculty) {
        throw new ApiError(403, "Faculty profile not found");
      }
      
      profile.departments = faculty.department ? [faculty.department] : [];
      profile.isHOD = currentUser.role.toLowerCase() === 'hod';
      break;
      
    default:
      throw new ApiError(403, "You don't have permission to delete users");
  }

  return profile;
}

/**
 * Get target user's department information
 */
async function getTargetUserProfile(targetUser) {
  const profile = {
    _id: targetUser._id,
    role: targetUser.role,
    department: null
  };

  switch (targetUser.role.toLowerCase()) {
    case 'admin':
      const admin = await Admin.findOne({ user: targetUser._id })
        .populate('departmentScope', '_id departmentCode departmentName');
      profile.departments = admin?.departmentScope || [];
      profile.isSuperAdmin = admin?.isSuperAdmin || false;
      break;
      
    case 'hod':
    case 'faculty':
      const faculty = await Faculty.findOne({ user: targetUser._id })
        .populate('department', '_id departmentCode departmentName');
      profile.department = faculty?.department || null;
      break;
      
    case 'student':
      const student = await Student.findOne({ user: targetUser._id })
        .populate('department', '_id departmentCode departmentName');
      profile.department = student?.department || null;
      break;
      
    default:
      // For roles like staff, accountant, librarian, etc.
      break;
  }

  return profile;
}

/**
 * Check if current user has permission to delete target user
 */
async function checkDeletePermissions(currentUserProfile, targetUserProfile) {
  const currentRole = currentUserProfile.role.toLowerCase();
  const targetRole = targetUserProfile.role.toLowerCase();

  // Define role hierarchy for comparison
  const roleHierarchy = {
    superadmin: 4,
    admin: 3,
    hod: 2,
    faculty: 1,
    student: 0,
    staff: 0,
    accountant: 0,
    librarian: 0,
    guest: 0,
    studentguardian: 0
  };

  const currentLevel = roleHierarchy[currentRole];
  const targetLevel = roleHierarchy[targetRole];

  // SuperAdmin can delete anyone (including other superadmins)
  if (currentUserProfile.isSuperAdmin) {
    return true;
  }

  // Admin permissions
  if (currentRole === 'admin') {
    // Admin cannot delete superadmins
    if (targetUserProfile.isSuperAdmin) {
      throw new ApiError(403, "You cannot delete a super admin");
    }
    
    // Admin cannot delete users of equal or higher level (except they can delete other admins from their departments)
    if (targetLevel > currentLevel) {
      throw new ApiError(403, "You don't have permission to delete this user");
    }
    
    // Check department scope for admin
    if (['hod', 'faculty', 'student'].includes(targetRole)) {
      if (!targetUserProfile.department) {
        throw new ApiError(400, "Target user has no department assigned");
      }
      
      const adminDepartmentIds = currentUserProfile.departments.map(d => d._id.toString());
      const targetDepartmentId = targetUserProfile.department._id.toString();
      
      if (!adminDepartmentIds.includes(targetDepartmentId)) {
        throw new ApiError(403, "You can only delete users from your assigned departments");
      }
    }
    
    // Admin can delete other admins only if they're from the same departments
    if (targetRole === 'admin') {
      if (!targetUserProfile.departments || targetUserProfile.departments.length === 0) {
        throw new ApiError(403, "Cannot delete admin without department scope");
      }
      
      const currentDeptIds = currentUserProfile.departments.map(d => d._id.toString());
      const targetDeptIds = targetUserProfile.departments.map(d => d._id.toString());
      
      const hasCommonDepartment = targetDeptIds.some(id => currentDeptIds.includes(id));
      
      if (!hasCommonDepartment) {
        throw new ApiError(403, "You can only delete admins from your departments");
      }
    }
    
    return true;
  }

  // HOD permissions
  if (currentRole === 'hod') {
    // HOD can only delete faculty and students
    if (!['faculty', 'student'].includes(targetRole)) {
      throw new ApiError(403, "HOD can only delete faculty and students");
    }
    
    // Check if target user is from HOD's department
    if (!targetUserProfile.department) {
      throw new ApiError(400, "Target user has no department assigned");
    }
    
    if (!currentUserProfile.departments || currentUserProfile.departments.length === 0) {
      throw new ApiError(400, "HOD department not found");
    }
    
    const hodDepartmentId = currentUserProfile.departments[0]._id.toString();
    const targetDepartmentId = targetUserProfile.department._id.toString();
    
    if (hodDepartmentId !== targetDepartmentId) {
      throw new ApiError(403, "You can only delete users from your department");
    }
    
    return true;
  }

  // No other roles have delete permissions
  throw new ApiError(403, "You don't have permission to delete users");
}