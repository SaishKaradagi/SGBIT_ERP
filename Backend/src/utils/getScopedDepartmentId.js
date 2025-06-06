import mongoose from "mongoose";
import { ApiError } from "./ApiError.js"; // Update the path if it's different

/**
 * Extracts a single departmentId from the admin user's department scope.
 * Throws an error if none or multiple departments are found.
 */
export function getScopedDepartmentId(req) {
  const departmentScope = req.user.adminInfo?.departmentScope;

  if (!departmentScope || departmentScope.length === 0) {
    throw new ApiError(403, "No departments assigned to this admin");
  }

  if (departmentScope.length > 1) {
    throw new ApiError(
      400,
      "Multiple departments in scope — please specify one explicitly",
    );
  }

  const departmentId = departmentScope[0]._id || departmentScope[0];
  return new mongoose.Types.ObjectId(departmentId);
}
