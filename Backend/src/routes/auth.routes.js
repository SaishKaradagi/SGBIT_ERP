// auth.Routes.js
import express from "express";
import {
  registerUser,
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
} from "../middlewares/auth.Middleware.js";

const router = express.Router();

// Public routes
router.post("/register", registerUser);
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

export default router;
