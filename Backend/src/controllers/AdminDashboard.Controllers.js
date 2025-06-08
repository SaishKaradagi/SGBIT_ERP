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
  const departmentId = getScopedDepartmentId(req); // Get department scope
  const {
    facultyId,
    previousHODNewDesignation = "Professor",
    previousHODNewRole = "faculty",
  } = req.body;

  if (!facultyId) {
    throw new ApiError(400, "Faculty ID is required");
  }

  // Step 1: Get the department
  const department = await Department.findById(departmentId);
  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  // Step 2: If old HOD exists, update their designation and role
  if (department.hod) {
    const prevHOD = await Faculty.findById(department.hod).populate("user");
    if (prevHOD) {
      prevHOD.designation = previousHODNewDesignation;
      await prevHOD.save();

      if (prevHOD.user) {
        prevHOD.user.role = previousHODNewRole;
        await prevHOD.user.save();
      }
    }
  }

  // Step 3: Update new HOD's designation and user role
  const newHOD = await Faculty.findOne({ facultyId }).populate("user");
  if (!newHOD) {
    throw new ApiError(404, "Faculty not found");
  }

  newHOD.designation = "HOD";
  await newHOD.save();

  if (newHOD.user) {
    newHOD.user.role = "hod";
    await newHOD.user.save();
  }

  // Step 4: Assign new HOD to department
  department.hod = newHOD._id;
  await department.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "HOD assigned successfully"));
});

export const removeHOD = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  const {
    previousHODNewDesignation = "Professor",
    previousHODNewRole = "faculty",
  } = req.body;

  try {
    const department = await Department.findById(departmentId);
    if (!department) {
      throw new ApiError(404, "Department not found");
    }

    // If a HOD exists, update their designation and user role
    if (department.hod) {
      const prevHOD = await Faculty.findById(department.hod).populate("user");
      if (prevHOD) {
        // Update designation in Faculty
        prevHOD.designation = previousHODNewDesignation;
        await prevHOD.save();

        // Update role in User
        if (prevHOD.user) {
          prevHOD.user.role = previousHODNewRole;
          await prevHOD.user.save();
        }
      }
    }

    // Remove HOD from department
    department.hod = undefined;
    await department.save();

    return res
      .status(200)
      .json(new ApiResponse(200, null, "HOD removed and updated successfully"));
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
    .populate("batch", "name year")
    .populate("department", "name code")
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
          "studentInfo.department": new mongoose.Types.ObjectId(departmentId),
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
          "studentInfo.department": new mongoose.Types.ObjectId(departmentId),
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
          "studentInfo.department": new mongoose.Types.ObjectId(departmentId),
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

    console.log("Attendance Stats:", attendanceStats);
    console.log("Performance Stats:", performanceStats);
    console.log("Fee Stats:", feeStats);

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
  console.log("Received body:", req.body);
  const {
    title,
    content,
    noticeType,
    isImportant,
    status,
    attachments,
    targetAudience,
    semester,
    batch,
    expiryDate: userExpiryDate,
  } = req.body;

  // Required field validation
  if (!title || !content) {
    throw new ApiError(400, "Title and content are required");
  }

  // Process target audience
  let processedAudience = ["ALL"];
  if (targetAudience) {
    processedAudience = Array.isArray(targetAudience)
      ? targetAudience
      : [targetAudience];

    // Convert to uppercase and validate
    processedAudience = processedAudience.map((aud) => aud.toUpperCase());
    const validAudiences = [
      "ALL",
      "STUDENTS",
      "FACULTY",
      "ADMIN",
      "FIRST_YEAR",
      "SECOND_YEAR",
      "THIRD_YEAR",
      "FOURTH_YEAR",
      "ALUMNI",
      "PARENTS",
    ];

    for (const aud of processedAudience) {
      if (!validAudiences.includes(aud)) {
        throw new ApiError(400, `Invalid audience type: ${aud}`);
      }
    }
  }

  // Handle expiry date - auto delete after 7 days if not provided
  let expiryDate = null;
  let expiryMessage = "Notice will remain permanently";

  if (userExpiryDate) {
    expiryDate = new Date(userExpiryDate);
    expiryMessage = `Notice will expire on ${expiryDate.toLocaleDateString()}`;
  } else {
    // Set default expiry to 7 days from now
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    expiryDate = sevenDaysFromNow;
    expiryMessage =
      "Notice will be automatically deleted after 7 days since no expiry was provided";
  }

  // Validate expiry date
  if (expiryDate <= new Date()) {
    throw new ApiError(400, "Expiry date must be in the future");
  }

  // Create notice
  const notice = await Notice.create({
    title,
    content,
    author: req.user._id,
    department: departmentId,
    noticeType: noticeType || "GENERAL",
    isImportant: isImportant || false,
    status: status || "PUBLISHED",
    attachments: attachments || [],
    targetAudience: processedAudience,
    semester: semester || [],
    batch: batch || [],
    expiryDate,
  });

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        ...notice.toObject(),
        expiryMessage,
      },
      `Notice created successfully. ${expiryMessage}`,
    ),
  );
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
    .populate("author", "firstName lastName")
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
    .populate("courseType", "name code") // this is defined as a virtual in your model
    .sort({ name: 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, courses, "Courses retrieved successfully"));
});

