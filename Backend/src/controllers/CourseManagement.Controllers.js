// Backend/src/controllers/CourseManagement.Controllers.js
import mongoose from "mongoose";
import Course from "../models/course.model.js";
import Faculty from "../models/faculty.model.js";
import Department from "../models/department.model.js";
import CourseAllocation from "../models/courseAllocation.model.js";
import CourseRegistration from "../models/courseRegistration.model.js";
import Student from "../models/student.model.js";
import ExamResult from "../models/examResult.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import Semester from "../models/semester.model.js";
import Attendance from "../models/attendance.model.js";
import Grade from "../models/gradeScale.model.js";
import Batch from "../models/batch.model.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";

// ==================== CORE CRUD OPERATIONS ====================

/**
 * Create a new course
 * @route POST /api/admin/courses
 * @access Admin, SuperAdmin, HOD
 */
const createCourse = async (req, res) => {
  const {
    code,
    name,
    description,
    department,
    credits,
    courseType,
    semester,
    lectureHours,
    tutorialHours,
    practicalHours,
    isLabCourse,
    scheme,
    prerequisites,
  } = req.body;

  // Validate required fields
  if (!code || !name || !department || !credits || !courseType || !semester) {
    throw new ApiError(
      400,
      "Code, name, department, credits, courseType, and semester are required",
    );
  }

  // Check if course code already exists
  const existingCourse = await Course.findOne({
    code: code.toUpperCase(),
    status: { $ne: "archived" },
  });

  if (existingCourse) {
    throw new ApiError(400, "Course with this code already exists");
  }

  // Validate department exists
  const departmentExists = await Department.findById(department);
  if (!departmentExists) {
    throw new ApiError(404, "Department not found");
  }

  // Validate prerequisites if provided
  if (prerequisites && prerequisites.length > 0) {
    const prerequisiteCourses = await Course.find({
      _id: { $in: prerequisites },
      status: "active",
    });

    if (prerequisiteCourses.length !== prerequisites.length) {
      throw new ApiError(
        400,
        "Some prerequisite courses not found or inactive",
      );
    }
  }

  const course = await Course.create({
    code: code.toUpperCase(),
    name: name,
    description: description,
    department: department,
    credits: credits,
    courseType: courseType,
    semester: semester,
    lectureHours: lectureHours || 0,
    tutorialHours: tutorialHours || 0,
    practicalHours: practicalHours || 0,
    isLabCourse: isLabCourse || false,
    scheme: scheme || "CBCS",
    prerequisites: prerequisites || [],
    updatedBy: req.user._id,
    createdBy: req.user._id,
  });
  //   console.log(req.user.name);

  logger.info(`Course created: ${course.code} by user ${req.user.name}`);

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        course,
        `Course created: ${course.code} by user ${req.user.name}`,
      ),
    );
};

/**
 * Get all courses with filtering and pagination
 * @route GET /api/admin/courses
 * @access Admin, SuperAdmin, HOD, Faculty
 */
const getAllCourses = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    department,
    semester,
    courseType,
    status = "active",
    scheme,
    search,
  } = req.query;

  // Build filter object
  const filter = {};

  if (department) filter.department = department;
  if (semester) filter.semester = parseInt(semester);
  if (courseType) filter.courseType = courseType;
  if (status !== "all") filter.status = status;
  if (scheme) filter.scheme = scheme;

  // Add text search if provided
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // Role-based filtering
  if (req.user.role === "hod") {
    const userDepartment = await Department.findOne({
      hod: req.user._id,
    }).select("_id");

    if (userDepartment) {
      filter.department = userDepartment._id;
    }
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const [courses, totalCourses] = await Promise.all([
    Course.find(filter)
      .populate("department", "name code")
      .populate("createdBy", "firstName lastName")
      .sort({ semester: 1, code: 1 })
      .skip(skip)
      .limit(limitNum),
    Course.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCourses / limitNum);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        courses,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCourses,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
      "Courses retrieved successfully",
    ),
  );
};

/**
 * Get course by ID
 * @route GET /api/admin/courses/:id
 * @access Admin, SuperAdmin, HOD, Faculty
 */
const getCourseById = async (req, res) => {
  const { id } = req.params;

  const course = await Course.findById(id)
    .populate("department", "name code description")
    .populate("createdBy", "firstName lastName email")
    .populate("updatedBy", "firstName lastName email");

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Role-based access control
  if (req.user.role === "hod") {
    const userDepartment = await Department.findOne({
      hod: req.user._id,
    }).select("_id");

    if (userDepartment && !course.department._id.equals(userDepartment._id)) {
      throw new ApiError(
        403,
        "Access denied. You can only view courses from your department",
      );
    }
  }

  // Get additional course statistics
  const [allocations, registrations] = await Promise.all([
    CourseAllocation.find({ course: course._id, status: "active" })
      .populate("faculty", "user")
      .populate({
        path: "faculty",
        populate: {
          path: "user",
          select: "firstName lastName",
        },
      }),
    CourseRegistration.countDocuments({ course: course._id, status: "active" }),
  ]);

  const courseData = {
    ...course.toObject(),
    statistics: {
      facultyAllocated: allocations.length,
      studentsEnrolled: registrations,
      allocatedFaculty: allocations.map((allocation) => ({
        facultyId: allocation.faculty._id,
        facultyName: `${allocation.faculty.user.firstName} ${allocation.faculty.user.lastName}`,
        allocationType: allocation.allocationType,
        workload: allocation.workload,
      })),
    },
  };

  return res
    .status(200)
    .json(new ApiResponse(200, courseData, "Course retrieved successfully"));
};

/**
 * Update course
 * @route PUT /api/admin/courses/:id
 * @access Admin, SuperAdmin, HOD
 */
