// Backend/src/routes/CourseManagement.routes.js
import express from "express";
import {
  // Core CRUD Operations
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,

  // Course Search & Filtering
  searchCourses,
  getCoursesByDepartment,
  getCoursesBySemester,

  // Course Analytics & Reports
  getCourseStatistics,
  getCoursePerformanceAnalytics,
  getCourseFacultyHistory,

  //Course Allocation & Assignment
  assignFacultyToCourse,
  removeFacultyFromCourse,
  getCourseAllocations,

  //Advanced Features
  validateCourseData,
  exportCourseData,
  updateCourseStatus,

  //Curriculum Management
  createCourseCurriculum,
  updateCourseCurriculum,
  getCourseOutline,
  getSyllabusContent,
  updateSyllabusUrl,
} from "../controllers/CourseManagement.Controllers.js";

import {
  restrictTo,
  verifyJWT,
  verifyAdminRole,
} from "../middlewares/auth.Middleware.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyJWT);

// ==================== PUBLIC COURSE INFORMATION ====================
// These routes can be accessed by all authenticated users for course information

// Get course catalog (read-only access for students)
router.get(
  "/catalog",
  restrictTo("admin", "superAdmin", "hod", "faculty", "student"),
  asyncHandler(getAllCourses),
); //done

router.get(
  "/catalog/search",
  restrictTo("admin", "superAdmin", "hod", "faculty", "student"),
  asyncHandler(searchCourses),
); //done

router.get(
  "/:id/outline",
  restrictTo("admin", "superAdmin", "hod", "faculty", "student"),
  asyncHandler(getCourseOutline),
); //done duplicate route need to be removed

router.get(
  "/:id/syllabus-content",
  restrictTo("admin", "superAdmin", "hod", "faculty", "student"),
  asyncHandler(getSyllabusContent),
); //done

// ==================== ADMIN & HOD MANAGEMENT ====================
// Full CRUD access for course management

// Apply admin verification for management routes
router.use(verifyAdminRole);

// ========== CORE CRUD OPERATIONS ==========
router.post(
  "/",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(createCourse),
); //done

router.get(
  "/",
  restrictTo("admin", "superAdmin", "hod", "faculty"),
  asyncHandler(getAllCourses),
);

router.get(
  "/search",
  restrictTo("admin", "superAdmin", "hod", "faculty"),
  asyncHandler(searchCourses),
);

router.get(
  "/statistics",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(getCourseStatistics),
); //done

router.get(
  "/:id",
  restrictTo("admin", "superAdmin", "hod", "faculty"),
  asyncHandler(getCourseById),
); //done

router.put(
  "/updateCourse/:id",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(updateCourse),
); //done

router.delete(
  "/deleteCourse/:id",
  restrictTo("admin", "superAdmin"),
  asyncHandler(deleteCourse),
); //done soft delete

// ========== FILTERING & SEARCH ==========
router.get(
  "/department/:departmentId",
  restrictTo("admin", "superAdmin", "hod", "faculty"),
  asyncHandler(getCoursesByDepartment),
); //done

router.get(
  "/semester/:semesterNumber",
  restrictTo("admin", "superAdmin", "hod", "faculty"),
  asyncHandler(getCoursesBySemester),
); //done

// ========== FACULTY ALLOCATION ==========
router.post(
  "/assignFacultyToCourse",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(assignFacultyToCourse),
);

router.delete(
  "/removeFacultyFromCourse",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(removeFacultyFromCourse),
); //done

router.get(
  "/:id/allocations",
  restrictTo("admin", "superAdmin", "hod", "faculty"),
  asyncHandler(getCourseAllocations),
); //done

router.get(
  "/:id/faculty-history",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(getCourseFacultyHistory),
); //done

// ========== ANALYTICS & REPORTS ==========
router.get(
  "/:id/analytics",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(getCoursePerformanceAnalytics),
); //done

router.get(
  "/export/data",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(exportCourseData),
); //done

// ========== COURSE STATUS MANAGEMENT ==========
router.patch(
  "/:id/status",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(updateCourseStatus),
); //done

// ========== VALIDATION & UTILITIES ==========
router.post(
  "/validate",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(validateCourseData),
); //done

// ========== CURRICULUM MANAGEMENT ==========
router.post(
  "/:id/curriculum",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(createCourseCurriculum),
);

router.put(
  "/:id/curriculum",
  restrictTo("admin", "superAdmin", "hod"),
  asyncHandler(updateCourseCurriculum),
);
router.patch(
  "/:id/syllabus-url",
  restrictTo("admin", "superAdmin", "hod", "faculty"),
  asyncHandler(updateSyllabusUrl),
);

// ==================== FACULTY-SPECIFIC ROUTES ====================
// Limited access for faculty to manage their assigned courses

// router.get(
//   "/my-courses",
//   restrictTo("faculty"),
//   asyncHandler(getCoursesByFaculty),
// );

// router.put(
//   "/:id/content",
//   restrictTo("faculty"),
//   asyncHandler(updateCourseContent),
// );

// ==================== VALIDATION MIDDLEWARE ====================
// Add validation middleware for course data
router.use("/:id", (req, res, next) => {
  // Validate MongoDB ObjectId format
  if (req.params.id && !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      success: false,
      message: "Invalid course ID format",
    });
  }
  next();
});

export default router;