export const createCourse = asyncHandler(async (req, res) => {
  const departmentId = getScopedDepartmentId(req);
  const userId = req.user?._id;

  const {
    code,
    name,
    description,
    credits,
    courseType,
    syllabus,
    status,
    semester,
    lectureHours,
    tutorialHours,
    practicalHours,
    isLabCourse,
    scheme,
  } = req.body;

  // ================== 🔍 Required Field Validation ==================
  if (!code || !name || !credits || !courseType) {
    throw new ApiError(400, "Code, name, credits, and courseType are required");
  }

  // ================== 🧼 Sanitize Inputs ==================
  const sanitizedCode = code.trim().toUpperCase();
  const sanitizedName = name.trim();
  const sanitizedDescription = description?.trim() || "";
  const sanitizedSyllabus = syllabus?.trim() || "";
  const sanitizedStatus = status?.toLowerCase() || "active";

  // ================== 🚫 Validate Status ==================
  const allowedStatuses = ["active", "inactive", "archived"];
  if (!allowedStatuses.includes(sanitizedStatus)) {
    throw new ApiError(400, `Invalid status: ${status}`);
  }

  // ================== 🔢 Validate Credits ==================
  const numericCredits = parseFloat(credits);
  if (
    isNaN(numericCredits) ||
    numericCredits < 0 ||
    numericCredits > 20 ||
    !(numericCredits % 1 === 0 || numericCredits % 1 === 0.5)
  ) {
    throw new ApiError(
      400,
      "Credits must be a non-negative whole or half number ≤ 20",
    );
  }

  // ================== 🔍 Check for Duplicate Course ==================
  const existingCourse = await Course.findOne({ code: sanitizedCode });
  if (existingCourse) {
    throw new ApiError(409, `Course with code ${sanitizedCode} already exists`);
  }

  // ================== 🔍 Validate courseType Enum ==================
  // const allowedCourseTypes = Object.values(VTU_COURSE_TYPES);
  // if (!allowedCourseTypes.includes(courseType)) {
  //   throw new ApiError(400, `Invalid courseType: ${courseType}`);
  // }

  // ================== ✅ Create Course Document ==================
  const course = await Course.create({
    code: sanitizedCode,
    name: sanitizedName,
    description: sanitizedDescription,
    credits: numericCredits,
    courseType,
    syllabus: sanitizedSyllabus,
    status: sanitizedStatus,
    department: departmentId,
    createdBy: userId,
    updatedBy: userId,
    semester,
    lectureHours,
    tutorialHours,
    practicalHours,
    isLabCourse,
    scheme,
  });

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