const updateCourse = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Define allowed fields for update
  const allowedFields = [
    "code",
    "name",
    "description",
    "department",
    "credits",
    "courseType",
    "semester",
    "lectureHours",
    "tutorialHours",
    "practicalHours",
    "isLabCourse",
    "scheme",
    "status",
  ];

  // Filter updateData to only include allowed fields
  const filteredUpdateData = Object.keys(updateData)
    .filter((key) => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = updateData[key];
      return obj;
    }, {});

  // Validate course existence
  const course = await Course.findById(id);
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Role-based access control for HOD
  if (req.user.role === "hod") {
    const userDepartment = await Department.findOne({
      hod: req.user._id,
    }).select("_id");
    if (userDepartment && !course.department.equals(userDepartment._id)) {
      throw new ApiError(
        403,
        "Access denied. You can only update courses from your department",
      );
    }
    // If department is being updated, ensure it's the HOD's department
    if (
      filteredUpdateData.department &&
      !userDepartment._id.equals(filteredUpdateData.department)
    ) {
      throw new ApiError(
        403,
        "Access denied. You can only assign courses to your department",
      );
    }
  }

  // Validate department if provided
  if (filteredUpdateData.department) {
    const departmentExists = await Department.findById(
      filteredUpdateData.department,
    );
    if (!departmentExists) {
      throw new ApiError(400, "Invalid department ID");
    }
  }

  // Validate course code if provided
  if (filteredUpdateData.code) {
    filteredUpdateData.code = filteredUpdateData.code.toUpperCase();
    if (filteredUpdateData.code !== course.code) {
      const existingCourse = await Course.findOne({
        code: filteredUpdateData.code,
        _id: { $ne: id },
        status: { $ne: "archived" },
      });
      if (existingCourse) {
        throw new ApiError(400, "Course with this code already exists");
      }
    }
    // Validate code format
    if (!/^[A-Z0-9-]{2,20}$/.test(filteredUpdateData.code)) {
      throw new ApiError(400, "Invalid course code format");
    }
  }

  // Validate numeric fields
  if (filteredUpdateData.credits !== undefined) {
    if (
      !Number.isInteger(filteredUpdateData.credits) ||
      filteredUpdateData.credits < 0 ||
      filteredUpdateData.credits > 5
    ) {
      throw new ApiError(400, "Credits must be an integer between 0 and 5");
    }
  }
  if (filteredUpdateData.semester !== undefined) {
    if (
      !Number.isInteger(filteredUpdateData.semester) ||
      filteredUpdateData.semester < 1 ||
      filteredUpdateData.semester > 8
    ) {
      throw new ApiError(400, "Semester must be an integer between 1 and 8");
    }
  }
  if (filteredUpdateData.lectureHours !== undefined) {
    if (
      !Number.isInteger(filteredUpdateData.lectureHours) ||
      filteredUpdateData.lectureHours < 0
    ) {
      throw new ApiError(400, "Lecture hours must be a non-negative integer");
    }
  }
  if (filteredUpdateData.tutorialHours !== undefined) {
    if (
      !Number.isInteger(filteredUpdateData.tutorialHours) ||
      filteredUpdateData.tutorialHours < 0
    ) {
      throw new ApiError(400, "Tutorial hours must be a non-negative integer");
    }
  }
  if (filteredUpdateData.practicalHours !== undefined) {
    if (
      !Number.isInteger(filteredUpdateData.practicalHours) ||
      filteredUpdateData.practicalHours < 0
    ) {
      throw new ApiError(400, "Practical hours must be a non-negative integer");
    }
  }

  // Validate courseType if provided
  if (filteredUpdateData.courseType) {
    if (
      !Object.keys(VTU_COURSE_TYPES).includes(filteredUpdateData.courseType)
    ) {
      throw new ApiError(400, "Invalid course type");
    }
  }

  // Validate status if provided
  if (filteredUpdateData.status) {
    if (
      !["active", "inactive", "archived"].includes(filteredUpdateData.status)
    ) {
      throw new ApiError(400, "Invalid status value");
    }
  }

  // Validate lab course constraints
  if (
    filteredUpdateData.isLabCourse ||
    (course.isLabCourse && filteredUpdateData.isLabCourse !== false)
  ) {
    const practicalHours =
      filteredUpdateData.practicalHours ?? course.practicalHours;
    const credits = filteredUpdateData.credits ?? course.credits;
    if (practicalHours < 2) {
      throw new ApiError(
        400,
        "Lab courses must have at least 2 practical hours",
      );
    }
    if (credits < 1) {
      throw new ApiError(400, "Lab courses must have at least 1 credit");
    }
  }

  // Validate non-credit courses
  const credits = filteredUpdateData.credits ?? course.credits;
  if (credits === 0) {
    const lectureHours = filteredUpdateData.lectureHours ?? course.lectureHours;
    const tutorialHours =
      filteredUpdateData.tutorialHours ?? course.tutorialHours;
    const practicalHours =
      filteredUpdateData.practicalHours ?? course.practicalHours;
    if (lectureHours > 0 || tutorialHours > 0 || practicalHours > 0) {
      throw new ApiError(
        400,
        "Non-credit courses should not have teaching hours",
      );
    }
  }

  // Set updatedBy
  filteredUpdateData.updatedBy = req.user._id;

  // Update course
  const updatedCourse = await Course.findByIdAndUpdate(
    id,
    { $set: filteredUpdateData },
    { new: true, runValidators: true },
  )
    .populate("department", "name code")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!updatedCourse) {
    throw new ApiError(500, "Failed to update course");
  }

  // Log updated fields
  const updatedFields = Object.keys(filteredUpdateData).join(", ");
  //   logger.info(
  //     `Course updated: ${updatedCourse.code} by user ${req.user._id}. Updated fields: ${updatedFields}`,
  //   );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedCourse,
        `Course updated: ${updatedCourse.code} by user ${req.user.name}`,
      ),
    );
};

/**
 * Delete course (soft delete)
 * @route DELETE /api/admin/courses/:id
 * @access SuperAdmin, Admin
 */
const deleteCourse = async (req, res) => {
  const { id } = req.params;

  const course = await Course.findById(id);
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Check if course has active allocations or registrations
  const [activeAllocations, activeRegistrations] = await Promise.all([
    CourseAllocation.countDocuments({ course: id, status: "active" }),
    CourseRegistration.countDocuments({ course: id, status: "active" }),
  ]);

  if (activeAllocations > 0 || activeRegistrations > 0) {
    throw new ApiError(
      400,
      "Cannot delete course with active allocations or registrations. Please deactivate first.",
    );
  }

  // Soft delete - change status to archived
  await Course.findByIdAndUpdate(id, {
    status: "archived",
    updatedBy: req.user._id,
  });

  logger.info(`Course deleted: ${course.code} by user ${req.user._id}`);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Course deleted successfully"));
};

// ==================== COURSE SEARCH & FILTERING ====================

/**
 * Search courses with advanced filters
 * @route GET /api/admin/courses/search
 * @access Admin, SuperAdmin, HOD, Faculty, Student
 */
const searchCourses = async (req, res) => {
  const {
    q: searchQuery,
    department,
    semester,
    courseType,
    credits,
    scheme,
    status = "active",
    page = 1,
    limit = 20,
  } = req.query;

  if (!searchQuery && !department && !semester && !courseType) {
    throw new ApiError(400, "At least one search parameter is required");
  }

  const filter = {};

  // Text search
  if (searchQuery) {
    filter.$or = [
      { name: { $regex: searchQuery, $options: "i" } },
      { code: { $regex: searchQuery, $options: "i" } },
      { description: { $regex: searchQuery, $options: "i" } },
    ];
  }

  // Additional filters
  if (department) filter.department = department;
  if (semester) filter.semester = parseInt(semester);
  if (courseType) filter.courseType = courseType;
  if (credits) filter.credits = parseInt(credits);
  if (scheme) filter.scheme = scheme;
  if (status !== "all") filter.status = status;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const courses = await Course.find(filter)
    .populate("department", "name code")
    .select(
      "code name description credits courseType semester isLabCourse status",
    )
    .sort({ semester: 1, code: 1 })
    .skip(skip)
    .limit(limitNum);

  const totalResults = await Course.countDocuments(filter);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        courses,
        totalResults,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalResults / limitNum),
          hasNextPage: pageNum < Math.ceil(totalResults / limitNum),
        },
      },
      "Search completed successfully",
    ),
  );
};

/**
 * Get courses by department
 * @route GET /api/admin/courses/department/:departmentId
 * @access Admin, SuperAdmin, HOD, Faculty
 */
