import mongoose from "mongoose";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { logger } from "../utils/logger.js";

// Import all models
import User from "../models/user.model.js";
import Department from "../models/department.model.js";
import Faculty from "../models/faculty.model.js";
import Admin from "../models/admin.model.js";
import Student from "../models/student.model.js";

import dotenv from "dotenv";

dotenv.config();

// ============ LIST ALL USERS BY ROLE ============

// 1) Get All HODs
export const getAllHODs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  let query = {
    designation: "HOD",
    isActive: true // Faculty's active status
  };

  // Search functionality - searching in populated user fields
  let searchQuery = {};
  if (search) {
    searchQuery = {
      $or: [
        { facultyId: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        // These will work because of the pre-populate middleware in your schema
        { "user.firstName": { $regex: search, $options: "i" } },
        { "user.lastName": { $regex: search, $options: "i" } },
        { "user.email": { $regex: search, $options: "i" } }
      ]
    };
    query = { ...query, ...searchQuery };
  }

  // Status filter for faculty status
  if (status !== "all") {
    query.status = status === "active" ? "active" : { $ne: "active" };
  }

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  const hods = await Faculty.find(query)
    .populate("user", "firstName middleName lastName email phone dateOfBirth gender -password -refreshToken")
    .populate("department", "name code")
    .populate("permanentAddress")
    .populate("currentAddress")
    .sort(sortOptions)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Faculty.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        hods,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
      "HODs retrieved successfully",
    ),
  );
});

// 2) Get All Admins
// Your corrected getAllAdmins function:
export const getAllAdmins = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  let query = {};

  if (search) {
    query.$or = [
      { uuid: { $regex: search, $options: "i" } },
      { designation: { $regex: search, $options: "i" } },
    ];
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  try {
    const admins = await Admin.find(query)
      .populate("user", "fullName email role phone dateOfBirth gender") // FIXED: Only inclusion
      .populate("departmentScope", "name code")
      .populate("privileges")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Admin.countDocuments(query);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          admins,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: parseInt(limit),
          },
        },
        "Admins retrieved successfully",
      ),
    );

  } catch (error) {
    console.error("Error in getAllAdmins:", error);
    throw error;
  }
});

// ============ DEPARTMENT-SPECIFIC USER QUERIES ============

// 3) Get Department HOD
export const getDepartmentHOD = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let department;

  // Identify by UUID or ObjectId
  if (id.length === 36) {
    department = await Department.findOne({ uuid: id }).populate("hod");
  } else {
    department = await Department.findById(id).populate("hod");
  }

  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        department: {
          id: department._id,
          name: department.name,
          code: department.code,
        },
        hod: department.hod || null,
      },
      department.hod
        ? "Department HOD retrieved successfully"
        : "No HOD assigned to this department"
    )
  );
});


// 4) Get Department Admin
export const getDepartmentAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let department;

  // Check if id is UUID or ObjectId
  if (id.length === 36) {
    department = await Department.findOne({ uuid: id });
  } else {
    department = await Department.findById(id);
  }

  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  const admin = await Admin.findOne({
    departmentScope: department._id,
    isDeleted: { $ne: true },
  })
    .populate("departmentScope", "name code")
    .select("-password -refreshToken");

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        department: {
          id: department._id,
          name: department.name,
          code: department.code,
        },
        admin,
      },
      admin
        ? "Department admin retrieved successfully"
        : "No admin assigned to this department"
    )
  );
});


// ============ USER UPDATES ============

// 5) Update Admin Details
export const updateAdminDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  let admin;

  // Check if id is UUID or ObjectId
  if (id.length === 36) {
    admin = await Admin.findOne({ uuid: id });
  } else {
    admin = await Admin.findById(id);
  }

  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  // Fields that can be updated
  const allowedUpdates = [
    "designation", "departmentScope", "isSuperAdmin", "isActive", "joinDate", "profileImage"
  ];

  // Validate update fields
  const updateKeys = Object.keys(updateData);
  const isValidUpdate = updateKeys.every(key => allowedUpdates.includes(key));

  if (!isValidUpdate) {
    throw new ApiError(400, "Invalid update fields");
  }

  // Apply updates
  updateKeys.forEach((key) => {
    if (typeof updateData[key] === "string") {
      admin[key] = updateData[key].trim();
    } else {
      admin[key] = updateData[key];
    }
  });

  await admin.save();

  // Populate department references for clarity
  await admin.populate("departmentScope", "name code");

  return res.status(200).json(
    new ApiResponse(
      200,
      { admin },
      "Admin details updated successfully"
    )
  );
});


// ============ DEPARTMENT-BASED LISTS ============

// 6) Get Department Faculty

export const getDepartmentFaculty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    sortBy = "firstName",
    sortOrder = "asc",
  } = req.query;

  let department;

  if (id.length === 36) {
    department = await Department.findOne({ uuid: id });
  } else {
    department = await Department.findById(id);
  }

  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  // Build search query
  let query = {
    department: department._id,
    isDeleted: { $ne: true }
  };

  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { employeeId: { $regex: search, $options: "i" } }
    ];
  }

  if (status !== "all") {
    query.isActive = status === "active";
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  const faculty = await Faculty.find(query)
    .populate("department", "name code")
    .select("-password -refreshToken")
    .sort(sortOptions)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Faculty.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        department: {
          id: department._id,
          name: department.name,
          code: department.code
        },
        faculty,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
      "Department faculty retrieved successfully"
    )
  );
});


