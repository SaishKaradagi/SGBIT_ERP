// // auth.Routes.js
// import express from "express";
// import {
//   registerUser,
//   loginUser,
//   loginRateLimit,
//   verifyEmail,
//   logoutUser,
//   refreshAccessToken,
//   changePassword,
//   forgotPassword,
//   resetPassword,
//   getCurrentUser,
// } from "../controllers/auth.Controllers.js";
// import {
//   verifyJWT,
//   verifiedEmailOnly,
// } from "../middlewares/auth.Middleware.js";

// const router = express.Router();

// // Public routes
// router.post("/register", registerUser);
// router.post("/login", loginRateLimit, loginUser);
// router.get("/verify-email/:token", verifyEmail);
// router.post("/forgot-password", forgotPassword);
// router.post("/reset-password/:token", resetPassword);
// router.post("/refresh-token", refreshAccessToken);

// // Protected routes (require authentication)
// router.use(verifyJWT); // Apply JWT verification to all routes below

// router.get("/me", getCurrentUser);
// router.post("/logout", logoutUser);
// router.post("/change-password", verifiedEmailOnly, changePassword);
// router.get("/getCurrentUser", verifiedEmailOnly, getCurrentUser);

// export default router;

// auth.Routes.js
import express from "express";
import {
  createUser,
  createSuperAdmin,
  loginUser,
  loginRateLimit,
  verifyEmail,
  logoutUser,
  refreshAccessToken,
  changePassword,
  forgotPassword,
  resetPassword,
  getCurrentUser,
} from "../controllers/auth.Controllers.js";
import {
  verifyJWT,
  verifiedEmailOnly,
  restrictTo,
  hasAdminPermission,
  hasFacultyPermission,
} from "../middlewares/auth.Middleware.js";

const router = express.Router();

// Public routes
router.post("/login", loginRateLimit, loginUser);
router.get("/verify-email/:token", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/refresh-token", refreshAccessToken);

// Protected routes (require authentication)
router.use(verifyJWT); // Apply JWT verification to all routes below
router.get("/me", getCurrentUser);
router.post("/logout", logoutUser);
router.post("/change-password", verifiedEmailOnly, changePassword);
router.get("/getCurrentUser", verifiedEmailOnly, getCurrentUser);

// User creation routes with role-based restrictions

// Super Admin can create other Super Admins
router.post("/register/superadmin", restrictTo("superAdmin"), createSuperAdmin);

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
