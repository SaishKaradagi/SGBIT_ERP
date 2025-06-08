import { getScopedDepartmentId } from "../utils/getScopedDepartmentId.js"; // or your own helper
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
import Admin from "../models/admin.model.js";
import { getCurrentFiscalYear } from "./DepartmentAnalytics.Controllers.js";
import { getCurrentAcademicYear } from "./DepartmentAnalytics.Controllers.js";

import dotenv from "dotenv";
import { get } from "http";

dotenv.config();
export const getMyDepartmentStatistics = async (req, res) => {
  try {
    const departmentId = getScopedDepartmentId(req); // or req.user.department

    const department = await Department.findById(departmentId)
      .populate("hod", "name email")
      .lean();

    if (!department) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Department not found"));
    }

    // Budget Utilization
    const allocated = department.budget?.allocated || 0;
    const utilized = department.budget?.utilized || 0;
    const utilizationPercentage =
      allocated > 0 ? (utilized / allocated) * 100 : 0;

    // Faculty Count
    const facultyCount = await Faculty.countDocuments({
      department: departmentId,
    });

    // Response Payload
    const responseData = {
      name: department.name,
      code: department.code,
      hod: department.hod || null,
      budget: {
        allocated,
        utilized,
        utilizationPercentage: Number(utilizationPercentage.toFixed(2)),
      },
      facultyCount,
      status: department.status,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          responseData,
          "Department statistics retrieved successfully",
        ),
      );
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error"));
  }
};

export const getMyDepartmentUserAnalytics = asyncHandler(async (req, res) => {
  const { period = "30", role = "all" } = req.query;
  const days = parseInt(period);
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const departmentId = getScopedDepartmentId(req);

  if (!mongoose.Types.ObjectId.isValid(departmentId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid department ID"));
  }

  const deptObjectId = new mongoose.Types.ObjectId(departmentId);

  // Role-specific queries
  const queries = [];

  if (role === "all" || role === "faculty") {
    queries.push(
      Faculty.find({
        department: deptObjectId,
        isDeleted: { $ne: true },
      }).lean(),
    );
  }

  if (role === "all" || role === "student") {
    queries.push(
      Student.find({
        department: deptObjectId,
        isDeleted: { $ne: true },
      }).lean(),
    );
  }

  if (role === "all" || role === "admin") {
    queries.push(
      Admin.find({ department: deptObjectId, isDeleted: { $ne: true } }).lean(),
    );
  }

  const [faculties = [], students = [], admins = []] =
    await Promise.all(queries);

  // HODs from department itself
  const departmentDoc = await Department.findById(deptObjectId)
    .populate("hod")
    .lean();

  // Combine users from all roles
  const users = [
    ...faculties.map((u) => ({ ...u, role: "faculty" })),
    ...students.map((u) => ({ ...u, role: "student" })),
    ...admins.map((u) => ({ ...u, role: "admin" })),
    ...(departmentDoc?.hod ? [{ ...departmentDoc.hod, role: "hod" }] : []),
  ];

  // Filter by period
  const recentUsers = users.filter((u) => new Date(u.createdAt) >= dateFrom);

  // Count roles
  const roleStats = {};
  for (const user of users) {
    roleStats[user.role] = (roleStats[user.role] || 0) + 1;
  }

  // Growth trend by year+month+role
  const growthTrendMap = {};
  for (const user of recentUsers) {
    const createdAt = new Date(user.createdAt);
    const year = createdAt.getFullYear();
    const month = createdAt.getMonth() + 1;
    const date = createdAt.toISOString().split("T")[0];
    const key = `${year}-${month}-${user.role}`;
    if (!growthTrendMap[key]) {
      growthTrendMap[key] = {
        _id: { year, month, date, role: user.role },
        count: 0,
      };
    }
    growthTrendMap[key].count += 1;
  }

  const growthTrend = Object.values(growthTrendMap).sort((a, b) => {
    const d1 = new Date(a._id.date);
    const d2 = new Date(b._id.date);
    return d1 - d2;
  });

  const responseData = {
    total: users.length,
    byRole: roleStats,
    active: 0, // Placeholder: depends on status field if available
    inactive: 0, // Placeholder
    recentRegistrations: recentUsers.length,
    growthTrend,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        responseData,
        "Department user statistics retrieved successfully",
      ),
    );
});