const getCoursesByDepartment = async (req, res) => {
  const { departmentId } = req.params;
  const { semester, courseType, status = "active" } = req.query;

  // Validate department exists
  const department = await Department.findById(departmentId);
  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  // Role-based access control
  if (req.user.role === "hod") {
    const userDepartment = await Department.findOne({
      hod: req.user._id,
    }).select("_id");

    if (userDepartment && !userDepartment._id.equals(departmentId)) {
      throw new ApiError(
        403,
        "Access denied. You can only view courses from your department",
      );
    }
  }

  const filter = { department: departmentId };
  if (semester) filter.semester = parseInt(semester);
  if (courseType) filter.courseType = courseType;
  if (status !== "all") filter.status = status;

  const courses = await Course.find(filter).sort({
    semester: 1,
    courseType: 1,
    code: 1,
  });

  // Group by semester for better organization
  const coursesBySemester = courses.reduce((acc, course) => {
    const sem = course.semester;
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(course);
    return acc;
  }, {});

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        department: {
          _id: department._id,
          name: department.name,
          code: department.code,
        },
        courses,
        coursesBySemester,
        totalCourses: courses.length,
      },
      "Department courses retrieved successfully",
    ),
  );
};

/**
 * Get courses by semester
 * @route GET /api/admin/courses/semester/:semesterNumber
 * @access Admin, SuperAdmin, HOD, Faculty
 */
const getCoursesBySemester = async (req, res) => {
  const { semesterNumber } = req.params;
  const { department, courseType, status = "active" } = req.query;

  const semester = parseInt(semesterNumber);
  if (semester < 1 || semester > 8) {
    throw new ApiError(400, "Semester must be between 1 and 8");
  }

  const filter = { semester };
  if (department) filter.department = department;
  if (courseType) filter.courseType = courseType;
  if (status !== "all") filter.status = status;

  // Role-based filtering for HOD
  if (req.user.role === "hod") {
    const userDepartment = await Department.findOne({
      hod: req.user._id,
    }).select("_id");

    if (userDepartment) {
      filter.department = userDepartment._id;
    }
  }

  const courses = await Course.find(filter)
    .populate("department", "name code")
    .sort({ department: 1, courseType: 1, code: 1 });

  // Group by department and course type
  const coursesByDepartment = courses.reduce((acc, course) => {
    const deptName = course.department.name;
    if (!acc[deptName]) acc[deptName] = {};

    const courseType = course.courseType;
    if (!acc[deptName][courseType]) acc[deptName][courseType] = [];

    acc[deptName][courseType].push(course);
    return acc;
  }, {});

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        semester,
        courses,
        coursesByDepartment,
        totalCourses: courses.length,
        courseTypeDistribution: courses.reduce((acc, course) => {
          acc[course.courseType] = (acc[course.courseType] || 0) + 1;
          return acc;
        }, {}),
      },
      `Semester ${semester} courses retrieved successfully`,
    ),
  );
};

/**
 * Get courses by type
 * @route GET /api/admin/courses/type/:courseType
 * @access Admin, SuperAdmin, HOD, Faculty
 */

// ==================== COURSE ANALYTICS & REPORTS ====================

/**
 * Get course statistics
 * @route GET /api/admin/courses/statistics
 * @access Admin, SuperAdmin, HOD
 */
