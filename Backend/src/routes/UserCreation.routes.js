import express from "express";

import {
  createUser,
  createSuperAdmin,
  // Add these new imports
  addDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  updateDepartmentStatus,
  deleteDepartment,
  getDepartmentStats
} from "../controllers/UserCreation.Controllers.js";

import {
  verifyJWT,
  // verifiedEmailOnly,
  restrictTo,
  hasAdminPermission,
  hasFacultyPermission,
} from "../middlewares/auth.Middleware.js";

const router = express.Router();

// User creation routes with role-based restrictions
router.use(verifyJWT);

// Department CRUD operations
router.post("/department", restrictTo("superAdmin"), addDepartment);
router.get("/departments", restrictTo("superAdmin", "admin"), getAllDepartments);
router.get("/department/:id", restrictTo("superAdmin", "admin", "hod"), getDepartmentById);
router.put("/department/:id", restrictTo("superAdmin"), updateDepartment);
router.delete("/department/:id", restrictTo("superAdmin"), deleteDepartment);

// Department status management
router.patch("/department/:id/status", restrictTo("superAdmin"), updateDepartmentStatus);

// Department statistics and analytics
router.get("/departments/stats", restrictTo("superAdmin", "admin"), getDepartmentStats);

// ============ USER CREATION ROUTES ============
// Super Admin can create other Super Admins
router.post(
  "/register/superadmin/superadmin",
  restrictTo("superAdmin"),
  createSuperAdmin,
);

// Super Admin can create any type of user
router.post("/register/superadmin/admin", restrictTo("superAdmin"), createUser);
router.post("/register/superadmin/hod", restrictTo("superAdmin"), createUser);

// Admin can create HODs, faculty, and students
router.post(
  "/register/admin/hod",
  restrictTo("admin"),
  hasAdminPermission("CREATE_HOD"),
  createUser,
);

router.post(
  "/register/admin/faculty",
  restrictTo("admin"),
  createUser,
);

router.post(
  "/register/admin/student",
  restrictTo("admin"),
  hasAdminPermission("CREATE_STUDENT"),
  createUser,
);

// HOD can create faculty and students in their department
router.post(
  "/register/HOD/faculty",
  restrictTo("hod"),
  hasFacultyPermission(true),
  createUser,
);

router.post(
  "/register/HOD/student",
  restrictTo("hod"),
  hasFacultyPermission(true),
  createUser,
);

// Faculty (including Class Teacher/Proctor) can create students
router.post(
  "/register/Faculty/student",
  restrictTo("faculty"),
  hasFacultyPermission(true),
  createUser,
);

export default router;