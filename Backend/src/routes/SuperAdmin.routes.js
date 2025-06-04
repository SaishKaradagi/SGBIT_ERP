import express from "express";

// Department CRUD Controllers
import {
  addDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  updateDepartmentStatus,
  deleteDepartment,
} from "../controllers/DepartmentCreation.Controllers.js";

// Analytics Controllers
import {
  getDashboardOverview,
  getDetailedUserAnalytics,
  getDepartmentPerformanceMetrics,
  getSystemResourceUsage,
  getDepartmentStatistics, 
  getCollectionSizes,
  getRecentErrorCount,
  getCurrentFiscalYear,
  getCurrentAcademicYear,
  getCriticalAlerts,
  getRecentActivities,
  getSystemHealthMetrics,
  getFinancialStatistics,
  getAcademicStatistics,
  getUserStatistics,
} from "../controllers/DepartmentAnalytics.Controllers.js";


// Authentication Middleware
import { verifyJWT, restrictTo } from "../middlewares/auth.Middleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyJWT);

// ============ DEPARTMENT CRUD OPERATIONS ============

// Department CRUD operations
router.post("/department", restrictTo("superAdmin"), addDepartment);
router.get(
  "/departments",
  restrictTo("superAdmin", "admin"),
  getAllDepartments,
);
router.get(
  "/department/:id",
  restrictTo("superAdmin", "admin", "hod"),
  getDepartmentById,
);
router.put("/department/:id", restrictTo("superAdmin"), updateDepartment);
router.delete("/department/:id", restrictTo("superAdmin"), deleteDepartment);

// Department status management
router.patch(
  "/department/:id/status",
  restrictTo("superAdmin"),
  updateDepartmentStatus,
);

// ============ DEPARTMENT STATISTICS ============

// Department statistics and analytics
router.get(
  "/departments/stats",
  restrictTo("superAdmin", "admin"),
  getDepartmentStatistics,
);

// ============ DASHBOARD & ANALYTICS ROUTES ============

// Main dashboard overview
router.get(
  "/dashboard/overview",
  restrictTo("superAdmin"),
  getDashboardOverview,
);

// Detailed analytics endpoints
router.get(
  "/analytics/users",
  restrictTo("superAdmin", "admin"),
  getDetailedUserAnalytics,
);

router.get(
  "/analytics/departments",
  restrictTo("superAdmin", "admin"),
  getDepartmentPerformanceMetrics,
);

router.get(
  "/analytics/system",
  restrictTo("superAdmin"),
  getSystemResourceUsage,
);

router.get(
  "/database/stats",
  restrictTo("superAdmin"),
  getCollectionSizes
);

router.get(
  "/system/errors",
  restrictTo("superAdmin"),
  getRecentErrorCount
);

router.get(
  "/system/fiscal-year",
  restrictTo("superAdmin"),
  getCurrentFiscalYear
);

router.get(
  "/system/academic-year",
  restrictTo("superAdmin"),
  getCurrentAcademicYear
);

router.get(
  "/system/critical-alerts",
  restrictTo("superAdmin"),
  getCriticalAlerts
);

router.get(
  "/system/recent-activities",
  restrictTo("superAdmin"),
  getRecentActivities
);

router.get(
  "/system/health",
  restrictTo("superAdmin"),
  getSystemHealthMetrics
);

router.get(
  "/financial/stats",
  restrictTo("superAdmin", "admin"),
  getFinancialStatistics
);

router.get(
  "/academic/stats",
  restrictTo("superAdmin", "admin"),
  getAcademicStatistics
);

router.get(
  "/users/stats",
  restrictTo("superAdmin", "admin"),
  getUserStatistics
);

export default router;