export const getDepartmentPerformanceMetrics = asyncHandler(
  async (req, res) => {
    const departmentId = getScopedDepartmentId(req);

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid department ID"));
    }

    const metrics = await Department.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(departmentId),
          status: "active",
        },
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
          uuid: 1,
          name: 1,
          code: 1,
          establishedYear: 1,
          facultyCount: { $size: "$faculty" },
          studentCount: { $size: "$students" },
          courseCount: { $size: "$courses" },
          hasHOD: {
            $cond: [{ $ifNull: ["$hod", false] }, true, false],
          },
          budgetUtilization: {
            $cond: [
              {
                $or: [
                  { $eq: ["$budget", null] },
                  { $eq: ["$budget.allocated", 0] },
                ],
              },
              0,
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$budget.utilized", "$budget.allocated"] },
                      100,
                    ],
                  },
                  2,
                ],
              },
            ],
          },
          studentToFacultyRatio: {
            $cond: [
              { $eq: [{ $size: "$faculty" }, 0] },
              0,
              {
                $round: [
                  {
                    $divide: [{ $size: "$students" }, { $size: "$faculty" }],
                  },
                  2,
                ],
              },
            ],
          },
        },
      },
    ]);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          metrics[0] || {},
          "Department performance metrics retrieved successfully",
        ),
      );
  },
);

