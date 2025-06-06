// Backend/src/controllers/AdminDashboard.Controllers.js
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import Department from "../models/department.model.js";
import Faculty from "../models/faculty.model.js";
import Student from "../models/student.model.js";
import Course from "../models/course.model.js";
import Batch from "../models/batch.model.js";
import FeePayment from "../models/feePayment.model.js";
import Attendance from "../models/attendance.model.js";
import Exam from "../models/exam.model.js";
import Notice from "../models/notice.model.js";
import Event from "../models/event.model.js";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { getScopedDepartmentId } from "../utils/getScopedDepartmentId.js";
// Then use: new ObjectId(departmentId)

// Dashboard Overview
export const getDashboardOverview = asyncHandler(async (req, res) => {
  const adminId = req.user._id;
  const departmentObjectId = getScopedDepartmentId(req); // Returns mongoose.Types.ObjectId
  console.log("🔍 Incoming department ID:", departmentObjectId);

  try {
    // Get department details
    const department = await Department.findById(departmentObjectId)
      .populate("hod", "user facultyId designation")
      .populate("faculty", "user designation status")
      .populate("courses", "name code credits");

    if (!department) {
      throw new ApiError(404, "Department not found");
    }

    // Get faculty statistics
    const facultyStats = await Faculty.aggregate([
      { $match: { department: departmentObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get student statistics
    const studentStats = await Student.aggregate([
      { $match: { department: departmentObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get course statistics
    const courseStats = await Course.aggregate([
      { $match: { department: departmentObjectId } },
      {
        $group: {
          _id: "$courseType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent activities (last 7 days)
    const recentActivities = await Promise.all([
      // Recent faculty additions
      Faculty.find({
        department: departmentObjectId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }).populate("user", "firstName lastName"),

      // Recent student enrollments
      Student.find({
        department: departmentObjectId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }).populate("user", "firstName lastName"),

      // Recent notices
      Notice.find({
        department: departmentObjectId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }).limit(5),
    ]);

    // Get budget utilization
    const budgetInfo = {
      allocated: department.budget.allocated,
      utilized: department.budget.utilized,
      balance: department.budgetBalance,
      utilizationPercentage: department.budgetUtilizationPercentage,
    };

    // Get pending approvals count
    const pendingApprovals = await Promise.all([
      // Pending leave requests
      Faculty.countDocuments({
        department: departmentObjectId,
        status: "on_leave",
        // Add leave approval status check here
      }),

      // Pending course registrations
      // Add course registration pending count logic
    ]);

    const dashboardData = {
      department: {
        name: department.name,
        code: department.code,
        establishedYear: department.establishedYear,
        age: department.age,
        hod: department.hod,
        status: department.status,
      },
      statistics: {
        faculty: {
          total: department.facultyCount,
          breakdown: facultyStats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {}),
        },
        students: {
          total: studentStats.reduce((acc, stat) => acc + stat.count, 0),
          breakdown: studentStats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {}),
        },
        courses: {
          total: department.courses.length,
          breakdown: courseStats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {}),
        },
      },
      budget: budgetInfo,
      recentActivities: {
        newFaculty: recentActivities[0],
        newStudents: recentActivities[1],
        recentNotices: recentActivities[2],
      },
      pendingApprovals: {
        leaveRequests: pendingApprovals[0],
        courseRegistrations: pendingApprovals[1] || 0,
      },
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          dashboardData,
          "Dashboard data retrieved successfully",
        ),
      );
  } catch (error) {
    console.error("Dashboard overview error:", error);
    throw new ApiError(500, "Failed to fetch dashboard data");
  }
});

// Faculty Management
export const getFacultyList = asyncHandler(async (req, res) => {
  // const { departmentId } = req.user;
  const departmentId = getScopedDepartmentId(req);
  const { page = 1, limit = 10, status, designation, search } = req.query;

  console.log("Requested Department ID:", departmentId);

  const filter = { department: departmentId };

  if (status) filter.status = status;
  if (designation) filter.designation = designation;

  const facultyQuery = Faculty.find(filter)
    .populate("user", "firstName middleName lastName email phone")
    .populate("department", "name code")
    .sort({ createdAt: -1 });

  if (search) {
    facultyQuery.populate({
      path: "user",
      match: {
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  const faculty = await facultyQuery
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const totalFaculty = await Faculty.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        faculty,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalFaculty / limit),
          totalItems: totalFaculty,
          itemsPerPage: parseInt(limit),
        },
      },
      "Faculty list retrieved successfully",
    ),
  );
});

export const assignHOD = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  const { facultyId } = req.body;

  if (!facultyId) {
    throw new ApiError(400, "Faculty ID is required");
  }

  try {
    const department = await Department.findById(departmentId);
    if (!department) {
      throw new ApiError(404, "Department not found");
    }

    await department.assignHOD(facultyId);

    return res
      .status(200)
      .json(new ApiResponse(200, null, "HOD assigned successfully"));
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

export const removeHOD = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);

  try {
    const department = await Department.findById(departmentId);
    if (!department) {
      throw new ApiError(404, "Department not found");
    }

    await department.removeHOD();

    return res
      .status(200)
      .json(new ApiResponse(200, null, "HOD removed successfully"));
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

// Student Management
export const getStudentList = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  const { page = 1, limit = 10, status, batch, search } = req.query;

  const filter = { department: departmentId };

  if (status) filter.status = status;
  if (batch) filter.currentBatch = batch;

  const studentsQuery = Student.find(filter)
    .populate("user", "firstName middleName lastName email phone")
    .populate("currentBatch", "name year")
    .populate("programme", "name code")
    .sort({ createdAt: -1 });

  if (search) {
    studentsQuery.populate({
      path: "user",
      match: {
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  const students = await studentsQuery
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const totalStudents = await Student.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        students,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalStudents / limit),
          totalItems: totalStudents,
          itemsPerPage: parseInt(limit),
        },
      },
      "Student list retrieved successfully",
    ),
  );
});

// Academic Analytics
export const getAcademicAnalytics = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  const { semester, academicYear } = req.query;

  try {
    // Attendance Analytics
    const attendanceStats = await Attendance.aggregate([
      {
        $lookup: {
          from: "students",
          localField: "student",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      {
        $unwind: "$studentInfo",
      },
      {
        $match: {
          "studentInfo.department": mongoose.Types.ObjectId(departmentId),
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Performance Analytics
    const performanceStats = await Exam.aggregate([
      {
        $lookup: {
          from: "examresults",
          localField: "_id",
          foreignField: "exam",
          as: "results",
        },
      },
      {
        $unwind: "$results",
      },
      {
        $lookup: {
          from: "students",
          localField: "results.student",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      {
        $unwind: "$studentInfo",
      },
      {
        $match: {
          "studentInfo.department": mongoose.Types.ObjectId(departmentId),
        },
      },
      {
        $group: {
          _id: null,
          averageMarks: { $avg: "$results.marksObtained" },
          totalExams: { $sum: 1 },
          passCount: {
            $sum: {
              $cond: [{ $gte: ["$results.marksObtained", 40] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Fee Collection Analytics
    const feeStats = await FeePayment.aggregate([
      {
        $lookup: {
          from: "students",
          localField: "student",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      {
        $unwind: "$studentInfo",
      },
      {
        $match: {
          "studentInfo.department": mongoose.Types.ObjectId(departmentId),
        },
      },
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          attendance: attendanceStats,
          performance: performanceStats[0] || {},
          feeCollection: feeStats,
        },
        "Academic analytics retrieved successfully",
      ),
    );
  } catch (error) {
    console.error("Academic analytics error:", error);
    throw new ApiError(500, "Failed to fetch academic analytics");
  }
});

// Notice Management
export const createNotice = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  const { title, content, priority, targetAudience, expiryDate } = req.body;

  if (!title || !content) {
    throw new ApiError(400, "Title and content are required");
  }

  const notice = await Notice.create({
    title,
    content,
    priority: priority || "medium",
    department: departmentId,
    createdBy: req.user._id,
    targetAudience: targetAudience || "all",
    expiryDate: expiryDate ? new Date(expiryDate) : null,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, notice, "Notice created successfully"));
});

export const getNotices = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  const { page = 1, limit = 10, priority, active } = req.query;

  const filter = { department: departmentId };

  if (priority) filter.priority = priority;
  if (active === "true") {
    filter.$or = [{ expiryDate: null }, { expiryDate: { $gt: new Date() } }];
  }

  const notices = await Notice.find(filter)
    .populate("createdBy", "firstName lastName")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const totalNotices = await Notice.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        notices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalNotices / limit),
          totalItems: totalNotices,
          itemsPerPage: parseInt(limit),
        },
      },
      "Notices retrieved successfully",
    ),
  );
});

// Course Management
export const getCourseList = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);

  const courses = await Course.find({ department: departmentId })
    .populate("courseType", "name")
    .populate("prerequisites", "name code")
    .sort({ name: 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, courses, "Courses retrieved successfully"));
});

export const createCourse = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  const courseData = {
    ...req.body,
    department: departmentId,
  };

  const course = await Course.create(courseData);

  return res
    .status(201)
    .json(new ApiResponse(201, course, "Course created successfully"));
});

// Budget Management
export const updateBudget = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  const { allocated, utilized, fiscalYear } = req.body;

  try {
    const department = await Department.findById(departmentId);
    if (!department) {
      throw new ApiError(404, "Department not found");
    }

    await department.updateBudget(allocated, utilized, fiscalYear);

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Budget updated successfully"));
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

export const getBudgetAnalytics = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  const { fiscalYear } = req.query;

  const department = await Department.findById(departmentId);
  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  const budgetData = {
    allocated: department.budget.allocated,
    utilized: department.budget.utilized,
    balance: department.budgetBalance,
    utilizationPercentage: department.budgetUtilizationPercentage,
    fiscalYear: department.budget.fiscalYear,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        budgetData,
        "Budget analytics retrieved successfully",
      ),
    );
});