const getCourseStatistics = async (req, res) => {
  const { department } = req.query;

  let matchFilter = {};

  // Role-based filtering for HOD
  if (req.user.role === "hod") {
    const userDepartment = await Department.findOne({
      hod: req.user._id,
    }).select("_id");

    if (userDepartment) {
      matchFilter.department = userDepartment._id;
    }
  } else if (department) {
    matchFilter.department = new mongoose.Types.ObjectId(department);
  }

  const [
    totalCourses,
    coursesByStatus,
    coursesByType,
    coursesBySemester,
    coursesByCredits,
    labCourses,
    theoryCourses,
  ] = await Promise.all([
    Course.countDocuments(matchFilter),

    Course.aggregate([
      { $match: matchFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    Course.aggregate([
      { $match: matchFilter },
      { $group: { _id: "$courseType", count: { $sum: 1 } } },
    ]),

    Course.aggregate([
      { $match: matchFilter },
      { $group: { _id: "$semester", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

    Course.aggregate([
      { $match: matchFilter },
      { $group: { _id: "$credits", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

    Course.countDocuments({ ...matchFilter, isLabCourse: true }),
    Course.countDocuments({ ...matchFilter, isLabCourse: false }),
  ]);

  // Get faculty allocation statistics
  const allocationStats = await CourseAllocation.aggregate([
    {
      $lookup: {
        from: "courses",
        localField: "course",
        foreignField: "_id",
        as: "courseInfo",
      },
    },
    { $unwind: "$courseInfo" },
    ...(Object.keys(matchFilter).length > 0
      ? [{ $match: { "courseInfo.department": matchFilter.department } }]
      : []),
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalWorkload: { $sum: "$workload" },
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        overview: {
          totalCourses,
          activeCourses:
            coursesByStatus.find((s) => s._id === "active")?.count || 0,
          labCourses,
          theoryCourses,
        },
        distribution: {
          byStatus: coursesByStatus,
          byType: coursesByType,
          bySemester: coursesBySemester,
          byCredits: coursesByCredits,
        },
        facultyAllocation: allocationStats,
      },
      "Course statistics retrieved successfully",
    ),
  );
};

/**
 * Get course performance analytics
 * @route GET /api/admin/courses/:id/analytics
 * @access Admin, SuperAdmin, HOD
 */
const getCoursePerformanceAnalytics = async (req, res) => {
  const { id } = req.params;
  const { academicYear, semester } = req.query;

  const course = await Course.findById(id);
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Build filter for exam results
  const resultFilter = { course: id };
  if (academicYear) resultFilter.academicYear = academicYear;
  if (semester) resultFilter.semester = parseInt(semester);

  // Get performance data
  const [enrollmentStats, gradeDistribution, passFailStats, averageMarks] =
    await Promise.all([
      // Enrollment statistics
      CourseRegistration.aggregate([
        { $match: { course: new mongoose.Types.ObjectId(id) } },
        {
          $group: {
            _id: "$academicYear",
            totalEnrolled: { $sum: 1 },
            activeEnrollments: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: -1 } },
      ]),

      // Grade distribution
      ExamResult.aggregate([
        { $match: resultFilter },
        {
          $group: {
            _id: "$finalGrade",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
      ]),

      // Pass/Fail statistics
      ExamResult.aggregate([
        { $match: resultFilter },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            passed: {
              $sum: {
                $cond: [{ $gte: ["$finalGrade", 4] }, 1, 0],
              },
            },
            failed: {
              $sum: {
                $cond: [{ $lt: ["$finalGrade", 4] }, 1, 0],
              },
            },
            averageGrade: { $avg: "$finalGrade" },
          },
        },
      ]),

      // Average marks breakdown
      ExamResult.aggregate([
        { $match: resultFilter },
        {
          $group: {
            _id: null,
            avgCIE: { $avg: "$cieMarks" },
            avgExternal: { $avg: "$externalMarks" },
            avgTotal: { $avg: "$totalMarks" },
          },
        },
      ]),
    ]);

  const passFailData = passFailStats[0] || {
    totalStudents: 0,
    passed: 0,
    failed: 0,
    averageGrade: 0,
  };

  const performance = {
    course: {
      _id: course._id,
      code: course.code,
      name: course.name,
      credits: course.credits,
    },
    enrollment: enrollmentStats,
    grades: {
      distribution: gradeDistribution,
      passRate:
        passFailData.totalStudents > 0
          ? ((passFailData.passed / passFailData.totalStudents) * 100).toFixed(
              2,
            )
          : 0,
      averageGrade: passFailData.averageGrade?.toFixed(2) || 0,
    },
    marks: averageMarks[0] || {
      avgCIE: 0,
      avgExternal: 0,
      avgTotal: 0,
    },
    summary: {
      totalStudentsAppeared: passFailData.totalStudents,
      studentsPass: passFailData.passed,
      studentsFail: passFailData.failed,
    },
  };

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        performance,
        "Course performance analytics retrieved successfully",
      ),
    );
};

/**
 * Get course faculty history
 * @route GET /api/admin/courses/:id/faculty-history
 * @access Admin, SuperAdmin, HOD
 */
const getCourseFacultyHistory = async (req, res) => {
  const { id } = req.params;

  const course = await Course.findById(id);
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  const facultyHistory = await CourseAllocation.find({ course: id })
    .populate({
      path: "faculty",
      populate: {
        path: "user",
        select: "firstName lastName email",
      },
    })
    .populate("assignedBy", "firstName lastName")
    .sort({ createdAt: -1 });

  const historyData = facultyHistory.map((allocation) => ({
    _id: allocation._id,
    faculty: {
      _id: allocation.faculty._id,
      name: `${allocation.faculty.user.firstName} ${allocation.faculty.user.lastName}`,
      email: allocation.faculty.user.email,
      facultyId: allocation.faculty.facultyId,
    },
    allocationType: allocation.allocationType,
    workload: allocation.workload,
    status: allocation.status,
    assignedBy: allocation.assignedBy
      ? {
          name: `${allocation.assignedBy.firstName} ${allocation.assignedBy.lastName}`,
        }
      : null,
    assignedDate: allocation.createdAt,
    academicYear: allocation.academicYear,
    semester: allocation.semester,
  }));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        course: {
          _id: course._id,
          code: course.code,
          name: course.name,
        },
        facultyHistory: historyData,
        totalAllocations: historyData.length,
      },
      "Course faculty history retrieved successfully",
    ),
  );
};

// ==================== COURSE ALLOCATION & ASSIGNMENT ====================

/**
 * @desc    Assign faculty to a course
 * @route   POST /api/admin/courses/:id/faculty
 * @access  Admin, SuperAdmin, HOD
 * @body    {string} facultyId - Faculty ID to assign
 * @body    {string} semester - Semester for allocation
 * @body    {string} academicYear - Academic year
 * @body    {string} allocationType - primary, secondary, substitute
 */
export const assignFacultyToCourse = asyncHandler(async (req, res) => {
  const { facultyId, semester, academicYear, courseId, batch, section } =
    req.body;

  // Validate academic year format first
  if (!/^\d{4}-\d{4}$/.test(academicYear)) {
    throw new ApiError(400, "Academic year must be in YYYY-YYYY format");
  }

  // Validate required fields
  const requiredFields = [
    "facultyId",
    "semester",
    "academicYear",
    "courseId",
    "batch",
    "section",
  ];
  const missingFields = requiredFields.filter((field) => !req.body[field]);

  if (missingFields.length) {
    throw new ApiError(
      400,
      `Missing required fields: ${missingFields.join(", ")}`,
    );
  }

  // Validate IDs
  if (
    !mongoose.Types.ObjectId.isValid(courseId) ||
    !mongoose.Types.ObjectId.isValid(facultyId) ||
    !mongoose.Types.ObjectId.isValid(semester) ||
    !mongoose.Types.ObjectId.isValid(batch)
  ) {
    throw new ApiError(400, "Invalid ID format");
  }

  try {
    // Parallel existence checks
    const [course, faculty] = await Promise.all([
      Course.findById(courseId).select("department").lean(),
      Faculty.findById(facultyId).select("status department").lean(),
    ]);

    if (!course) throw new ApiError(404, "Course not found");
    if (!faculty) throw new ApiError(404, "Faculty not found");
    if (faculty.status !== "active")
      throw new ApiError(400, "Faculty is not active");

    // Department authorization
    if (req.user.role === "hod") {
      const userDept = req.user.departmentId?.toString();
      const courseDept = course.department?.toString();

      if (userDept && courseDept && userDept !== courseDept) {
        throw new ApiError(
          403,
          "You can only assign faculty to courses in your department",
        );
      }
    }

    // Department mismatch warning
    if (faculty.department?.toString() !== course.department?.toString()) {
      logger.warn(
        `Faculty ${facultyId} from different department assigned to course ${courseId}`,
      );
    }

    // Check for existing allocation (all unique fields)
    const existingAllocation = await CourseAllocation.findOne({
      course: courseId,
      faculty: facultyId,
      semester,
      section: section.toUpperCase(),
      batch,
      academicYear,
      status: "active",
    });

    if (existingAllocation) {
      throw new ApiError(
        409,
        "This course allocation already exists for the given parameters",
      );
    }

    // Calculate actual workload (distinct courses)
    const facultyCourses = await CourseAllocation.find({
      faculty: facultyId,
      semester,
      academicYear,
      status: "active",
    }).distinct("course");

    if (facultyCourses.length >= 6) {
      throw new ApiError(
        400,
        "Faculty workload limit exceeded (maximum 6 courses per semester)",
      );
    }

    // Create allocation
    const courseAllocation = await CourseAllocation.create({
      course: courseId,
      faculty: facultyId,
      semester,
      academicYear,
      batch,
      section: section.toUpperCase().trim(),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    // Efficient population
    const populated = await CourseAllocation.populate(courseAllocation, [
      { path: "course", select: "name code" },
      {
        path: "faculty",
        select: "employeeId",
        populate: { path: "user", select: "firstName lastName" },
      },
      { path: "createdBy", select: "firstName lastName" },
    ]);

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          populated,
          "Faculty assigned to course successfully",
        ),
      );
  } catch (error) {
    if (error.code === 11000) {
      // Handle model-level unique violation
      throw new ApiError(409, "Duplicate allocation detected");
    }
    throw error;
  }
});
/**
 * @desc    Remove faculty from a course
 * @route   DELETE /api/admin/courses/:id/faculty/:facultyId
 * @access  Admin, SuperAdmin, HOD
 */
export const removeFacultyFromCourse = asyncHandler(async (req, res) => {
  // const { id: courseId, facultyId } = req.params;
  const { semester, academicYear, courseId, facultyId } = req.body;

  // Validate IDs
  const invalidIds = [];
  if (!mongoose.Types.ObjectId.isValid(courseId)) invalidIds.push("courseId");
  if (!mongoose.Types.ObjectId.isValid(facultyId)) invalidIds.push("facultyId");

  if (invalidIds.length) {
    throw new ApiError(400, `Invalid ID format: ${invalidIds.join(", ")}`);
  }

  // Validate academic year if provided
  if (academicYear && !/^\d{4}-\d{4}$/.test(academicYear)) {
    throw new ApiError(400, "Academic year must be in YYYY-YYYY format");
  }

  // Find course with minimal data
  const course = await Course.findById(courseId).select("department").lean();
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Authorization check
  if (req.user.role === "hod" && req.user.departmentId) {
    const courseDept = course.department?.toString();
    const userDept = req.user.departmentId.toString();

    if (courseDept && courseDept !== userDept) {
      throw new ApiError(
        403,
        "You can only manage course allocations in your department",
      );
    }
  }

  // Build query for allocation
  const allocationQuery = {
    course: courseId,
    faculty: facultyId,
    status: "active",
  };

  if (semester) allocationQuery.semester = semester;
  if (academicYear) allocationQuery.academicYear = academicYear;

  // Find allocation to be deleted
  const allocation = await CourseAllocation.findOne(allocationQuery);
  if (!allocation) {
    throw new ApiError(404, "Active course allocation not found");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Remove references from related models
    await Promise.all([
      // Remove from Attendance
      Attendance.deleteMany({ allocation: allocation._id }).session(session),

      // Remove from Grades
      Grade.deleteMany({ allocation: allocation._id }).session(session),

      // Remove from Faculty's allocations
      Faculty.updateOne(
        { _id: facultyId },
        { $pull: { courseAllocations: allocation._id } },
      ).session(session),

      // Remove from Course's allocations
      Course.updateOne(
        { _id: courseId },
        { $pull: { allocations: allocation._id } },
      ).session(session),

      // Remove from Semester's allocations (if exists)
      Semester.updateOne(
        { _id: allocation.semester },
        { $pull: { courseAllocations: allocation._id } },
      ).session(session),

      // Remove from Batch's allocations (if exists)
      Batch.updateOne(
        { _id: allocation.batch },
        { $pull: { courseAllocations: allocation._id } },
      ).session(session),
    ]);

    // Perform hard deletion of allocation
    await allocation.deleteOne({ session });

    await session.commitTransaction();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          "Faculty removed from course and all references cleaned successfully",
        ),
      );
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(500, `Deletion failed: ${error.message}`);
  } finally {
    session.endSession();
  }
});
/**
 * @desc    Get course allocations with filtering
 * @route   GET /api/admin/courses/:id/allocations
 * @access  Admin, SuperAdmin, HOD, Faculty
 */
export const getCourseAllocations = asyncHandler(async (req, res) => {
  const { id: courseId } = req.params;
  const {
    semester,
    academicYear,
    status = "active",
    page = 1,
    limit = 10,
    includeHistory = false,
  } = req.query;

  // Validate course ID
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID format");
  }

  // Check if course exists
  const course = await Course.findById(courseId).populate("department");
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Department permission check
  if (req.user.role === "hod" && req.user.departmentId) {
    if (course.department._id.toString() !== req.user.departmentId.toString()) {
      throw new ApiError(
        403,
        "You can only view course allocations in your department",
      );
    }
  }

  // Build query
  const query = { course: courseId };
  if (semester) query.semester = semester;
  if (academicYear) query.academicYear = academicYear;
  if (!includeHistory) query.status = status;

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get allocations with pagination
  const [allocations, total] = await Promise.all([
    CourseAllocation.find(query)
      .populate([
        {
          path: "faculty",
          select: "facultyId employeeId designation",
          populate: {
            path: "user",
            select: "firstName lastName email phone",
          },
        },
        {
          path: "assignedBy",
          select: "firstName lastName",
        },
        {
          path: "removedBy",
          select: "firstName lastName",
        },
      ])
      .sort({ assignedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    CourseAllocation.countDocuments(query),
  ]);

  // Prepare response with pagination info
  const response = {
    allocations,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalAllocations: total,
      hasNextPage: skip + allocations.length < total,
      hasPrevPage: parseInt(page) > 1,
    },
    course: {
      id: course._id,
      name: course.name,
      code: course.code,
      department: course.department.name,
    },
  };

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        response,
        "Course allocations retrieved successfully",
      ),
    );
});

// ==================== ADVANCED FEATURES ====================

/**
 * @desc    Validate course data
 * @route   POST /api/admin/courses/validate
 * @access  Admin, SuperAdmin, HOD
 */
export const validateCourseData = asyncHandler(async (req, res) => {
  const courseData = req.body;
  const validationErrors = [];
  const warnings = [];

  try {
    // Required field validation
    const requiredFields = [
      "name",
      "code",
      "department",
      "credits",
      "courseType",
      "semester",
    ];
    for (const field of requiredFields) {
      if (!courseData[field]) {
        validationErrors.push(`${field} is required`);
      }
    }

    // Course code validation
    if (courseData.code) {
      // Check format (VTU pattern: typically alphanumeric with numbers)
      if (!/^[A-Z0-9]{6,10}$/.test(courseData.code)) {
        validationErrors.push(
          "Course code should be 6-10 uppercase alphanumeric characters",
        );
      }

      // Check uniqueness
      const existingCourse = await Course.findOne({
        code: courseData.code.toUpperCase(),
        ...(courseData._id && { _id: { $ne: courseData._id } }),
      });
      if (existingCourse) {
        validationErrors.push(`Course code ${courseData.code} already exists`);
      }
    }

    // Department validation
    if (courseData.department) {
      const department = await Department.findById(courseData.department);
      if (!department) {
        validationErrors.push("Invalid department ID");
      } else if (!department.isActive) {
        warnings.push("Selected department is inactive");
      }
    }

    // Credits validation
    if (courseData.credits !== undefined) {
      if (courseData.credits < 0 || courseData.credits > 5) {
        validationErrors.push("Credits must be between 0 and 5");
      }
    }

    // Semester validation
    if (courseData.semester !== undefined) {
      if (courseData.semester < 1 || courseData.semester > 8) {
        validationErrors.push("Semester must be between 1 and 8");
      }
    }

    // Course type validation
    const validCourseTypes = [
      "PCC",
      "PEC",
      "OEC",
      "PRJ",
      "NCMC",
      "BSC",
      "AEC",
      "SEC",
      "VAC",
      "INT",
    ];
    if (
      courseData.courseType &&
      !validCourseTypes.includes(courseData.courseType)
    ) {
      validationErrors.push(
        `Course type must be one of: ${validCourseTypes.join(", ")}`,
      );
    }

    // Hours validation
    const totalHours =
      (courseData.lectureHours || 0) +
      (courseData.tutorialHours || 0) +
      (courseData.practicalHours || 0);

    if (totalHours === 0) {
      warnings.push("No hours specified for the course");
    } else if (totalHours > 8) {
      warnings.push("Total hours per week exceeds typical limit (8 hours)");
    }

    // Lab course validation
    if (courseData.isLabCourse && (courseData.practicalHours || 0) === 0) {
      warnings.push("Lab course should have practical hours");
    }

    // Business rule validations
    if (courseData.semester && courseData.courseType) {
      // Example: Project courses typically in final semesters
      if (courseData.courseType === "PRJ" && courseData.semester < 7) {
        warnings.push(
          "Project courses are typically offered in 7th or 8th semester",
        );
      }
    }

    const response = {
      isValid: validationErrors.length === 0,
      errors: validationErrors,
      warnings: warnings,
      summary: {
        errorCount: validationErrors.length,
        warningCount: warnings.length,
      },
    };

    res
      .status(200)
      .json(new ApiResponse(200, response, "Course data validation completed"));
  } catch (error) {
    throw new ApiError(500, "Error during course data validation");
  }
});

/**
 * @desc    Export course data
 * @route   GET /api/admin/courses/export/data
 * @access  Admin, SuperAdmin, HOD
 */
export const exportCourseData = asyncHandler(async (req, res) => {
  const {
    format = "json",
    department,
    semester,
    courseType,
    status = "active",
    includeAllocations = false,
  } = req.query;

  // Build query based on filters
  const query = { status };
  if (department) query.department = department;
  if (semester) query.semester = parseInt(semester);
  if (courseType) query.courseType = courseType;

  // Department permission check for HOD
  if (req.user.role === "hod" && req.user.departmentId) {
    query.department = req.user.departmentId;
  }

  try {
    let courses;

    if (includeAllocations === "true") {
      // Get courses with current allocations
      courses = await Course.aggregate([
        { $match: query },
        {
          $lookup: {
            from: "courseallocations",
            let: { courseId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$course", "$$courseId"] },
                  status: "active",
                },
              },
              {
                $lookup: {
                  from: "faculties",
                  localField: "faculty",
                  foreignField: "_id",
                  as: "facultyDetails",
                },
              },
              {
                $lookup: {
                  from: "users",
                  localField: "facultyDetails.user",
                  foreignField: "_id",
                  as: "userDetails",
                },
              },
            ],
            as: "allocations",
          },
        },
        {
          $lookup: {
            from: "departments",
            localField: "department",
            foreignField: "_id",
            as: "departmentDetails",
          },
        },
        {
          $project: {
            name: 1,
            code: 1,
            credits: 1,
            courseType: 1,
            semester: 1,
            lectureHours: 1,
            tutorialHours: 1,
            practicalHours: 1,
            isLabCourse: 1,
            scheme: 1,
            department: { $arrayElemAt: ["$departmentDetails.name", 0] },
            allocations: {
              $map: {
                input: "$allocations",
                as: "alloc",
                in: {
                  facultyName: {
                    $concat: [
                      { $arrayElemAt: ["$$alloc.userDetails.firstName", 0] },
                      " ",
                      { $arrayElemAt: ["$$alloc.userDetails.lastName", 0] },
                    ],
                  },
                  facultyId: {
                    $arrayElemAt: ["$$alloc.facultyDetails.facultyId", 0],
                  },
                  allocationType: "$$alloc.allocationType",
                  academicYear: "$$alloc.academicYear",
                  semester: "$$alloc.semester",
                },
              },
            },
          },
        },
      ]);
    } else {
      courses = await Course.find(query)
        .populate("department", "name code")
        .populate("createdBy", "firstName lastName")
        .sort({ code: 1 });
    }

    // Format response based on requested format
    let responseData;
    let contentType;
    let filename;

    switch (format.toLowerCase()) {
      case "csv":
        // Convert to CSV format
        const csvHeaders = [
          "Code",
          "Name",
          "Department",
          "Credits",
          "Course Type",
          "Semester",
          "Lecture Hours",
          "Tutorial Hours",
          "Practical Hours",
          "Is Lab Course",
          "Scheme",
          "Status",
        ];

        const csvData = courses.map((course) => [
          course.code,
          course.name,
          course.department?.name || course.departmentDetails?.name,
          course.credits,
          course.courseType,
          course.semester,
          course.lectureHours || 0,
          course.tutorialHours || 0,
          course.practicalHours || 0,
          course.isLabCourse ? "Yes" : "No",
          course.scheme,
          course.status,
        ]);

        responseData = [csvHeaders, ...csvData]
          .map((row) => row.map((field) => `"${field}"`).join(","))
          .join("\n");

        contentType = "text/csv";
        filename = `courses_export_${new Date().toISOString().split("T")[0]}.csv`;
        break;

      case "xlsx":
        // For Excel format, you would typically use a library like 'xlsx'
        // For now, returning JSON with instructions
        responseData = {
          message:
            "Excel export requires additional setup. Use CSV format or implement xlsx library.",
          data: courses,
        };
        contentType = "application/json";
        break;

      default: // JSON
        responseData = {
          exportDate: new Date().toISOString(),
          totalCourses: courses.length,
          filters: { department, semester, courseType, status },
          courses: courses,
        };
        contentType = "application/json";
        filename = `courses_export_${new Date().toISOString().split("T")[0]}.json`;
    }

    // Set appropriate headers for file download
    if (format !== "json") {
      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
    }

    if (format === "csv") {
      res.send(responseData);
    } else {
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            responseData,
            "Course data exported successfully",
          ),
        );
    }
  } catch (error) {
    throw new ApiError(500, "Error exporting course data");
  }
});