// 7) Get Department Students

export const getDepartmentStudents = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = 10,
    semester,
    year,
    search = "",
    status = "all",
    sortBy = "rollNumber",
    sortOrder = "asc",
  } = req.query;

  let department;

  if (id.length === 36) {
    department = await Department.findOne({ uuid: id });
  } else {
    department = await Department.findById(id);
  }

  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  // Build query
  let query = {
    department: department._id,
    isDeleted: { $ne: true }
  };

  if (semester) {
    query.semester = parseInt(semester);
  }

  if (year) {
    query.academicYear = year;
  }

  if (status !== "all") {
    query.isActive = status === "active";
  }

  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { studentId: { $regex: search, $options: "i" } },
      { rollNumber: { $regex: search, $options: "i" } },
    ];
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  const students = await Student.find(query)
    .populate("department", "name code")
    .select("-password -refreshToken")
    .sort(sortOptions)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Student.countDocuments(query);

  const semesterStats = await Student.aggregate([
    {
      $match: {
        department: department._id,
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: "$semester",
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        department: {
          id: department._id,
          name: department.name,
          code: department.code,
        },
        students,
        semesterStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
      "Department students retrieved successfully"
    )
  );
});


// ============ USER MANAGEMENT ============




// 9) Update User Status (Activate/Deactivate)
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const currentUser = req.user;

  const validStatuses = ["active", "not_active", "pending"];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, "Invalid status value");
  }

  let userToUpdate;

  // Find by UUID or ObjectId
  if (id.length === 36) {
    userToUpdate = await User.findOne({ uuid: id });
  } else {
    userToUpdate = await User.findById(id);
  }

  if (!userToUpdate) {
    throw new ApiError(404, "User not found");
  }

  // Permission check
  const roleHierarchy = {
    superAdmin: 4,
    admin: 3,
    hod: 2,
    faculty: 1,
    student: 0
  };

  const currentUserLevel = roleHierarchy[currentUser.role];
  const targetUserLevel = roleHierarchy[userToUpdate.role];

  if (currentUserLevel === undefined || targetUserLevel === undefined) {
    throw new ApiError(400, "Invalid role");
  }

  if (currentUser.role !== "superAdmin" && targetUserLevel >= currentUserLevel) {
    throw new ApiError(403, "You don't have permission to update this user's status");
  }

  // Update status
  userToUpdate.status = status;
  await userToUpdate.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          id: userToUpdate._id,
          name: `${userToUpdate.firstName} ${userToUpdate.lastName}`,
          role: userToUpdate.role,
          status: userToUpdate.status
        }
      },
      `User status updated to '${status}' successfully`
    )
  );
});


// 10) Get All Users with Filters
export const getAllUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    role,
    department,
    status = "all",
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Build filter query
  let query = {
    isDeleted: { $ne: true }
  };

  // Role filter
  if (role) {
    query.role = role;
  }

  // Department filter - check your User schema for the correct field name
  if (department) {
    // Try these based on common field names:
    // query.department = department;           // if field is 'department'
    // query.departments = department;          // if field is 'departments' (array)
    // query.departmentId = department;         // if field is 'departmentId'
    // query.primaryDepartment = department;    // if field is 'primaryDepartment'
    
    // For now, let's assume it's 'departmentId' - adjust based on your schema
    query.departmentId = department;
  }

  // Status filter
  if (status !== "all") {
    query.isActive = status === "active";
  }

  // Search functionality
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { employeeId: { $regex: search, $options: "i" } },
      { studentId: { $regex: search, $options: "i" } }
    ];
  }

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  try {
    // Debug: First check what fields exist in your User schema
    console.log("User schema paths:", Object.keys(User.schema.paths));

    const users = await User.find(query)
      // Remove populate lines that don't match your schema
      // .populate("department", "name code")      // Remove this if 'department' field doesn't exist
      // .populate("departments", "name code")     // Remove this if 'departments' field doesn't exist
      
      // Add the correct populate based on your actual schema:
      // .populate("departmentId", "name code")    // if your field is 'departmentId'
      // .populate("departments", "name code")     // if your field is 'departments' (array)
      // .populate("primaryDepartment", "name code") // if your field is 'primaryDepartment'
      
      .select("-password -refreshToken")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    // Get role-wise statistics
    const roleStats = await User.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      }
    ]);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          users,
          roleStats,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: parseInt(limit),
          },
        },
        "Users retrieved successfully",
      ),
    );

  } catch (error) {
    console.error("Error in getAllUsers:", error);
    throw error;
  }
});

// 11) Get User by ID
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let user;

  // Check if id is UUID or ObjectId
  if (id.length === 36) {
    user = await User.findOne({ 
      uuid: id,
      isDeleted: { $ne: true }
    });
  } else {
    user = await User.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });
  }

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // // Populate references
  // await user.populate([
  //   { path: "department", select: "name code" },
  //   { path: "departments", select: "name code" }
  // ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      { user },
      "User retrieved successfully",
    ),
  );
});