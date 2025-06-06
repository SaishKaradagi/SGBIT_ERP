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

const router = Router();

// Apply authentication middleware to all routes
router.use(verifyJWT);
router.use(verifyAdminRole);
// router.use(restrictTo("admin"));
// Dashboard Overview
router.get("/overview", getDashboardOverview); //done

// Faculty Management Routes
router.get("/faculty", getFacultyList); //done
router.post("/faculty/assign-hod", assignHOD);
router.delete("/faculty/remove-hod", removeHOD);

// Student Management Routes
router.get("/students", getStudentList);

// Academic Analytics Routes
router.get("/analytics/academic", getAcademicAnalytics);

// Notice Management Routes
router.post("/notices", createNotice);
router.get("/notices", getNotices);

// Course Management Routes
router.get("/courses", getCourseList);
router.post("/courses", createCourse);

// Budget Management Routes
router.put("/budget", updateBudget);
router.get("/budget/analytics", getBudgetAnalytics);

export default router;
