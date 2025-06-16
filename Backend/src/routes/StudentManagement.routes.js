// Backend/src/routes/StudentManagement.routes.js
// import { Router } from "express";
// import {
//   createStudent,
//   getStudents,
//   getStudentById,
//   updateStudent,
//   deleteStudent,
//   getStudentAcademicHistory,
//   bulkImportStudents,
//   assignProctor,
//   promoteStudents,
//   getStudentsByFilters,
//   getStudentPerformanceAnalytics,
//   transferStudent,
//   updateStudentStatus,
// } from "../controllers/StudentManagement.Controllers.js";
// import {
//   restrictTo,
//   verifyJWT,
//   verifyAdminRole,
// } from "../middlewares/auth.Middleware.js";

// const router = Router();

// // Apply authentication middleware to all routes
// router.use(verifyJWT);

// // ============ PHASE 1: CORE STUDENT MANAGEMENT ============

// // Basic CRUD Operations
// router.post(
//   "/",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   createStudent,
// );
// router.get(
//   "/",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin", "hod"),
//   getStudents,
// );
// router.get(
//   "/search",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin", "hod"),
//   getStudentsByFilters,
// );
// router.get(
//   "/:studentId",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin", "hod", "faculty"),
//   getStudentById,
// );
// router.put(
//   "/:studentId",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   updateStudent,
// );
// router.delete(
//   "/:studentId",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   deleteStudent,
// );

// // Academic History
// router.get(
//   "/:studentId/academic-history",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin", "hod", "faculty"),
//   getStudentAcademicHistory,
// );

// // Bulk Operations
// router.post(
//   "/bulk-import",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   bulkImportStudents,
// );

// // Student Assignment & Management
// router.post(
//   "/:studentId/assign-proctor",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   assignProctor,
// );
// router.post(
//   "/promote-semester",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   promoteStudents,
// );
// router.post(
//   "/:studentId/transfer",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   transferStudent,
// );
// router.patch(
//   "/:studentId/status",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   updateStudentStatus,
// );

// // Analytics & Reports
// router.get(
//   "/analytics/performance",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin", "hod"),
//   getStudentPerformanceAnalytics,
// );

// ============ FUTURE PHASE 2 ROUTES (Commented for now) ============
/*
// Course Registration & Management
router.post("/:studentId/courses", verifyAdminRole, restrictTo("admin", "superAdmin", "hod"), registerStudentCourses);
router.get("/:studentId/courses", verifyAdminRole, restrictTo("admin", "superAdmin", "hod", "faculty"), getStudentCourses);
router.delete("/:studentId/courses/:courseId", verifyAdminRole, restrictTo("admin", "superAdmin"), dropStudentCourse);

// Marks & Grades Management  
router.post("/:studentId/grades", verifyAdminRole, restrictTo("admin", "superAdmin", "hod", "faculty"), addUpdateGrades);
router.get("/:studentId/grades", verifyAdminRole, restrictTo("admin", "superAdmin", "hod", "faculty"), getStudentGrades);
router.get("/:studentId/cgpa", verifyAdminRole, restrictTo("admin", "superAdmin", "hod", "faculty"), calculateCGPA);

// Advanced Academic Management
router.get("/:studentId/backlogs", verifyAdminRole, restrictTo("admin", "superAdmin", "hod", "faculty"), getStudentBacklogs);
router.post("/:studentId/clear-backlog", verifyAdminRole, restrictTo("admin", "superAdmin"), clearBacklog);
*/

// export default router;
// c-history",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin", "hod", "faculty"),
//   getStudentAcademicHistory,
// );

// Bulk Operations
// router.post(
//   "/bulk-import",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   bulkImportStudents,
// );

// Student Assignment & Management
// router.post(
//   "/:studentId/assign-proctor",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   assignProctor,
// );
// router.post(
//   "/promote-semester",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   promoteStudents,
// );
// router.post(
//   "/:studentId/transfer",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   transferStudent,
// );
// router.patch(
//   "/:studentId/status",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin"),
//   updateStudentStatus,
// );

// // Analytics & Reports
// router.get(
//   "/analytics/performance",
//   verifyAdminRole,
//   restrictTo("admin", "superAdmin", "hod"),
//   getStudentPerformanceAnalytics,
// );

// ============ FUTURE PHASE 2 ROUTES (Commented for now) ============
/*
// Course Registration & Management
router.post("/:studentId/courses", verifyAdminRole, restrictTo("admin", "superAdmin", "hod"), registerStudentCourses);
router.get("/:studentId/courses", verifyAdminRole, restrictTo("admin", "superAdmin", "hod", "faculty"), getStudentCourses);
router.delete("/:studentId/courses/:courseId", verifyAdminRole, restrictTo("admin", "superAdmin"), dropStudentCourse);

// Marks & Grades Management  
router.post("/:studentId/grades", verifyAdminRole, restrictTo("admin", "superAdmin", "hod", "faculty"), addUpdateGrades);
router.get("/:studentId/grades", verifyAdminRole, restrictTo("admin", "superAdmin", "hod", "faculty"), getStudentGrades);
router.get("/:studentId/cgpa", verifyAdminRole, restrictTo("admin", "superAdmin", "hod", "faculty"), calculateCGPA);

// Advanced Academic Management
router.get("/:studentId/backlogs", verifyAdminRole, restrictTo("admin", "superAdmin", "hod", "faculty"), getStudentBacklogs);
router.post("/:studentId/clear-backlog", verifyAdminRole, restrictTo("admin", "superAdmin"), clearBacklog);
*/

