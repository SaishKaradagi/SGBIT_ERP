import express from "express";

import {
  createUser,
  createSuperAdmin,
} from "../controllers/UserCreation.Controllers.js";

import {
  verifyJWT,
  // verifiedEmailOnly,
  restrictTo,
  hasAdminPermission,
  hasFacultyPermission,
} from "../middlewares/auth.Middleware.js";

const router = express.Router();

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

router.post("/register/admin/faculty", restrictTo("admin"), createUser);

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