/**
 * @desc    Update course status
 * @route   PATCH /api/admin/courses/:id/status
 * @access  Admin, SuperAdmin, HOD
 */
export const updateCourseStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  // Validate course ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid course ID format");
  }

  // Validate status
  const validStatuses = ["active", "inactive", "archived"];
  if (!validStatuses.includes(status)) {
    throw new ApiError(
      400,
      `Status must be one of: ${validStatuses.join(", ")}`,
    );
  }

  // Find course
  const course = await Course.findById(id).populate("department");
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Department permission check
  if (req.user.role === "hod" && req.user.departmentId) {
    if (course.department._id.toString() !== req.user.departmentId.toString()) {
      throw new ApiError(
        403,
        "You can only update status of courses in your department",
      );
    }
  }

  // Check if status change is valid
  if (course.status === status) {
    throw new ApiError(400, `Course is already ${status}`);
  }

  // Business rules for status changes
  if (status === "archived" && course.status !== "inactive") {
    throw new ApiError(400, "Can only archive inactive courses");
  }

  try {
    // Check for active allocations if deactivating
    if (status === "inactive" || status === "archived") {
      const activeAllocations = await CourseAllocation.countDocuments({
        course: id,
        status: "active",
      });

      if (activeAllocations > 0) {
        throw new ApiError(
          400,
          `Cannot ${status === "inactive" ? "deactivate" : "archive"} course with active faculty allocations`,
        );
      }
    }

    // Update course status
    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      {
        status,
        updatedBy: req.user._id,
        statusHistory: {
          $push: {
            status,
            changedBy: req.user._id,
            changedAt: new Date(),
            reason: reason || `Status changed to ${status}`,
          },
        },
      },
      { new: true, runValidators: true },
    ).populate([
      { path: "department", select: "name code" },
      { path: "updatedBy", select: "firstName lastName" },
    ]);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedCourse,
          `Course status updated to ${status} successfully`,
        ),
      );
  } catch (error) {
    throw new ApiError(500, "Error updating course status");
  }
});