//export default router;

// Student Routes (StudentManagement.routes.js)
// StudentManagement.routes.js - Phase 2 Enhanced Routes
import express from "express";
import {
  // Phase 1 Controllers (existing)
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  getStudentAcademicHistory,
  //bulkImportStudents,
  assignProctor,
  promoteStudents,
  getStudentsByDepartment,
  getStudentBacklogs,
  updateStudentSemester,
  searchStudents,
  getStudentStatistics,

  // Phase 2 Controllers (new)
  registerStudentCourses,
  getStudentGrades,
  addOrUpdateGrades,
  calculateStudentCGPA,
  bulkPromoteSemester,
  getAcademicAnalytics,
  //getStudentTranscript,
  //getBacklogAnalytics,
  validateCourseRegistration,
  //getStudentSemesterPerformance,
  //bulkUpdateGrades,
  //generateProgressReport,
  //getElectiveRecommendations,
  //getStudentRankings,
  //exportAcademicData,
} from "../controllers/StudentManagement.Controllers.js";

import {
  restrictTo,
  verifyJWT,
  verifyAdminRole,
} from "../middlewares/auth.Middleware.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyJWT);
router.use(verifyAdminRole);

// ==================== PHASE 1 ROUTES (EXISTING) ====================
// Student CRUD Operations
router.get("/", restrictTo("admin"), asyncHandler(getAllStudents));
router.get("/search", restrictTo("admin"), asyncHandler(searchStudents));
router.get(
  "/statistics",
  restrictTo("admin"),
  asyncHandler(getStudentStatistics),
);
router.get("/:id", restrictTo("admin"), asyncHandler(getStudentById));
router.put("/:id", restrictTo("admin"), asyncHandler(updateStudent));
router.delete("/:id", restrictTo("admin"), asyncHandler(deleteStudent));

// Academic Operations
router.get(
  "/:id/academic",
  restrictTo("admin"),
  asyncHandler(getStudentAcademicHistory),
);
router.get(
  "/:id/backlogs",
  restrictTo("admin"),
  asyncHandler(getStudentBacklogs),
);
router.put(
  "/:id/semester",
  restrictTo("admin"),
  asyncHandler(updateStudentSemester),
);

// Bulk Operations
router.put("/bulk/promote", restrictTo("admin"), asyncHandler(promoteStudents));

// Proctor Management
router.put("/:id/proctor", restrictTo("admin"), asyncHandler(assignProctor));

// Department Scoped
router.get(
  "/department/:departmentId",
  restrictTo("admin"),
  asyncHandler(getStudentsByDepartment),
);

// ==================== PHASE 2 ROUTES (NEW) ====================

// Course Registration Management
router.post(
  "/:id/courses",
  restrictTo("admin"),
  asyncHandler(registerStudentCourses),
); // Register student for courses

router.get(
  "/:id/courses/validate",
  restrictTo("admin"),
  asyncHandler(validateCourseRegistration),
); // Validate course registration eligibility

// router.get(
//   "/:id/electives/recommendations",
//   restrictTo("admin"),
//   asyncHandler(getElectiveRecommendations),
// ); // Get recommended electives

// Grades Management
router.get("/:id/grades", restrictTo("admin"), asyncHandler(getStudentGrades)); // Get all grades for a student

router.post(
  "/:id/grades",
  restrictTo("admin"),
  asyncHandler(addOrUpdateGrades),
); // Add/update individual grades

//router.put("/bulk/grades", restrictTo("admin"), asyncHandler(bulkUpdateGrades)); // Bulk update grades for multiple students

// Academic Performance & Analytics
router.get(
  "/:id/cgpa",
  restrictTo("admin"),
  asyncHandler(calculateStudentCGPA),
); // Calculate and get comprehensive CGPA data

// router.get(
//   "/:id/transcript",
//   restrictTo("admin"),
//   asyncHandler(getStudentTranscript),
// ); // Get complete academic transcript

// router.get(
//   "/:id/performance/:semesterId",
//   restrictTo("admin"),
//   asyncHandler(getStudentSemesterPerformance),
// ); // Get detailed semester performance

// router.get(
//   "/:id/progress-report",
//   restrictTo("admin"),
//   asyncHandler(generateProgressReport),
// ); // Generate comprehensive progress report

// Semester Promotion & Management
router.post(
  "/promote-semester",
  restrictTo("admin"),
  asyncHandler(bulkPromoteSemester),
); // Bulk semester promotion with validation

// Analytics & Reporting
router.get(
  "/analytics/academic",
  restrictTo("admin"),
  asyncHandler(getAcademicAnalytics),
); // Academic performance analytics

// router.get(
//   "/analytics/backlogs",
//   restrictTo("admin"),
//   asyncHandler(getBacklogAnalytics),
// ); // Backlog analysis and trends

//router.get("/rankings", restrictTo("admin"), asyncHandler(getStudentRankings)); // Student rankings by CGPA, semester, etc.

// Data Export
// router.get(
//   "/export/academic",
//   restrictTo("admin"),
//   asyncHandler(exportAcademicData),
// ); // Export academic data in various formats

// ==================== VALIDATION MIDDLEWARE ROUTES ====================
// Add validation middleware for course registration
router.use("/:id/courses", (req, res, next) => {
  // Validate semester enrollment rules
  // Check for prerequisite courses
  // Validate credit limits
  next();
});

export default router;
