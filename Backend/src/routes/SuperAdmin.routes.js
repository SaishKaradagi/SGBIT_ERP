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



// User Management Controllers (you'll need to create these)
import {
  getAllHODs,
  getAllAdmins,
  getDepartmentHOD,
  getDepartmentAdmin,
  updateAdminDetails,
  getDepartmentFaculty,
  getDepartmentStudents,
  updateUserStatus,
  getAllUsers,
  getUserById,
} from "../controllers/UserManagement.Controllers.js";

import { 
  deleteUser, 
  restoreUser, 
  getDeletedUsers, 
  permanentlyDeleteUser 
} from '../controllers/UserDeletion.Controllers.js';

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






// ============ USER MANAGEMENT ROUTES ============

// 1) List All HODs
router.get(
  "/hods",
  restrictTo("superAdmin", "admin"),
  getAllHODs
); //done

// 2) List All Admins
router.get(
  "/admins",
  restrictTo("superAdmin"),
  getAllAdmins
); //done

// 3) Get particular HOD of a department
router.get(
  "/department/:id/hod",
  restrictTo("superAdmin", "admin"),
  getDepartmentHOD
); //done

// 4) Get particular admin of a department
router.get(
  "/department/:id/admin",
  restrictTo("superAdmin", "admin"),
  getDepartmentAdmin
); //done

// 5) Patch admin details
router.patch(
  "/admin/:id",
  restrictTo("superAdmin"),
  updateAdminDetails
); //done

// 6) Faculty list based on department
router.get(
  "/department/:id/faculty",
  restrictTo("superAdmin", "admin", "hod"),
  getDepartmentFaculty
); //done

// 7) Get all students based on department and semester
router.get(
  "/department/:id/students",
  restrictTo("superAdmin", "admin", "hod"),
  getDepartmentStudents
); //done

// 8) Delete user (role-based permissions)
router.delete(
  "/deleteUser/:id",
  restrictTo("superAdmin", "admin", "hod"),
  deleteUser
);
//8a)
router.patch('/users/:id/restore',restrictTo("superAdmin"), restoreUser);
//8b)
router.get('/users/deleted', restrictTo("superAdmin", "admin", "hod"),getDeletedUsers);
//8c)
router.delete('/users/:id/permanent', restrictTo("superAdmin"),permanentlyDeleteUser);

//all above done

// 9) Super admin can patch any user by activating/deactivating
router.patch(
  "/user/:id/status",
  restrictTo("superAdmin", "admin"),
  updateUserStatus
);//done

// 10) List all users with filters (role, department, status)
router.get(
  "/users",
  restrictTo("superAdmin", "admin"),
  getAllUsers
); //done

// 11) Get specific user details
router.get(
  "/user/:id",
  restrictTo("superAdmin", "admin", "hod"),
  getUserById
); //done

export default router;