// ==================== CURRICULUM MANAGEMENT ====================

/**
 * @desc    Create course curriculum/syllabus
 * @route   POST /api/admin/courses/:id/curriculum
 * @access  Admin, SuperAdmin, HOD
 */
export const createCourseCurriculum = asyncHandler(async (req, res) => {
  const { id: courseId } = req.params;
  const {
    syllabusUrl,
    objectives,
    outcomes,
    units,
    references,
    scheme,
    evaluationPattern,
  } = req.body;

  // Validate course ID
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID format");
  }

  // Find course
  const course = await Course.findById(courseId).populate("department");
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Department permission check
  if (req.user.role === "hod" && req.user.departmentId) {
    if (course.department._id.toString() !== req.user.departmentId.toString()) {
      throw new ApiError(
        403,
        "You can only manage curriculum for courses in your department",
      );
    }
  }

  try {
    // Validate syllabus URL if provided
    if (syllabusUrl) {
      const urlPattern = /^https?:\/\/[^\s$.?#].[^\s]*$/;
      if (!urlPattern.test(syllabusUrl)) {
        throw new ApiError(400, "Invalid syllabus URL format");
      }
    }

    // Create curriculum object
    const curriculumData = {
      syllabusUrl,
      objectives: objectives || [],
      outcomes: outcomes || [],
      units: units || [],
      references: references || [],
      scheme: scheme || course.scheme,
      evaluationPattern: evaluationPattern || {
        cie: 50,
        external: 50,
        practical: 0,
        assignment: 0,
      },
      createdBy: req.user._id,
      lastUpdated: new Date(),
    };

    // Update course with curriculum
    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      {
        curriculum: curriculumData,
        updatedBy: req.user._id,
      },
      { new: true, runValidators: true },
    ).populate([
      { path: "department", select: "name code" },
      { path: "curriculum.createdBy", select: "firstName lastName" },
    ]);

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          updatedCourse,
          "Course curriculum created successfully",
        ),
      );
  } catch (error) {
    console.error("Curriculum creation error:", error);
    throw new ApiError(500, "Error creating course curriculum");
  }
});

