import express from "express";
import {
  // Add these new imports
  addDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  updateDepartmentStatus,
  deleteDepartment,
  getDepartmentStatistics,
} from "../controllers/DepartmentCreation.Controllers.js";

import { verifyJWT, restrictTo } from "../middlewares/auth.Middleware.js";
const router = express.Router();

// User creation routes with role-based restrictions
router.use(verifyJWT);

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

// Department statistics and analytics
router.get(
  "/departments/stats",
  restrictTo("superAdmin", "admin"),
  getDepartmentStatistics,
);

export default router;