export const getFinancialStatistics = asyncHandler(async (req, res) => {
  try {
    const departmentId = getScopedDepartmentId(req);

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid department ID"));
    }

    const { fiscalYear: currentFiscalYear } = getCurrentFiscalYear(
      req,
      res,
      true,
    );

    const fiscalStart = new Date(`${currentFiscalYear.split("-")[0]}-04-01`);

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
            paymentDate: { $gte: fiscalStart },
            department: new mongoose.Types.ObjectId(departmentId),
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
            department: new mongoose.Types.ObjectId(departmentId),
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
          $match: {
            _id: new mongoose.Types.ObjectId(departmentId),
            status: "active",
          },
        },
        {
          $project: {
            _id: 0,
            totalAllocated: "$budget.allocated",
            totalUtilized: "$budget.utilized",
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
            department: new mongoose.Types.ObjectId(departmentId),
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
      .json(
        new ApiResponse(
          200,
          response,
          "Department financial statistics retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Error fetching financial statistics:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, "Failed to retrieve financial statistics"),
      );
  }
});

export const getAcademicStatistics = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  if (!mongoose.Types.ObjectId.isValid(departmentId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid department ID"));
  }

  const currentAcademicYear = getCurrentAcademicYear(req, res, true);
  const departmentObjectId = new mongoose.Types.ObjectId(departmentId);

  const [
    totalStudents,
    totalFaculty,
    totalCourses,
    attendanceStats,
    examStats,
    batchStats,
  ] = await Promise.all([
    Student.countDocuments({ department: departmentObjectId }),
    Faculty.countDocuments({ isActive: true, department: departmentObjectId }),
    Course.countDocuments({ department: departmentObjectId }),

    Attendance.aggregate([
      {
        $match: {
          date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          department: departmentObjectId,
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    Exam.aggregate([
      {
        $match: {
          examDate: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          department: departmentObjectId,
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

    Batch.aggregate([
      {
        $match: {
          status: "active",
          department: departmentObjectId,
        },
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

  const response = new ApiResponse(
    200,
    {
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
    },
    "Department academic statistics fetched successfully",
  );

  return res.status(200).json(response);
});

export const getUserStatistics = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  if (!mongoose.Types.ObjectId.isValid(departmentId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid department ID"));
  }

  const departmentObjectId = new mongoose.Types.ObjectId(departmentId);

  // Get user IDs linked to the current department
  const [facultyUsers, studentUsers, adminUsers] = await Promise.all([
    Faculty.find({ department: departmentObjectId }, "user"),
    Student.find({ department: departmentObjectId }, "user"),
    Admin.find({ department: departmentObjectId }, "user"),
  ]);

  const userIds = [...facultyUsers, ...studentUsers, ...adminUsers]
    .map((item) => item.user)
    .filter(Boolean);

  if (userIds.length === 0) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          total: 0,
          byRole: {},
          active: 0,
          recentRegistrations: 0,
          inactive: 0,
          growthTrend: [],
        },
        "No users found for this department",
      ),
    );
  }

  const [
    totalUsers,
    usersByRole,
    activeUsers,
    recentRegistrations,
    inactiveUsers,
    growthTrend,
  ] = await Promise.all([
    User.countDocuments({ _id: { $in: userIds }, isDeleted: { $ne: true } }),

    User.aggregate([
      {
        $match: {
          _id: { $in: userIds },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),

    User.countDocuments({
      _id: { $in: userIds },
      isActive: true,
      isDeleted: { $ne: true },
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),

    User.countDocuments({
      _id: { $in: userIds },
      isDeleted: { $ne: true },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),

    User.countDocuments({
      _id: { $in: userIds },
      isActive: false,
      isDeleted: { $ne: true },
    }),

    User.aggregate([
      {
        $match: {
          _id: { $in: userIds },
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
    ]),
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
    .json(
      new ApiResponse(200, response, "User statistics retrieved successfully"),
    );
});

export const getAllFaculties = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    status = "all",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Assuming admin's department ID is available on req.user.department
  const adminDepartmentId = getScopedDepartmentId(req);
  if (!adminDepartmentId) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Admin department not found"));
  }

  let query = {
    department: adminDepartmentId, // Filter faculties only from admin's department
  };

  // Search in faculty fields & populated user fields
  if (search) {
    query.$or = [
      { facultyId: { $regex: search, $options: "i" } },
      { employeeId: { $regex: search, $options: "i" } },
      { "user.firstName": { $regex: search, $options: "i" } },
      { "user.lastName": { $regex: search, $options: "i" } },
      { "user.email": { $regex: search, $options: "i" } },
    ];
  }

  // Filter by active/inactive status
  if (status !== "all") {
    query.status = status === "active" ? "active" : { $ne: "active" };
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  const faculties = await Faculty.find(query)
    .populate(
      "user",
      "firstName middleName lastName email phone dateOfBirth gender -password -refreshToken",
    )
    .populate("department", "name code")
    .populate("permanentAddress")
    .populate("currentAddress")
    .sort(sortOptions)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Faculty.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        faculties,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
      "Faculties retrieved successfully",
    ),
  );
});

export const getStudentsBySemester = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    semester, // mandatory filter for semester
    status = "all",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.body;

  if (!semester) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Semester query parameter is required"));
  }

  // Get admin's department ID from req.user (make sure your auth middleware sets this)
  const adminDepartmentId = getScopedDepartmentId(req);
  if (!adminDepartmentId) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Admin department not found"));
  }

  let query = {
    semester: parseInt(semester),
    department: adminDepartmentId, // restrict to admin's department
  };

  if (search) {
    query.$or = [
      { studentId: { $regex: search, $options: "i" } },
      { "user.firstName": { $regex: search, $options: "i" } },
      { "user.lastName": { $regex: search, $options: "i" } },
      { "user.email": { $regex: search, $options: "i" } },
    ];
  }

  if (status !== "all") {
    query.status = status === "active" ? "active" : { $ne: "active" };
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  const students = await Student.find(query)
    .populate(
      "user",
      "firstName middleName lastName email phone dateOfBirth gender -password -refreshToken",
    )
    .populate("department", "name code")
    .populate("batch", "name academicYear")
    .populate("permanentAddress")
    .populate("currentAddress")
    .sort(sortOptions)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Student.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        students,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
      "Students retrieved successfully",
    ),
  );
});
