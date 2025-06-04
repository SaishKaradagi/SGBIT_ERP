import mongoose from "mongoose";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { logger } from "../utils/logger.js";

// Import all models
import User from "../models/user.model.js";
import Department from "../models/department.model.js";
import Faculty from "../models/faculty.model.js";
import Student from "../models/student.model.js";
import Course from "../models/course.model.js";
import Batch from "../models/batch.model.js";
import Attendance from "../models/attendance.model.js";
import Exam from "../models/exam.model.js";
import FeePayment from "../models/feePayment.model.js";
import Event from "../models/event.model.js";
import Notice from "../models/notice.model.js";
import { Address } from "../models/address.model.js";

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

// ============ SUPER ADMIN DASHBOARD ANALYTICS ============

export const getDashboardOverview = asyncHandler(async (req, res) => {
  try {
    // Use Promise.allSettled for better error handling and performance
    const [
      userStats,
      departmentStats,
      academicStats,
      financialStats,
      systemHealth,
      recentActivities,
      criticalAlerts,
    ] = await Promise.allSettled([
      getUserStatistics(),
      getDepartmentStatistics(),
      getAcademicStatistics(),
      getFinancialStatistics(),
      getSystemHealthMetrics(),
      getRecentActivities(),
      getCriticalAlerts(),
    ]);

    // Handle any failed promises gracefully
    const response = {
      users:
        userStats.status === "fulfilled"
          ? userStats.value
          : { error: "Failed to load user stats" },
      departments:
        departmentStats.status === "fulfilled"
          ? departmentStats.value
          : { error: "Failed to load department stats" },
      academics:
        academicStats.status === "fulfilled"
          ? academicStats.value
          : { error: "Failed to load academic stats" },
      financials:
        financialStats.status === "fulfilled"
          ? financialStats.value
          : { error: "Failed to load financial stats" },
      systemHealth:
        systemHealth.status === "fulfilled"
          ? systemHealth.value
          : { error: "Failed to load system health" },
      recentActivities:
        recentActivities.status === "fulfilled" ? recentActivities.value : [],
      criticalAlerts:
        criticalAlerts.status === "fulfilled" ? criticalAlerts.value : [],
      lastUpdated: new Date().toISOString(),
    };

    // Log any failures for monitoring
    [
      userStats,
      departmentStats,
      academicStats,
      financialStats,
      systemHealth,
      recentActivities,
      criticalAlerts,
    ].forEach((result, index) => {
      if (result.status === "rejected") {
        logger.error(`Dashboard metric ${index} failed:`, result.reason);
      }
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          response,
          "Dashboard overview retrieved successfully",
        ),
      );
  } catch (error) {
    logger.error("Dashboard overview error:", error);
    throw new ApiError(500, "Failed to retrieve dashboard overview");
  }
});

// ============ USER MANAGEMENT STATISTICS ============

