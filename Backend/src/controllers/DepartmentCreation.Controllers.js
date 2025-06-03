import mongoose from "mongoose";
import User from "../models/user.model.js";
import Department from "../models/department.model.js";
import { Address } from "../models/address.model.js";
import Faculty from "../models/Faculty.Model.js";

import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

import dotenv from "dotenv";

dotenv.config();

// ============ DEPARTMENT MANAGEMENT FUNCTIONS ============

export const addDepartment = asyncHandler(async (req, res) => {
  const {
    code,
    name,
    hod,
    establishedYear,
    description,
    vision,
    mission,
    contactUser,
    address,
    building,
    floor,
    roomNumbers,
    affiliatedTo,
    accreditations,
    facilities,
    laboratories,
    budget,
  } = req.body;

  // Required field validation
  if (!code || !name || !establishedYear) {
    throw new ApiError(
      400,
      "Department code, name, and established year are required",
    );
  }

  // Check if department with same code already exists
  const existingDepartment = await Department.findOne({
    code: code.trim().toUpperCase(),
  });

  if (existingDepartment) {
    throw new ApiError(409, "Department with this code already exists");
  }

  // Validate established year
  const currentYear = new Date().getFullYear();
  if (establishedYear > currentYear || establishedYear < 1900) {
    throw new ApiError(
      400,
      `Established year must be between 1900 and ${currentYear}`,
    );
  }

  // Create new department
  const departmentData = {
    code: code.trim().toUpperCase(),
    name: name.trim(),
    establishedYear,
    status: "active",
  };

  // Add optional fields if provided
  if (hod) departmentData.hod = hod;
  if (description) departmentData.description = description.trim();
  if (vision) departmentData.vision = vision.trim();
  if (mission) departmentData.mission = mission.trim();
  if (contactUser) departmentData.contactUser = contactUser;
  if (address) departmentData.address = address;
  if (building) departmentData.building = building.trim();
  if (floor) departmentData.floor = floor.trim();
  if (roomNumbers && Array.isArray(roomNumbers)) {
    departmentData.roomNumbers = roomNumbers.map((room) => room.trim());
  }
  if (affiliatedTo) departmentData.affiliatedTo = affiliatedTo.trim();
  if (accreditations && Array.isArray(accreditations)) {
    departmentData.accreditations = accreditations;
  }
  if (facilities && Array.isArray(facilities)) {
    departmentData.facilities = facilities;
  }
  if (laboratories && Array.isArray(laboratories)) {
    departmentData.laboratories = laboratories;
  }
  if (budget) {
    departmentData.budget = {
      allocated: budget.allocated || 0,
      utilized: budget.utilized || 0,
      fiscalYear: budget.fiscalYear || undefined, // Will use default from schema
    };
  }

  const department = await Department.create(departmentData);

  // Populate references for response
  await department.populate([
    { path: "hod", select: "firstName lastName email" },
    { path: "contactUser", select: "firstName lastName email phone" },
    { path: "address" },
  ]);

  return res
    .status(201)
    .json(new ApiResponse(201, department, "Department created successfully"));
});

export const getAllDepartments = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    establishedYear,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  let query = {};

  // Search functionality
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // Status filter
  if (status !== "all") {
    query.status = status;
  }

  // Established year filter
  if (establishedYear) {
    query.establishedYear = parseInt(establishedYear);
  }

  // Sort options
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  const departments = await Department.find(query)
    .populate("hod", "firstName lastName email")
    .populate("contactUser", "firstName lastName email phone")
    .populate("address")
    .sort(sortOptions)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Department.countDocuments(query);

  // Get department statistics
  const stats = await Department.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        departments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
        statistics: stats,
      },
      "Departments retrieved successfully",
    ),
  );
});

