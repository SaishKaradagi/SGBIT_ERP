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
import express from "express";
import {
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  getStudentAcademicHistory,
  bulkImportStudents,
  assignProctor,
  promoteStudents,
  getStudentsByDepartment,
  getStudentBacklogs,
  updateStudentSemester,
  searchStudents,
  getStudentStatistics,
} from "../controllers/StudentManagement.Controllers.js";
import {
  restrictTo,
  verifyJWT,
  verifyAdminRole,
} from "../middlewares/auth.Middleware.js";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
//import { upload } from "../middlewares/multer.middleware.js"; // Assuming you have multer setup

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyJWT);
router.use(verifyAdminRole);

// Student CRUD Operations
router.get("/", restrictTo("admin"), asyncHandler(getAllStudents)); //done
router.get("/search", restrictTo("admin"), asyncHandler(searchStudents)); //done
router.get(
  "/statistics",
  restrictTo("admin"),
  asyncHandler(getStudentStatistics),
); //done
router.get("/:id", restrictTo("admin"), asyncHandler(getStudentById)); //done
router.put("/:id", restrictTo("admin"), asyncHandler(updateStudent)); //done
router.delete("/:id", restrictTo("admin"), asyncHandler(deleteStudent));

// Academic Operations
router.get(
  "/:id/academic",
  restrictTo("admin"),
  asyncHandler(getStudentAcademicHistory),
); //done
router.get(
  "/:id/backlogs",
  restrictTo("admin"),
  asyncHandler(getStudentBacklogs),
); //done
router.put(
  "/:id/semester",
  restrictTo("admin"),
  asyncHandler(updateStudentSemester),
); //done

// Bulk Operations
// router.post(
//   "/bulk-import",
//   restrictTo("admin"),
//   upload.single("file"),
//   asyncHandler(bulkImportStudents),
// );
router.put("/bulk/promote", restrictTo("admin"), asyncHandler(promoteStudents));

// Proctor Management
router.put("/:id/proctor", restrictTo("admin"), asyncHandler(assignProctor)); //done

// Department Scoped
router.get(
  "/department/:departmentId",
  restrictTo("admin"),
  asyncHandler(getStudentsByDepartment),
);

export default router;
