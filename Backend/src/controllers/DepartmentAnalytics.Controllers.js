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


// ============ USER MANAGEMENT STATISTICS ============

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
      getUserStatistics(req, res, true),        // Add true flag
      getDepartmentStatistics(req, res, true),  // Add true flag
      getAcademicStatistics(req, res, true),   // Add true flag
      getFinancialStatistics(req, res, true),  // Add true flag
      getSystemHealthMetrics(req, res, true),  // Add true flag
      getRecentActivities(req, res, true),     // Add true flag
      getCriticalAlerts(req, res, true),       // Add true flag
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

export const getUserStatistics = async (req, res) => {
  try {
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
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),

      User.countDocuments({
        isDeleted: { $ne: true },
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),

      User.countDocuments({
        isActive: false,
        isDeleted: { $ne: true },
      }),
    ]);

    const growthTrend = await User.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          createdAt: {
            $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
          },
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

    const response = {
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

    return res
      .status(200)
      .json(new ApiResponse(200, response, "User statistics retrieved successfully"));
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to retrieve user statistics"));
  }
};

// ============ DEPARTMENT STATISTICS ============


export const getDepartmentStatistics = async (req, res, returnDataOnly) => {
  try {
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

    let responseData = {
      total: totalDepartments,
      byStatus: departmentsByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      withoutHOD: departmentsWithoutHOD,
      budgetUtilization,
      facultyDistribution,
    };

    // If called from dashboard, return data directly
    if(returnDataOnly==true){
      return responseData;
    }else{
        returnDataOnly=false;
    }
    
    

    // Otherwise, send HTTP response as usual
    const response = new ApiResponse(200, responseData);
    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    
    // If called from dashboard, throw error to be caught by Promise.allSettled
    if (returnDataOnly) {
      throw error;
    }
    
    // Otherwise, send HTTP error response
    const errorResponse = new ApiResponse(500, null, "Internal Server Error");
    return res.status(500).json(errorResponse);
  }
};

// ============ ACADEMIC STATISTICS ============

export const getAcademicStatistics = async () => {
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

export const getFinancialStatistics = async (req, res) => {
  try {
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

    const response = {
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

    return res
      .status(200)
      .json(new ApiResponse(200, response, "Financial statistics retrieved successfully"));
  } catch (error) {
    console.error("Error fetching financial statistics:", error);
    return res.status(500).json(new ApiResponse(500, null, "Failed to retrieve financial statistics"));
  }
};

// ============ SYSTEM HEALTH METRICS ============

export const getSystemHealthMetrics = async (req, res) => {
  try {
    const [dbStats, collectionStats, errorLogs] = await Promise.all([
      mongoose.connection.db.stats(),

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

      getRecentErrorCount(),
    ]);

    const response = {
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

    return res
      .status(200)
      .json(new ApiResponse(200, response, "System health metrics retrieved successfully"));
  } catch (error) {
    console.error("Error fetching system health metrics:", error);
    return res.status(500).json(new ApiResponse(500, null, "Failed to retrieve system health metrics"));
  }
};

// ============ RECENT ACTIVITIES ============

export const getRecentActivities = async (req, res) => {
  try {
    const activities = [];
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

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

    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 20);

    return res
      .status(200)
      .json(new ApiResponse(200, sortedActivities, "Recent activities fetched successfully"));
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    return res.status(500).json(new ApiResponse(500, null, "Failed to fetch recent activities"));
  }
};

// ============ CRITICAL ALERTS ============


export const getCriticalAlerts = async (req, res) => {
  try {
    const alerts = [];

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

    return res.status(200).json(new ApiResponse(200, alerts, "Critical alerts fetched successfully"));
  } catch (error) {
    console.error("Error fetching critical alerts:", error);
    return res.status(500).json(new ApiResponse(500, null, "Failed to fetch critical alerts"));
  }
};


// ============ HELPER FUNCTIONS ============

export const getCurrentAcademicYear = (req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const academicYear = month < 6 ? `${year - 1}-${year}` : `${year}-${year + 1}`;

  return res.status(200).json(new ApiResponse(200, academicYear));
};


export const getCurrentFiscalYear = (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Indian fiscal year runs from April (3) to March (2)
    const fiscalYear = month < 3 ? `${year - 1}-${year}` : `${year}-${year + 1}`;

    return res
      .status(200)
      .json(new ApiResponse(200, { fiscalYear }, "Current fiscal year retrieved successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to retrieve current fiscal year"));
  }
};

export const getRecentErrorCount = async (req, res) => {
  try {
    // Your existing logic or call to fetch error counts
    const errorStats = {
      last24Hours: 0,
      last7Days: 0,
      criticalErrors: 0,
    };

    return res
      .status(200)
      .json(new ApiResponse(200, errorStats, "Recent error counts retrieved successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Failed to retrieve recent error counts"));
  }
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
});//done

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
    collections: await getCollectionSizes(req,res,true),
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


export const getCollectionSizes = async (req, res, returnDataOnly) => {
  const collections = [
    { name: "users", model: mongoose.model("User") },
    { name: "departments", model: mongoose.model("Department") },
    { name: "faculties", model: mongoose.model("Faculty") },
    { name: "students", model: mongoose.model("Student") },
    { name: "courses", model: mongoose.model("Course") },
  ];

  const sizes = {};
  for (const collection of collections) {
    try {
      const count = await collection.model.countDocuments();
      sizes[collection.name] = {
        count,

      };
    } catch (error) {
      console.error(`Error fetching stats for ${collection.name}:`, error);
      sizes[collection.name] = { error: "Unable to fetch stats" };
    }
  }

  if(returnDataOnly==true){
      return {sizes};
    }else{
        returnDataOnly=false;
    }

  return res
    .status(200)
    .json(new ApiResponse(200, sizes, "Collection statistics retrieved successfully"));
};