/**
 * @desc    Update course curriculum
 * @route   PUT /api/admin/courses/:id/curriculum
 * @access  Admin, SuperAdmin, HOD
 */
export const updateCourseCurriculum = asyncHandler(async (req, res) => {
  const { id: courseId } = req.params;
  const curriculumUpdates = req.body;

  // Validate course ID
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID format");
  }

  // Find course
  const course = await Course.findById(courseId).populate("department");
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Check if curriculum exists
  if (!course.curriculum) {
    throw new ApiError(
      404,
      "Course curriculum not found. Please create curriculum first.",
    );
  }

  // Department permission check
  if (req.user.role === "hod" && req.user.departmentId) {
    if (course.department._id.toString() !== req.user.departmentId.toString()) {
      throw new ApiError(
        403,
        "You can only manage curriculum for courses in your department",
      );
    }
  }

  try {
    // Validate syllabus URL if provided
    if (curriculumUpdates.syllabusUrl) {
      const urlPattern = /^https?:\/\/[^\s$.?#].[^\s]*$/;
      if (!urlPattern.test(curriculumUpdates.syllabusUrl)) {
        throw new ApiError(400, "Invalid syllabus URL format");
      }
    }

    // Prepare update object
    const updateFields = {};
    const allowedFields = [
      "syllabusUrl",
      "objectives",
      "outcomes",
      "units",
      "references",
      "scheme",
      "evaluationPattern",
    ];

    allowedFields.forEach((field) => {
      if (curriculumUpdates[field] !== undefined) {
        updateFields[`curriculum.${field}`] = curriculumUpdates[field];
      }
    });

    // Always update metadata
    updateFields["curriculum.lastUpdated"] = new Date();
    updateFields["curriculum.updatedBy"] = req.user._id;
    updateFields["updatedBy"] = req.user._id;

    // Update course curriculum
    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      { $set: updateFields },
      { new: true, runValidators: true },
    ).populate([
      { path: "department", select: "name code" },
      { path: "curriculum.createdBy", select: "firstName lastName" },
      { path: "curriculum.updatedBy", select: "firstName lastName" },
    ]);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedCourse,
          "Course curriculum updated successfully",
        ),
      );
  } catch (error) {
    throw new ApiError(500, "Error updating course curriculum");
  }
});

/**
 * @desc    Get course outline/syllabus (Public access for students)
 * @route   GET /api/admin/courses/:id/outline
 * @access  Admin, SuperAdmin, HOD, Faculty, Student
 */
export const getCourseOutline = asyncHandler(async (req, res) => {
  const { id: courseId } = req.params;
  const { includeUrl = true } = req.query;

  // Validate course ID
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID format");
  }

  // Find course with curriculum
  const course = await Course.findById(courseId)
    .populate("department", "name code")
    .select(
      "name code credits courseType semester curriculum lectureHours tutorialHours practicalHours isLabCourse scheme status",
    );

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Check if course is active for students
  if (req.user.role === "student" && course.status !== "active") {
    throw new ApiError(404, "Course not available");
  }

  // Department permission check for HOD
  if (req.user.role === "hod" && req.user.departmentId) {
    const dept = await Department.findById(req.user.departmentId);
    if (course.department._id.toString() !== req.user.departmentId.toString()) {
      throw new ApiError(403, "You can only view courses from your department");
    }
  }

  // Prepare course outline response
  const courseOutline = {
    course: {
      id: course._id,
      name: course.name,
      code: course.code,
      credits: course.credits,
      courseType: course.courseType,
      semester: course.semester,
      department: course.department,
      hours: {
        lecture: course.lectureHours || 0,
        tutorial: course.tutorialHours || 0,
        practical: course.practicalHours || 0,
        total:
          (course.lectureHours || 0) +
          (course.tutorialHours || 0) +
          (course.practicalHours || 0),
      },
      isLabCourse: course.isLabCourse,
      scheme: course.scheme,
    },
    curriculum: null,
    syllabusAvailable: false,
  };

  // Add curriculum if available
  if (course.curriculum) {
    courseOutline.curriculum = {
      objectives: course.curriculum.objectives || [],
      outcomes: course.curriculum.outcomes || [],
      units: course.curriculum.units || [],
      references: course.curriculum.references || [],
      evaluationPattern: course.curriculum.evaluationPattern || {
        cie: 50,
        external: 50,
        practical: 0,
        assignment: 0,
      },
      lastUpdated: course.curriculum.lastUpdated,
    };

    // Include syllabus URL only if requested and user has permission
    if (includeUrl === "true" && course.curriculum.syllabusUrl) {
      if (["admin", "superAdmin", "hod", "faculty"].includes(req.user.role)) {
        courseOutline.curriculum.syllabusUrl = course.curriculum.syllabusUrl;
      }
      courseOutline.syllabusAvailable = true;
    }
  }

  // Get current faculty allocation for this course
  const currentSemester = await Semester.findOne({ status: "current" });
  if (currentSemester) {
    const facultyAllocation = await CourseAllocation.findOne({
      course: courseId,
      semester: currentSemester.number,
      academicYear: currentSemester.academicYear,
      status: "active",
      allocationType: "primary",
    }).populate({
      path: "faculty",
      select: "facultyId designation",
      populate: {
        path: "user",
        select: "firstName lastName email",
      },
    });

    if (facultyAllocation) {
      courseOutline.faculty = {
        name: `${facultyAllocation.faculty.user.firstName} ${facultyAllocation.faculty.user.lastName}`,
        facultyId: facultyAllocation.faculty.facultyId,
        designation: facultyAllocation.faculty.designation,
        email: facultyAllocation.faculty.user.email,
      };
    }
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        courseOutline,
        "Course outline retrieved successfully",
      ),
    );
});

