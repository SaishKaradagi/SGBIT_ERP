import mongoose from "mongoose";
import User from "../models/user.model.js";
import Department from "../models/department.model.js";
import { Address } from "../models/address.model.js";
import Faculty from "../models/Faculty.Model.js";

import crypto from "crypto";
import { asyncHandler } from "../middlewares/asyncHandler.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendEmail } from "../utils/emailService.js";
import { generateTokens } from "./auth.Controllers.js";

import dotenv from "dotenv";

dotenv.config();

export const createSuperAdmin = asyncHandler(async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    email,
    password,
    dob,
    gender,
    phone,
    designation,
    departmentScope,
  } = req.body;

  // Check if request is from another Super Admin (if not initialization)
  if (req.user && req.user.role !== "superAdmin") {
    throw new ApiError(403, "Only Super Admins can create other Super Admins");
  }

  const User = mongoose.model("User");
  const Admin = mongoose.model("Admin");

  // Check if user with the same email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  let user; // Declare user variable in outer scope

  try {
    // Create user with SuperAdmin role and active status
    user = await User.create({
      firstName,
      middleName,
      lastName,
      email,
      password, // Will be hashed in the pre-save hook
      role: "superAdmin",
      dob: new Date(dob),
      gender,
      phone,
      designation: designation,
      status: "active", // Super Admins are immediately active
      isEmailVerified: true, // Auto-verify Super Admin email
      createdBy: req.user ? req.user._id : null, // Track creator if not initialization
    });

    // Handle department scope conversion for Super Admin
    let departmentIds = [];

    if (
      departmentScope &&
      Array.isArray(departmentScope) &&
      departmentScope.length > 0
    ) {
      // Convert department codes to ObjectIds
      const Department = mongoose.model("Department");
      const departments = await Department.find({
        code: { $in: departmentScope },
      });

      if (departments.length !== departmentScope.length) {
        throw new ApiError(400, "Some department codes are invalid");
      }

      departmentIds = departments.map((dept) => dept._id);
    } else {
      // For Super Admins, if no departmentScope provided, give them access to all departments
      const Department = mongoose.model("Department");
      const allDepartments = await Department.find({ status: "active" });
      departmentIds = allDepartments.map((dept) => dept._id);
    }

    // Create admin record for the Super Admin
    const admin = await Admin.create({
      user: user._id, // Reference to the created user
      departmentScope: departmentIds, // All departments for Super Admins or specified ones
      designation: designation || "Super Admin",
    });

    // Generate tokens
    const { token, refreshToken } = generateTokens(user._id);

    // Return success response
    return res.status(201).json(
      new ApiResponse(
        201,
        {
          user: {
            id: user._id,
            uuid: user.uuid,
            name: user.fullName,
            email: user.email,
            role: user.role,
            status: user.status,
          },
          admin: {
            id: admin._id,
            departmentScope: admin.departmentScope,
            designation: admin.designation,
          },
          token,
          refreshToken,
        },
        "Super Admin created successfully",
      ),
    );
  } catch (error) {
    // If any step fails, clean up the user if it was created
    if (user && user._id) {
      try {
        await User.findByIdAndDelete(user._id);
        console.log("Cleaned up user record due to error");
      } catch (cleanupError) {
        console.error("Error during cleanup:", cleanupError.message);
      }
    }

    throw new ApiError(500, `Error creating Super Admin: ${error.message}`);
  }
});

// Initialize Super Admin - utility function for system initialization
// Fix for initializeSuperAdmin function
export const initializeSuperAdmin = async (superAdminDetails) => {
  try {
    // Check if any Super Admin already exists
    const existingSuperAdmin = await User.findOne({ role: "superAdmin" });

    if (existingSuperAdmin) {
      console.log("✅ Super Admin already exists, skipping initialization");
      return { success: true, message: "Super Admin already exists" };
    }

    // Create the first Super Admin
    const result = await createSuperAdmin({
      body: superAdminDetails,
      user: null, // Explicitly set user to null for initialization
    });

    // Check if the result contains user and admin
    if (!result || !result.user) {
      throw new Error("Failed to create Super Admin - no user returned");
    }

    console.log(`✅ Initial Super Admin created: ${result.user.email}`);
    return {
      success: true,
      message: "Super Admin initialized successfully",
      user: {
        id: result.user._id,
        email: result.user.email,
        name: result.user.fullName,
      },
    };
  } catch (error) {
    console.error("❌ Failed to initialize Super Admin:", error);
    return { success: false, message: error.message };
  }
};

