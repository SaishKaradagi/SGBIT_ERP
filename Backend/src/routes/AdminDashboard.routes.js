// Backend/src/routes/AdminDashboard.routes.js
import { Router } from "express";
import {
  getDashboardOverview,
  getFacultyList,
  assignHOD,
  removeHOD,
  getStudentList,
  getAcademicAnalytics,
  createNotice,
  getNotices,
  getCourseList,
  createCourse,
  updateBudget,
  getBudgetAnalytics,
} from "../controllers/AdminDashboard.Controllers.js";
import {
  restrictTo,
  verifyJWT,
  verifyAdminRole,
} from "../middlewares/auth.Middleware.js";

import {
  getMyDepartmentStatistics,
  getMyDepartmentUserAnalytics,
  getDepartmentPerformanceMetrics,
  getFinancialStatistics,
  getAcademicStatistics,
  getUserStatistics,
  getAllFaculties,
  getStudentsBySemester,
} from "../controllers/AdmingetDepartmentStatistics.js";
const router = Router();

// Apply authentication middleware to all routes
router.use(verifyJWT);
router.use(verifyAdminRole);
// router.use(restrictTo("admin"));
// Dashboard Overview
router.get("/overview", getDashboardOverview); //done

// Faculty Management Routes
router.get("/faculty", getFacultyList); //done
router.post("/faculty/assign-hod", assignHOD); //done
router.delete("/faculty/remove-hod", removeHOD); //done

// Student Management Routes
router.get("/students", getStudentList); //done

// Academic Analytics Routes
router.get("/analytics/academic", getAcademicAnalytics); //done

// Notice Management Routes
router.post("/notices", createNotice); //done
router.get("/notices", getNotices); //done

// Course Management Routes
router.get("/courses", getCourseList); //done
router.post("/courses", createCourse); //done

// Budget Management Routes
router.put("/budget", updateBudget); //done
router.get("/budget/analytics", getBudgetAnalytics); //done

// ============ DEPARTMENT STATISTICS ============

// Department statistics and analytics
router.get(
  "/departments/stats",
  restrictTo("admin"),
  getMyDepartmentStatistics,
); //done

// Detailed analytics endpoints
router.get(
  "/analytics/users",
  restrictTo("superAdmin", "admin"),
  getMyDepartmentUserAnalytics,
); //done

router.get(
  "/analytics/departments",
  restrictTo("superAdmin", "admin"),
  getDepartmentPerformanceMetrics,
); //done

router.get(
  "/financial/stats",
  restrictTo("superAdmin", "admin"),
  getFinancialStatistics,
); //done

router.get(
  "/academic/stats",
  restrictTo("superAdmin", "admin"),
  getAcademicStatistics,
); //done

router.get(
  "/users/stats",
  restrictTo("superAdmin", "admin"),
  getUserStatistics,
); //done

// ============ USER MANAGEMENT ROUTES ============

// 1) List All HODs
router.get("/getAllFaculties", restrictTo("admin"), getAllFaculties); //done
router.post(
  "/getStudentsBySemester",
  restrictTo("admin"),
  getStudentsBySemester,
); // neeed to change the student model to include semester

export default router;