/**
 * @desc    Get syllabus content from external URL (VTU syllabus fetcher)
 * @route   GET /api/admin/courses/:id/syllabus-content
 * @access  Admin, SuperAdmin, HOD, Faculty, Student
 */
export const getSyllabusContent = asyncHandler(async (req, res) => {
  const { id: courseId } = req.params;

  // Validate course ID
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID format");
  }

  // Find course
  const course = await Course.findById(courseId).select(
    "name code curriculum department",
  );
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Check if syllabus URL exists
  if (!course.curriculum?.syllabusUrl) {
    throw new ApiError(404, "Syllabus URL not available for this course");
  }

  // Department permission check for HOD
  if (req.user.role === "hod" && req.user.departmentId) {
    if (course.department.toString() !== req.user.departmentId.toString()) {
      throw new ApiError(
        403,
        "You can only access syllabus for courses in your department",
      );
    }
  }

  try {
    // For security, we'll return the URL and let frontend handle the fetching
    // This prevents server-side request forgery and reduces server load
    const response = {
      course: {
        name: course.name,
        code: course.code,
      },
      syllabusUrl: course.curriculum.syllabusUrl,
      lastUpdated: course.curriculum.lastUpdated,
      instructions: {
        message:
          "Use the provided URL to fetch syllabus content on the frontend",
        security: "Direct content fetching disabled for security reasons",
      },
    };

    res
      .status(200)
      .json(
        new ApiResponse(200, response, "Syllabus URL retrieved successfully"),
      );
  } catch (error) {
    throw new ApiError(500, "Error retrieving syllabus content");
  }
});

/**
 * @desc    Update syllabus URL for a course
 * @route   PATCH /api/admin/courses/:id/syllabus-url
 * @access  Admin, SuperAdmin, HOD, Faculty
 */
export const updateSyllabusUrl = asyncHandler(async (req, res) => {
  const { id: courseId } = req.params;
  const { syllabusUrl, description } = req.body;

  // Validate course ID
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    throw new ApiError(400, "Invalid course ID format");
  }

  // Validate URL
  if (!syllabusUrl) {
    throw new ApiError(400, "Syllabus URL is required");
  }

  const urlPattern = /^https?:\/\/[^\s$.?#].[^\s]*$/;
  if (!urlPattern.test(syllabusUrl)) {
    throw new ApiError(400, "Invalid URL format");
  }

  // Find course
  const course = await Course.findById(courseId).populate("department");
  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Permission checks
  if (req.user.role === "hod" && req.user.departmentId) {
    if (course.department._id.toString() !== req.user.departmentId.toString()) {
      throw new ApiError(
        403,
        "You can only update syllabus for courses in your department",
      );
    }
  }

  if (req.user.role === "faculty") {
    // Check if faculty is assigned to this course
    const facultyAllocation = await CourseAllocation.findOne({
      course: courseId,
      faculty: req.user.facultyId,
      status: "active",
    });

    if (!facultyAllocation) {
      throw new ApiError(
        403,
        "You can only update syllabus for courses assigned to you",
      );
    }
  }

  try {
    // Initialize curriculum if it doesn't exist
    const updateFields = {};
    if (!course.curriculum) {
      updateFields["curriculum"] = {
        syllabusUrl,
        objectives: [],
        outcomes: [],
        units: [],
        references: [],
        createdBy: req.user._id,
        lastUpdated: new Date(),
      };
    } else {
      updateFields["curriculum.syllabusUrl"] = syllabusUrl;
      updateFields["curriculum.lastUpdated"] = new Date();
      updateFields["curriculum.updatedBy"] = req.user._id;
    }

    if (description) {
      updateFields["curriculum.description"] = description;
    }

    updateFields["updatedBy"] = req.user._id;

    // Update course
    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      { $set: updateFields },
      { new: true, runValidators: true },
    ).populate([
      { path: "department", select: "name code" },
      { path: "updatedBy", select: "firstName lastName" },
    ]);

    // Log the update
    console.log(
      `Syllabus URL updated for course ${course.code} by ${req.user.firstName} ${req.user.lastName}`,
    );

    res.status(200).json(
      new ApiResponse(
        200,
        {
          course: {
            id: updatedCourse._id,
            name: updatedCourse.name,
            code: updatedCourse.code,
            department: updatedCourse.department,
          },
          syllabusUrl: updatedCourse.curriculum.syllabusUrl,
          lastUpdated: updatedCourse.curriculum.lastUpdated,
        },
        "Syllabus URL updated successfully",
      ),
    );
  } catch (error) {
    throw new ApiError(500, "Error updating syllabus URL");
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Helper function to validate VTU course code format
 * @param {string} code - Course code to validate
 * @returns {boolean} - True if valid
 */
const validateVTUCourseCode = (code) => {
  // VTU course codes typically follow patterns like:
  // 18CS51, 21MAT31, 15CS664, etc.
  const vtuPattern = /^[0-9]{2}[A-Z]{2,3}[0-9]{2,3}[A-Z]?$/;
  return vtuPattern.test(code);
};

/**
 * Helper function to get course workload summary
 * @param {string} courseId - Course ID
 * @returns {object} - Workload summary
 */
const getCourseWorkloadSummary = async (courseId) => {
  const workload = await CourseAllocation.aggregate([
    { $match: { course: mongoose.Types.ObjectId(courseId), status: "active" } },
    {
      $group: {
        _id: "$semester",
        facultyCount: { $sum: 1 },
        allocations: { $push: "$ROOT" },
      },
    },
  ]);

  return workload;
};

/**
 * Helper function to check course prerequisites
 * @param {string} courseId - Course ID
 * @param {number} semester - Target semester
 * @returns {array} - Prerequisites
 */
const checkCoursePrerequisites = async (courseId, semester) => {
  // This would implement business logic for course prerequisites
  // For now, returning empty array as this needs specific business rules
  return [];
};

// Export all functions
export {
  // Core CRUD
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,

  // Search & Filtering
  searchCourses,
  getCoursesByDepartment,
  getCoursesBySemester,

  // Analytics & Reports
  getCourseStatistics,
  getCoursePerformanceAnalytics,
  getCourseFacultyHistory,

  // Re-export helper functions if needed elsewhere
  validateVTUCourseCode,
  getCourseWorkloadSummary,
  checkCoursePrerequisites,
};