export const createUser = asyncHandler(async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    email,
    password,
    role: requestedRole,
    dob,
    gender,
    phone,
    departmentId,
    departmentScope = [],
    designation,
    facultyId,
    isProctorOrAdvisor,
    isActive,
    dateOfJoining,
    dateOfRelieving,
    tenureStatus,
    qualification,
    employeeId,
    specialization,
    employmentType,
    usn,
    admissionYear,
    batch,
    section,
    proctor,
  } = req.body;

  const User = mongoose.model("User");
  const Department = mongoose.model("Department");

  // 1. Email Duplication Check
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  // 2. Role-based Authorization
  const creatorRole = req.user.role.toLowerCase();
  const rolePermissions = {
    superadmin: ["admin", "hod", "faculty", "student", "staff"],
    admin: ["hod", "faculty", "student", "staff"],
    hod: ["faculty", "student"],
    faculty: ["student"],
  };

  if (
    !rolePermissions[creatorRole] ||
    !rolePermissions[creatorRole].includes(requestedRole.toLowerCase())
  ) {
    throw new ApiError(
      403,
      `${creatorRole} cannot create users with ${requestedRole} role`,
    );
  }

  // 3. Validate departmentId if role is department-based
  let department = null; // Initialize department variable
  if (["hod", "faculty", "student"].includes(requestedRole)) {
    if (!departmentId) {
      throw new ApiError(400, "Department ID is required for this role");
    }

    department = await Department.findOne({ _id: departmentId });
    if (!department) throw new ApiError(404, "Department not found");
    if (department.status !== "active")
      throw new ApiError(400, "Department is not active");

    if (requestedRole === "hod" && department.hod) {
      throw new ApiError(409, "Department already has an HOD assigned");
    }
  }

  // 4. Create the user
  const user = await User.create({
    firstName,
    middleName,
    lastName,
    email,
    password, // to be hashed in pre-save
    role: requestedRole,
    dob: new Date(dob),
    gender,
    phone,
    designation,
    status: "pending",
    createdBy: req.user._id,
  });

  // 5. Create Role-Specific Records
  try {
    if (requestedRole === "faculty") {
      const Faculty = mongoose.model("Faculty");
      await Faculty.create({
        user: user._id,
        departmentId: departmentId,
        facultyId: facultyId,
        designation: designation,
        role: requestedRole,
        isProctorOrAdvisor: isProctorOrAdvisor,
        isActive: isActive,
        dateOfJoining: dateOfJoining,
        dateOfRelieving: dateOfRelieving,
        tenureStatus: tenureStatus,
        qualification: qualification,
        employeeId: employeeId,
        specialization: specialization,
        employmentType: employmentType,
      }).catch((err) => {
        console.log(err);
        console.log("Error creating faculty record:", err.message);
      });
    } else if (requestedRole === "hod") {
      const Faculty = mongoose.model("Faculty");
      const faculty = await Faculty.create({
        user: user._id,
        departmentId: departmentId,
        facultyId: facultyId,
        designation: designation,
        role: requestedRole,
        isProctorOrAdvisor: isProctorOrAdvisor,
        isActive: isActive,
        dateOfJoining: dateOfJoining,
        dateOfRelieving: dateOfRelieving,
        tenureStatus: tenureStatus,
        qualification: qualification,
        employeeId: employeeId,
        specialization: specialization,
        employmentType: employmentType,
        department: department, // Now properly initialized
      });

      // Use the department variable that was already fetched and validated
      await department.assignHOD(faculty._id);
    } else if (requestedRole === "student") {
      const Student = mongoose.model("Student");

      // Validate required student fields
      if (!usn) {
        throw new ApiError(400, "USN is required for student");
      }
      if (!admissionYear) {
        throw new ApiError(400, "Admission year is required for student");
      }
      if (!section) {
        throw new ApiError(400, "Section is required for student");
      }
      if (!batch) {
        throw new ApiError(400, "Batch is required for student");
      }

      await Student.create({
        firstName,
        middleName,
        lastName,
        email,
        phone,
        dob: new Date(dob),
        gender,
        usn,
        admissionYear: parseInt(admissionYear),
        section,
        department: departmentId,
        batch,
        proctor,
        user: user._id,
      });
    } else if (requestedRole === "admin") {
      const Admin = mongoose.model("Admin");

      // Convert departmentScope codes to ObjectIds
      if (!Array.isArray(departmentScope)) {
        throw new ApiError(400, "departmentScope must be an array");
      }

      const departments = await Department.find({
        code: { $in: departmentScope },
      });

      if (
        !user.isSuperAdmin &&
        (departments.length === 0 ||
          departments.length !== departmentScope.length)
      ) {
        throw new ApiError(
          400,
          "Invalid or missing department codes in departmentScope",
        );
      }

      const departmentIds = departments.map((d) => d._id);

      await Admin.create({
        user: user._id,
        departmentScope: departmentIds,
        designation: designation || "Admin",
      });
    }

    // Add other role branches if needed
  } catch (err) {
    await User.findByIdAndDelete(user._id); // Rollback on failure
    throw new ApiError(
      500,
      `Error creating ${requestedRole} record: ${err.message}`,
    );
  }

  // 6. Email Verification Setup
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  user.metadata = {
    emailVerificationToken: hashedToken,
    emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  await user.save();

  const verificationURL = `${req.protocol}://${req.get(
    "host",
  )}/api/v1/auth/verify-email/${verificationToken}`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your Account Has Been Created - Email Verification",
      template: "email-verification",
      data: {
        name: user.firstName,
        creatorName: req.user.fullName,
        creatorRole,
        verificationURL,
      },
    });
  } catch (emailErr) {
    user.metadata.emailVerificationToken = undefined;
    user.metadata.emailVerificationExpires = undefined;
    await user.save();
  }

  // 7. Final Response
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user: {
          id: user._id,
          uuid: user.uuid,
          name: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
      `${requestedRole} account created successfully. Email verification ${
        user.metadata?.emailVerificationToken ? "sent." : "failed to send."
      }`,
    ),
  );
});