export const getDepartmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let department;

  // Check if id is UUID or ObjectId
  if (id.length === 36) {
    // UUID format
    department = await Department.findOne({ uuid: id });
  } else {
    department = await Department.findById(id);
  }

  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  // Populate all references
  await department.populate([
    { path: "hod", select: "firstName lastName email phone" },
    { path: "faculty", select: "firstName lastName email" },
    { path: "contactUser", select: "firstName lastName email phone" },
    { path: "address" },
    { path: "programmes", select: "name code" },
    { path: "courses", select: "name code" },
    { path: "mergedTo", select: "name code" },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, department, "Department retrieved successfully"),
    );
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  let department;

  // Check if id is UUID or ObjectId
  if (id.length === 36) {
    // UUID format
    department = await Department.findOne({ uuid: id });
  } else {
    department = await Department.findById(id);
  }

  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  // Check for duplicate code if it's being changed
  if (updateData.code && updateData.code !== department.code) {
    const existingDepartment = await Department.findOne({
      _id: { $ne: department._id },
      code: updateData.code.trim().toUpperCase(),
    });

    if (existingDepartment) {
      throw new ApiError(409, "Department with this code already exists");
    }
  }

  // Validate established year if being updated
  if (updateData.establishedYear) {
    const currentYear = new Date().getFullYear();
    if (
      updateData.establishedYear > currentYear ||
      updateData.establishedYear < 1900
    ) {
      throw new ApiError(
        400,
        `Established year must be between 1900 and ${currentYear}`,
      );
    }
  }

  // Handle budget validation
  if (updateData.budget) {
    if (updateData.budget.utilized > updateData.budget.allocated) {
      throw new ApiError(400, "Utilized budget cannot exceed allocated budget");
    }
  }

  // Update fields
  Object.keys(updateData).forEach((key) => {
    if (key === "code" && updateData[key]) {
      department[key] = updateData[key].trim().toUpperCase();
    } else if (typeof updateData[key] === "string") {
      department[key] = updateData[key].trim();
    } else {
      department[key] = updateData[key];
    }
  });

  await department.save();

  // Populate references for response
  await department.populate([
    { path: "hod", select: "firstName lastName email" },
    { path: "contactUser", select: "firstName lastName email phone" },
    { path: "address" },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, department, "Department updated successfully"));
});

export const updateDepartmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, statusReason, mergedTo } = req.body;

  if (!status) {
    throw new ApiError(400, "Status is required");
  }

  const validStatuses = ["active", "inactive", "merged", "closed"];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, "Invalid status value");
  }

  let department;

  // Check if id is UUID or ObjectId
  if (id.length === 36) {
    // UUID format
    department = await Department.findOne({ uuid: id });
  } else {
    department = await Department.findById(id);
  }

  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  // If status is merged, mergedTo is required
  if (status === "merged" && !mergedTo) {
    throw new ApiError(
      400,
      "mergedTo department is required when status is merged",
    );
  }

  department.status = status;
  if (statusReason) department.statusReason = statusReason.trim();
  if (mergedTo) department.mergedTo = mergedTo;

  await department.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        department,
        "Department status updated successfully",
      ),
    );
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let department;

  // Check if id is UUID or ObjectId
  if (id.length === 36) {
    // UUID format
    department = await Department.findOne({ uuid: id });
  } else {
    department = await Department.findById(id);
  }

  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  // Check if department has associated records
  const facultyCount = department.faculty ? department.faculty.length : 0;
  const programmesCount = department.programmes
    ? department.programmes.length
    : 0;
  const coursesCount = department.courses ? department.courses.length : 0;

  if (facultyCount > 0 || programmesCount > 0 || coursesCount > 0) {
    throw new ApiError(
      400,
      "Cannot delete department with associated faculty, programmes, or courses. " +
        "Please transfer or remove them first.",
    );
  }

  await Department.findByIdAndDelete(department._id);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Department deleted successfully"));
});

// Get department statistics
export const getDepartmentStats = asyncHandler(async (req, res) => {
  const stats = await Department.aggregate([
    {
      $group: {
        _id: null,
        totalDepartments: { $sum: 1 },
        activeDepartments: {
          $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
        },
        inactiveDepartments: {
          $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
        },
        totalBudgetAllocated: { $sum: "$budget.allocated" },
        totalBudgetUtilized: { $sum: "$budget.utilized" },
      },
    },
  ]);

  const yearWiseStats = await Department.aggregate([
    {
      $group: {
        _id: "$establishedYear",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        overview: stats[0] || {},
        yearWise: yearWiseStats,
      },
      "Department statistics retrieved successfully",
    ),
  );
});
