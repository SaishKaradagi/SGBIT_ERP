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
router.put("/budget", updateBudget);
router.get("/budget/analytics", getBudgetAnalytics);

export default router;