const getUserStatistics = async () => {
  const [
    totalUsers,
    usersByRole,
    activeUsers,
    recentRegistrations,
    inactiveUsers,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: { $ne: true } }),

    User.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    User.countDocuments({
      isActive: true,
      isDeleted: { $ne: true },
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
    }),

    User.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    }),

    User.countDocuments({
      isActive: false,
      isDeleted: { $ne: true },
    }),
  ]);

  // Get growth trends
  const growthTrend = await User.aggregate([
    {
      $match: {
        isDeleted: { $ne: true },
        createdAt: {
          $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
        }, // Last 6 months
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          role: "$role",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": -1, "_id.month": -1 } },
  ]);

  return {
    total: totalUsers,
    byRole: usersByRole.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    active: activeUsers,
    recentRegistrations,
    inactive: inactiveUsers,
    growthTrend,
  };
};

// ============ DEPARTMENT STATISTICS ============

const getDepartmentStatistics = async () => {
  const [
    totalDepartments,
    departmentsByStatus,
    departmentsWithoutHOD,
    budgetUtilization,
    facultyDistribution,
  ] = await Promise.all([
    Department.countDocuments(),

    Department.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    Department.countDocuments({ hod: null, status: "active" }),

    Department.aggregate([
      {
        $match: { status: "active", "budget.allocated": { $gt: 0 } },
      },
      {
        $project: {
          name: 1,
          allocated: "$budget.allocated",
          utilized: "$budget.utilized",
          utilizationPercentage: {
            $multiply: [
              { $divide: ["$budget.utilized", "$budget.allocated"] },
              100,
            ],
          },
        },
      },
      { $sort: { utilizationPercentage: -1 } },
    ]),

    Department.aggregate([
      {
        $lookup: {
          from: "faculties",
          localField: "_id",
          foreignField: "department",
          as: "facultyMembers",
        },
      },
      {
        $project: {
          name: 1,
          code: 1,
          facultyCount: { $size: "$facultyMembers" },
        },
      },
      { $sort: { facultyCount: -1 } },
    ]),
  ]);

  return {
    total: totalDepartments,
    byStatus: departmentsByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    withoutHOD: departmentsWithoutHOD,
    budgetUtilization,
    facultyDistribution,
  };
};

// ============ ACADEMIC STATISTICS ============

const getAcademicStatistics = async () => {
  const currentAcademicYear = getCurrentAcademicYear();

  const [
    totalStudents,
    totalFaculty,
    totalCourses,
    attendanceStats,
    examStats,
    batchStats,
  ] = await Promise.all([
    Student.countDocuments({ isActive: true }),
    Faculty.countDocuments({ isActive: true }),
    Course.countDocuments({ isActive: true }),

    // Attendance statistics
    Attendance.aggregate([
      {
        $match: {
          date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    // Recent exam statistics
    Exam.aggregate([
      {
        $match: {
          examDate: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: "$examType",
          count: { $sum: 1 },
          avgStudents: { $avg: { $size: "$students" } },
        },
      },
    ]),

    // Batch statistics
    Batch.aggregate([
      {
        $match: { isActive: true },
      },
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "batch",
          as: "students",
        },
      },
      {
        $group: {
          _id: "$academicYear",
          batchCount: { $sum: 1 },
          totalStudents: { $sum: { $size: "$students" } },
        },
      },
      { $sort: { _id: -1 } },
    ]),
  ]);

  return {
    students: totalStudents,
    faculty: totalFaculty,
    courses: totalCourses,
    attendance: attendanceStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    exams: examStats,
    batches: batchStats,
    currentAcademicYear,
  };
};

// ============ FINANCIAL STATISTICS ============

const getFinancialStatistics = async () => {
  const currentFiscalYear = getCurrentFiscalYear();

  const [
    totalFeeCollection,
    pendingFees,
    departmentBudgets,
    monthlyCollection,
  ] = await Promise.all([
    FeePayment.aggregate([
      {
        $match: {
          status: "completed",
          paymentDate: {
            $gte: new Date(`${currentFiscalYear.split("-")[0]}-04-01`),
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),

    FeePayment.aggregate([
      {
        $match: {
          status: { $in: ["pending", "overdue"] },
        },
      },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),

    Department.aggregate([
      {
        $match: { status: "active" },
      },
      {
        $group: {
          _id: null,
          totalAllocated: { $sum: "$budget.allocated" },
          totalUtilized: { $sum: "$budget.utilized" },
        },
      },
    ]),

    FeePayment.aggregate([
      {
        $match: {
          status: "completed",
          paymentDate: {
            $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$paymentDate" },
            month: { $month: "$paymentDate" },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
    ]),
  ]);

  return {
    totalCollection: totalFeeCollection[0] || { total: 0, count: 0 },
    pendingFees: pendingFees.reduce((acc, item) => {
      acc[item._id] = { total: item.total, count: item.count };
      return acc;
    }, {}),
    departmentBudgets: departmentBudgets[0] || {
      totalAllocated: 0,
      totalUtilized: 0,
    },
    monthlyTrend: monthlyCollection,
    currentFiscalYear,
  };
};

// ============ SYSTEM HEALTH METRICS ============

const getSystemHealthMetrics = async () => {
  const [dbStats, collectionStats, errorLogs] = await Promise.all([
    // Database statistics
    mongoose.connection.db.stats(),

    // Collection sizes
    Promise.all([
      User.estimatedDocumentCount(),
      Student.estimatedDocumentCount(),
      Faculty.estimatedDocumentCount(),
      Department.estimatedDocumentCount(),
      Course.estimatedDocumentCount(),
    ]).then(([users, students, faculty, departments, courses]) => ({
      users,
      students,
      faculty,
      departments,
      courses,
    })),

    // Recent error count (you'd implement this based on your logging system)
    getRecentErrorCount(),
  ]);

  return {
    database: {
      size: dbStats.dataSize,
      collections: dbStats.collections,
      indexes: dbStats.indexes,
      avgObjSize: dbStats.avgObjSize,
    },
    collections: collectionStats,
    errors: errorLogs,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version,
  };
};

// ============ RECENT ACTIVITIES ============

const getRecentActivities = async () => {
  const activities = [];
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Recent user registrations
  const recentUsers = await User.find({
    createdAt: { $gte: last24Hours },
    isDeleted: { $ne: true },
  })
    .select("firstName lastName role createdAt")
    .sort({ createdAt: -1 })
    .limit(10);

  recentUsers.forEach((user) => {
    activities.push({
      type: "user_registration",
      message: `New ${user.role} registered: ${user.firstName} ${user.lastName}`,
      timestamp: user.createdAt,
      severity: "info",
    });
  });

  // Recent department changes
  const recentDeptChanges = await Department.find({
    updatedAt: { $gte: last24Hours },
  })
    .select("name status updatedAt")
    .sort({ updatedAt: -1 })
    .limit(5);

  recentDeptChanges.forEach((dept) => {
    activities.push({
      type: "department_update",
      message: `Department ${dept.name} updated (Status: ${dept.status})`,
      timestamp: dept.updatedAt,
      severity: "info",
    });
  });

  return activities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20);
};

// ============ CRITICAL ALERTS ============

const getCriticalAlerts = async () => {
  const alerts = [];

  // Departments without HOD
  const deptWithoutHOD = await Department.countDocuments({
    hod: null,
    status: "active",
  });

  if (deptWithoutHOD > 0) {
    alerts.push({
      type: "department_hod_missing",
      message: `${deptWithoutHOD} active departments without HOD`,
      severity: "warning",
      count: deptWithoutHOD,
    });
  }

  // Overdue fee payments
  const overdueFees = await FeePayment.countDocuments({
    status: "overdue",
  });

  if (overdueFees > 0) {
    alerts.push({
      type: "overdue_fees",
      message: `${overdueFees} overdue fee payments`,
      severity: "critical",
      count: overdueFees,
    });
  }

  // Budget utilization over 90%
  const overUtilizedDepts = await Department.aggregate([
    {
      $match: {
        status: "active",
        "budget.allocated": { $gt: 0 },
      },
    },
    {
      $project: {
        name: 1,
        utilizationPercentage: {
          $multiply: [
            { $divide: ["$budget.utilized", "$budget.allocated"] },
            100,
          ],
        },
      },
    },
    {
      $match: { utilizationPercentage: { $gte: 90 } },
    },
  ]);

  if (overUtilizedDepts.length > 0) {
    alerts.push({
      type: "budget_overutilization",
      message: `${overUtilizedDepts.length} departments with >90% budget utilization`,
      severity: "warning",
      count: overUtilizedDepts.length,
      details: overUtilizedDepts,
    });
  }

  // Inactive users with recent login attempts
  const suspiciousActivity = await User.countDocuments({
    isActive: false,
    lastLoginAttempt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  if (suspiciousActivity > 0) {
    alerts.push({
      type: "suspicious_activity",
      message: `${suspiciousActivity} inactive users with recent login attempts`,
      severity: "critical",
      count: suspiciousActivity,
    });
  }

  return alerts;
};

// ============ HELPER FUNCTIONS ============

const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Academic year in India typically starts in June/July
  return month < 6 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
};

const getCurrentFiscalYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Indian fiscal year runs from April to March
  return month < 3 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
};

const getRecentErrorCount = async () => {
  // Implement based on your logging system
  // This is a placeholder that should integrate with your actual error logging
  return {
    last24Hours: 0,
    last7Days: 0,
    criticalErrors: 0,
  };
};

// ============ ADVANCED ANALYTICS ENDPOINTS ============

export const getDetailedUserAnalytics = asyncHandler(async (req, res) => {
  const { period = "30", role = "all" } = req.query;

  const days = parseInt(period);
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let matchCondition = {
    isDeleted: { $ne: true },
    createdAt: { $gte: dateFrom },
  };

  if (role !== "all") {
    matchCondition.role = role;
  }

  const analytics = await User.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          role: "$role",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        analytics,
        "Detailed user analytics retrieved successfully",
      ),
    );
});

export const getDepartmentPerformanceMetrics = asyncHandler(
  async (req, res) => {
    const metrics = await Department.aggregate([
      {
        $match: { status: "active" },
      },
      {
        $lookup: {
          from: "faculties",
          localField: "_id",
          foreignField: "department",
          as: "faculty",
        },
      },
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "department",
          as: "students",
        },
      },
      {
        $lookup: {
          from: "courses",
          localField: "_id",
          foreignField: "department",
          as: "courses",
        },
      },
      {
        $project: {
          name: 1,
          code: 1,
          establishedYear: 1,
          facultyCount: { $size: "$faculty" },
          studentCount: { $size: "$students" },
          courseCount: { $size: "$courses" },
          hasHOD: { $cond: [{ $ne: ["$hod", null] }, true, false] },
          budgetUtilization: {
            $cond: [
              { $eq: ["$budget.allocated", 0] },
              0,
              {
                $multiply: [
                  { $divide: ["$budget.utilized", "$budget.allocated"] },
                  100,
                ],
              },
            ],
          },
          studentToFacultyRatio: {
            $cond: [
              { $eq: [{ $size: "$faculty" }, 0] },
              0,
              { $divide: [{ $size: "$students" }, { $size: "$faculty" }] },
            ],
          },
        },
      },
      { $sort: { studentCount: -1 } },
    ]);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          metrics,
          "Department performance metrics retrieved successfully",
        ),
      );
  },
);

export const getSystemResourceUsage = asyncHandler(async (req, res) => {
  const resourceUsage = {
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    cpuUsage: process.cpuUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    database: {
      connectionState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    },
    collections: await getCollectionSizes(),
  };

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        resourceUsage,
        "System resource usage retrieved successfully",
      ),
    );
});

const getCollectionSizes = async () => {
  const collections = [
    "users",
    "departments",
    "faculties",
    "students",
    "courses",
  ];
  const sizes = {};

  for (const collection of collections) {
    try {
      const stats = await mongoose.connection.db.collection(collection).stats();
      sizes[collection] = {
        count: stats.count,
        size: stats.size,
        avgObjSize: stats.avgObjSize,
        indexCount: stats.nindexes,
      };
    } catch (error) {
      sizes[collection] = { error: "Unable to fetch stats" };
    }
  }

  return sizes;
};
