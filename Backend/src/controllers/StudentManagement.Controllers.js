// Student Management Controllers (StudentManagement.Controllers.js)
import Student from "../models/student.model.js";
import User from "../models/user.model.js";
import Department from "../models/department.model.js";
import Batch from "../models/batch.model.js";
import Faculty from "../models/faculty.model.js";
import ExamResult from "../models/examResult.model.js";
import Semester from "../models/semester.model.js";
import Course from "../models/course.model.js";
import CourseRegistration from "../models/courseRegistration.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getScopedDepartmentId } from "../utils/getScopedDepartmentId.js";
import xlsx from "xlsx";
import mongoose from "mongoose";

// Get all students with filtering and pagination
export const getAllStudents = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    department,
    batch,
    semester,
    proctor,
    section,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Determine the department based on role scope
  const departmentId = await getScopedDepartmentId(req, department);

  if (!departmentId && req.user.role !== "superAdmin") {
    throw new ApiError(403, "Access denied: Department scope required");
  }

  // Pagination and sorting options
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
  };

  // Base query
  const query = departmentId ? { department: departmentId } : {};

  // Apply filters
  if (batch) query.batch = batch;
  if (semester) query["academics.currentSemester"] = parseInt(semester);
  if (proctor) query.proctor = proctor;
  if (section) query.section = section;
  if (search) {
    query.$or = [
      { usn: new RegExp(search, "i") },
      { "user.firstName": new RegExp(search, "i") },
      { "user.lastName": new RegExp(search, "i") },
      { "user.email": new RegExp(search, "i") },
    ];
  }

  // Fetch students with population
  const students = await Student.find(query)
    .populate("user", "firstName middleName lastName email phone status")
    .populate("department", "name code")
    .populate("batch", "code academicYear")
    .populate({
      path: "proctor",
      populate: {
        path: "user",
        select: "firstName middleName lastName email phone gender fullName",
      },
    })
    .sort(options.sort)
    .limit(options.limit)
    .skip((options.page - 1) * options.limit);

  // Count total records
  const total = await Student.countDocuments(query);

  // Return response
  res.status(200).json(
    new ApiResponse(
      200,
      {
        students,
        pagination: {
          current: options.page,
          total: Math.ceil(total / options.limit),
          count: students.length,
          totalRecords: total,
        },
      },
      "Students retrieved successfully",
    ),
  );
};

// Get student by ID with complete details
export const getStudentById = async (req, res) => {
  const { id } = req.params;

  const student = await Student.findById(id)
    .populate("user", "-password -passwordHistory")
    .populate("department", "name code description")
    .populate("batch", "code academicYear capacity")
    .populate("proctor", "user qualification");
  // .populate("guardians");

  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  // Check department access
  const departmentId = await getScopedDepartmentId(req);
  if (departmentId && !student.department._id.equals(departmentId)) {
    throw new ApiError(403, "Access denied: Department scope restriction");
  }

  // Get academic summary
  const cgpa = await student.updateCGPA();
  const backlogCount = await student.updateBacklogCount();
  const addresses = await student.getAllAddresses();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        student: {
          ...student.toObject(),
          addresses,
          academicSummary: {
            cgpa,
            backlogCount,
            currentSemester: student.academics.currentSemester,
            performance:
              cgpa >= 8.5
                ? "Excellent"
                : cgpa >= 7.0
                  ? "Good"
                  : cgpa >= 6.0
                    ? "Average"
                    : "Poor",
          },
        },
      },
      "Student details retrieved successfully",
    ),
  );
};

// Update student information
export const updateStudent = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  // Check department access
  const departmentId = await getScopedDepartmentId(req);
  if (departmentId && !student.department.equals(departmentId)) {
    throw new ApiError(403, "Access denied: Department scope restriction");
  }

  // Validate updates
  const allowedUpdates = [
    "section",
    "proctor",
    "religion",
    "caste",
    "category",
    "academics.currentSemester",
    "academics.achievements",
  ];

  const updateKeys = Object.keys(updates);
  const isValidUpdate = updateKeys.every(
    (key) => allowedUpdates.includes(key) || key.startsWith("academics."),
  );

  if (!isValidUpdate) {
    throw new ApiError(400, "Invalid update fields");
  }

  // Handle user updates separately
  if (updates.user) {
    await User.findByIdAndUpdate(student.user, updates.user, {
      new: true,
      runValidators: true,
    });
    delete updates.user;
  }

  // Update student
  Object.keys(updates).forEach((key) => {
    if (key.includes(".")) {
      // Handle nested fields
      const [parent, child] = key.split(".");
      if (!student[parent]) student[parent] = {};
      student[parent][child] = updates[key];
    } else {
      student[key] = updates[key];
    }
  });

  await student.save();

  const updatedStudent = await Student.findById(id)
    .populate("user", "-password -passwordHistory")
    .populate("department", "name code")
    .populate("batch", "code academicYear")
    .populate("proctor", "user");

  res
    .status(200)
    .json(new ApiResponse(200, updatedStudent, "Student updated successfully"));
};

// Soft delete student
export const deleteStudent = async (req, res) => {
  const { id } = req.params;

  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  // Check department access
  const departmentId = await getScopedDepartmentId(req);
  if (departmentId && !student.department.equals(departmentId)) {
    throw new ApiError(403, "Access denied: Department scope restriction");
  }

  // Soft delete both student and user
  await User.findByIdAndUpdate(student.user, {
    status: "inactive",
    deletedAt: new Date(),
    deletedBy: req.user._id,
  });

  await Student.findByIdAndUpdate(id, {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy: req.user._id,
  });

  res
    .status(200)
    .json(new ApiResponse(200, null, "Student deleted successfully"));
};

// Get student academic history
export const getStudentAcademicHistory = async (req, res) => {
  const { id } = req.params;

  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  // Check department access
  const departmentId = await getScopedDepartmentId(req);
  if (departmentId && !student.department.equals(departmentId)) {
    throw new ApiError(403, "Access denied: Department scope restriction");
  }

  const academicHistory = await ExamResult.findByStudent(id);
  const backlogs = await ExamResult.findBacklogs(id);

  // Calculate semester-wise SGPA
  const semesterResults = {};
  for (const result of academicHistory) {
    const semesterNumber = result.semester.number;
    if (!semesterResults[semesterNumber]) {
      semesterResults[semesterNumber] = {
        semester: result.semester,
        results: [],
        sgpa: 0,
      };
    }
    semesterResults[semesterNumber].results.push(result);
  }

  // Calculate SGPA for each semester
  for (const [semesterNumber, data] of Object.entries(semesterResults)) {
    const sgpa = await ExamResult.calculateSGPA(id, data.semester._id);
    semesterResults[semesterNumber].sgpa = sgpa;
  }

  const cgpa = await ExamResult.calculateCGPA(id);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        student: {
          id: student._id,
          usn: student.usn,
          name: student.user.fullName,
          currentSemester: student.academics.currentSemester,
        },
        academicHistory: Object.values(semesterResults),
        backlogs,
        cgpa,
        totalCreditsEarned: academicHistory.reduce(
          (sum, result) =>
            result.status === "PASS" ? sum + result.credits : sum,
          0,
        ),
      },
      "Academic history retrieved successfully",
    ),
  );
};

// Bulk import students from Excel
export const bulkImportStudents = async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Excel file is required");
  }

  const departmentId = await getScopedDepartmentId(req);
  if (!departmentId) {
    throw new ApiError(403, "Department scope required for bulk import");
  }

  const workbook = xlsx.read(req.file.buffer);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const results = {
      success: [],
      errors: [],
      total: data.length,
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Validate required fields
        if (!row.usn || !row.firstName || !row.email || !row.batchCode) {
          results.errors.push({
            row: i + 1,
            error: "Missing required fields (usn, firstName, email, batchCode)",
          });
          continue;
        }

        // Find batch
        const batch = await Batch.findOne({
          code: row.batchCode,
          department: departmentId,
        });
        if (!batch) {
          results.errors.push({
            row: i + 1,
            error: `Batch ${row.batchCode} not found`,
          });
          continue;
        }

        // Create user
        const userData = {
          firstName: row.firstName,
          middleName: row.middleName || "",
          lastName: row.lastName || "",
          email: row.email,
          phone: row.phone || "",
          dob: row.dob ? new Date(row.dob) : null,
          gender: row.gender || "Male",
          role: "student",
          status: "active",
          createdBy: req.user._id,
        };

        const user = new User(userData);
        await user.save({ session });

        // Create student
        const studentData = {
          user: user._id,
          usn: row.usn,
          admissionYear: row.admissionYear || new Date().getFullYear(),
          department: departmentId,
          batch: batch._id,
          section: row.section || "A",
          religion: row.religion || "",
          caste: row.caste || "",
          category: row.category || "General",
          academics: {
            currentSemester: row.currentSemester || 1,
            cgpa: 0,
            backlogCount: 0,
          },
        };

        const student = new Student(studentData);
        await student.save({ session });

        results.success.push({
          row: i + 1,
          usn: row.usn,
          name: `${row.firstName} ${row.lastName}`,
          studentId: student._id,
        });
      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error.message,
        });
      }
    }

    await session.commitTransaction();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          results,
          `Bulk import completed. ${results.success.length} students imported successfully.`,
        ),
      );
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(500, `Bulk import failed: ${error.message}`);
  } finally {
    session.endSession();
  }
};

// Assign proctor to student
export const assignProctor = async (req, res) => {
  const { id } = req.params;
  const { proctorId } = req.body;

  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  // Check department access
  const departmentId = await getScopedDepartmentId(req);
  if (departmentId && !student.department.equals(departmentId)) {
    throw new ApiError(403, "Access denied: Department scope restriction");
  }

  // Validate proctor
  const proctor = await Faculty.findById(proctorId);
  if (!proctor) {
    throw new ApiError(404, "Proctor not found");
  }

  if (!proctor.department.equals(student.department)) {
    throw new ApiError(400, "Proctor must be from the same department");
  }

  student.proctor = proctorId;
  await student.save();

  const updatedStudent = await Student.findById(id)
    .populate("proctor", "user qualification")
    .populate("user", "firstName lastName");

  res
    .status(200)
    .json(
      new ApiResponse(200, updatedStudent, "Proctor assigned successfully"),
    );
};

// Get student backlogs
export const getStudentBacklogs = async (req, res) => {
  const { id } = req.params;

  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  // Check department access
  const departmentId = await getScopedDepartmentId(req);
  if (departmentId && !student.department.equals(departmentId)) {
    throw new ApiError(403, "Access denied: Department scope restriction");
  }

  const backlogs = await student.getBacklogs();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        student: {
          id: student._id,
          usn: student.usn,
          name: student.user.fullName,
        },
        backlogs,
        totalBacklogs: backlogs.length,
      },
      "Student backlogs retrieved successfully",
    ),
  );
};

// Update student semester
export const updateStudentSemester = async (req, res) => {
  const { id } = req.params;
  const { semester, academicYear } = req.body;

  if (!semester || semester < 1 || semester > 8) {
    throw new ApiError(400, "Valid semester (1-8) is required");
  }

  const student = await Student.findById(id);
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  // Check department access
  const departmentId = await getScopedDepartmentId(req);
  if (departmentId && !student.department.equals(departmentId)) {
    throw new ApiError(403, "Access denied: Department scope restriction");
  }

  // Validate semester progression (can't skip semesters)
  if (semester > student.academics.currentSemester + 1) {
    throw new ApiError(
      400,
      "Cannot skip semesters. Promote one semester at a time",
    );
  }

  const oldSemester = student.academics.currentSemester;
  student.academics.currentSemester = semester;

  if (academicYear) {
    student.academicYear = academicYear;
  }

  await student.save();

  // Update CGPA after semester change
  await student.updateCGPA();
  await student.updateBacklogCount();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        student: {
          id: student._id,
          usn: student.usn,
          name: student.user.fullName,
          oldSemester,
          newSemester: semester,
          cgpa: student.academics.cgpa,
        },
      },
      `Student promoted from semester ${oldSemester} to ${semester} successfully`,
    ),
  );
};

// Bulk promote students
export const promoteStudents = async (req, res) => {
  const { studentIds, fromSemester, toSemester, academicYear } = req.body;

  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ApiError(400, "Student IDs array is required");
  }

  if (!fromSemester || !toSemester || toSemester !== fromSemester + 1) {
    throw new ApiError(400, "Valid consecutive semester progression required");
  }

  const departmentId = await getScopedDepartmentId(req);
  if (!departmentId) {
    throw new ApiError(403, "Department scope required for bulk promotion");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const results = {
      promoted: [],
      failed: [],
      total: studentIds.length,
    };

    for (const studentId of studentIds) {
      try {
        const student = await Student.findById(studentId).session(session);

        if (!student) {
          results.failed.push({
            studentId,
            error: "Student not found",
          });
          continue;
        }

        // Check department scope
        if (!student.department.equals(departmentId)) {
          results.failed.push({
            studentId,
            usn: student.usn,
            error: "Department access denied",
          });
          continue;
        }

        // Check current semester matches
        if (student.academics.currentSemester !== fromSemester) {
          results.failed.push({
            studentId,
            usn: student.usn,
            error: `Student is in semester ${student.academics.currentSemester}, not ${fromSemester}`,
          });
          continue;
        }

        // Check for backlogs (optional - can be configured)
        const backlogs = await ExamResult.findBacklogs(studentId);
        if (backlogs.length > 0) {
          results.failed.push({
            studentId,
            usn: student.usn,
            error: `Student has ${backlogs.length} backlogs`,
          });
          continue;
        }

        // Promote student
        student.academics.currentSemester = toSemester;
        if (academicYear) {
          student.academicYear = academicYear;
        }

        await student.save({ session });
        await student.updateCGPA();

        results.promoted.push({
          studentId,
          usn: student.usn,
          name: student.user.fullName,
          fromSemester,
          toSemester,
        });
      } catch (error) {
        results.failed.push({
          studentId,
          error: error.message,
        });
      }
    }

    await session.commitTransaction();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          results,
          `Bulk promotion completed. ${results.promoted.length} students promoted successfully.`,
        ),
      );
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(500, `Bulk promotion failed: ${error.message}`);
  } finally {
    session.endSession();
  }
};

// Search students with advanced filters
export const searchStudents = async (req, res) => {
  const {
    q, // search query
    department,
    batch,
    semester,
    section,
    cgpaMin,
    cgpaMax,
    hasBacklogs,
    proctorId,
    page = 1,
    limit = 20,
  } = req.body;

  const departmentId = await getScopedDepartmentId(req, department);

  if (!departmentId && req.user.role !== "superAdmin") {
    throw new ApiError(403, "Access denied: Department scope required");
  }

  const query = departmentId ? { department: departmentId } : {};

  // Text search
  if (q) {
    query.$or = [
      { usn: new RegExp(q, "i") },
      { "user.firstName": new RegExp(q, "i") },
      { "user.lastName": new RegExp(q, "i") },
      { "user.email": new RegExp(q, "i") },
    ];
  }

  // Filters
  if (batch) query.batch = batch;
  if (semester) query["academics.currentSemester"] = parseInt(semester);
  if (section) query.section = section;
  if (proctorId) query.proctor = proctorId;

  // CGPA range filter
  if (cgpaMin || cgpaMax) {
    query["academics.cgpa"] = {};
    if (cgpaMin) query["academics.cgpa"].$gte = parseFloat(cgpaMin);
    if (cgpaMax) query["academics.cgpa"].$lte = parseFloat(cgpaMax);
  }

  // Backlog filter
  if (hasBacklogs !== undefined) {
    if (hasBacklogs === "true" || hasBacklogs === true) {
      query["academics.backlogCount"] = { $gt: 0 };
    } else if (hasBacklogs === "false" || hasBacklogs === false) {
      query["academics.backlogCount"] = 0;
    }
  }

  const students = await Student.find(query)
    .populate("user", "firstName middleName lastName email phone")
    .populate("department", "name code")
    .populate("batch", "code academicYear")
    .populate("proctor", "user")
    .sort({ "academics.cgpa": -1, usn: 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Student.countDocuments(query);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        students,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: students.length,
          totalRecords: total,
        },
        filters: {
          q,
          department: departmentId,
          batch,
          semester,
          section,
          cgpaRange: { min: cgpaMin, max: cgpaMax },
          hasBacklogs,
          proctorId,
        },
      },
      "Search results retrieved successfully",
    ),
  );
};

// Get students by department with statistics
export const getStudentsByDepartment = async (req, res) => {
  const { departmentId } = req.params;
  const {
    includeStats = "true",
    groupBy = "semester", // semester, batch, section, proctor
    page = 1,
    limit = 50,
  } = req.query;

  // Check department access
  const scopedDepartmentId = await getScopedDepartmentId(req, departmentId);
  if (!scopedDepartmentId) {
    throw new ApiError(403, "Access denied: Department scope restriction");
  }

  const department = await Department.findById(scopedDepartmentId);
  if (!department) {
    throw new ApiError(404, "Department not found");
  }

  // Get students
  const students = await Student.find({ department: scopedDepartmentId })
    .populate("user", "firstName middleName lastName email phone status")
    .populate("batch", "code academicYear")
    .populate("proctor", "user")
    .sort({ "academics.currentSemester": 1, usn: 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Student.countDocuments({
    department: scopedDepartmentId,
  });

  let response = {
    department: {
      id: department._id,
      name: department.name,
      code: department.code,
    },
    students,
    pagination: {
      current: parseInt(page),
      total: Math.ceil(total / parseInt(limit)),
      count: students.length,
      totalRecords: total,
    },
  };

  // Add statistics if requested
  if (includeStats === "true") {
    const stats = await Student.aggregate([
      {
        $match: { department: new mongoose.Types.ObjectId(scopedDepartmentId) },
      },
      {
        $group: {
          _id:
            groupBy === "semester"
              ? "$academics.currentSemester"
              : groupBy === "batch"
                ? "$batch"
                : groupBy === "section"
                  ? "$section"
                  : groupBy === "proctor"
                    ? "$proctor"
                    : null,
          count: { $sum: 1 },
          avgCgpa: { $avg: "$academics.cgpa" },
          totalBacklogs: { $sum: "$academics.backlogCount" },
          studentsWithBacklogs: {
            $sum: { $cond: [{ $gt: ["$academics.backlogCount", 0] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Populate batch/proctor names if needed
    if (groupBy === "batch") {
      await Student.populate(stats, {
        path: "_id",
        select: "code academicYear",
      });
    } else if (groupBy === "proctor") {
      await Student.populate(stats, {
        path: "_id",
        select: "user",
        populate: { path: "user", select: "firstName lastName" },
      });
    }

    response.statistics = {
      groupedBy: groupBy,
      groups: stats,
      overall: {
        totalStudents: total,
        avgCgpa:
          stats.reduce((sum, group) => sum + group.avgCgpa * group.count, 0) /
          total,
        totalBacklogs: stats.reduce(
          (sum, group) => sum + group.totalBacklogs,
          0,
        ),
        studentsWithBacklogs: stats.reduce(
          (sum, group) => sum + group.studentsWithBacklogs,
          0,
        ),
      },
    };
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        response,
        "Department students retrieved successfully",
      ),
    );
};

// Get comprehensive student statistics
export const getStudentStatistics = async (req, res) => {
  const { department, timeframe = "current" } = req.query;

  const departmentId = await getScopedDepartmentId(req, department);

  if (!departmentId && req.user.role !== "superAdmin") {
    throw new ApiError(403, "Access denied: Department scope required");
  }

  const matchQuery = departmentId
    ? { department: new mongoose.Types.ObjectId(departmentId) }
    : {};

  // Get comprehensive statistics
  const [
    semesterStats,
    performanceStats,
    backlogStats,
    batchStats,
    genderStats,
  ] = await Promise.all([
    // Semester-wise distribution
    Student.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$academics.currentSemester", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

    // Performance distribution
    Student.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $gte: ["$academics.cgpa", 8.5] }, then: "Excellent" },
                { case: { $gte: ["$academics.cgpa", 7.0] }, then: "Good" },
                { case: { $gte: ["$academics.cgpa", 6.0] }, then: "Average" },
              ],
              default: "Poor",
            },
          },
          count: { $sum: 1 },
          avgCgpa: { $avg: "$academics.cgpa" },
        },
      },
    ]),

    // Backlog statistics
    Student.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          studentsWithBacklogs: {
            $sum: { $cond: [{ $gt: ["$academics.backlogCount", 0] }, 1, 0] },
          },
          totalBacklogs: { $sum: "$academics.backlogCount" },
          avgBacklogsPerStudent: { $avg: "$academics.backlogCount" },
        },
      },
    ]),

    // Batch-wise statistics
    Student.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "batches",
          localField: "batch",
          foreignField: "_id",
          as: "batchInfo",
        },
      },
      { $unwind: "$batchInfo" },
      {
        $group: {
          _id: "$batch",
          batchCode: { $first: "$batchInfo.code" },
          academicYear: { $first: "$batchInfo.academicYear" },
          count: { $sum: 1 },
          avgCgpa: { $avg: "$academics.cgpa" },
          totalBacklogs: { $sum: "$academics.backlogCount" },
        },
      },
      { $sort: { academicYear: -1 } },
    ]),

    // Gender distribution
    Student.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      { $group: { _id: "$userInfo.gender", count: { $sum: 1 } } },
    ]),
  ]);

  const totalStudents = await Student.countDocuments(matchQuery);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalStudents,
        semesterDistribution: semesterStats,
        performanceDistribution: performanceStats,
        backlogStatistics: backlogStats[0] || {
          totalStudents: 0,
          studentsWithBacklogs: 0,
          totalBacklogs: 0,
          avgBacklogsPerStudent: 0,
        },
        batchStatistics: batchStats,
        genderDistribution: genderStats,
        department: departmentId
          ? {
              id: departmentId,
              scope: "department",
            }
          : {
              scope: "system-wide",
            },
      },
      "Student statistics retrieved successfully",
    ),
  );
};

// ==================== COURSE REGISTRATION MANAGEMENT ====================

/**
 * Register student for courses with comprehensive validation
 * POST /api/admin/students/:id/courses
 */
export const registerStudentCourses = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: studentId } = req.params;
    const { courses, semesterId, academicYear } = req.body;
    const departmentId = getScopedDepartmentId(req.user);

    // Validate input
    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      throw new ApiError(400, "Courses array is required");
    }

    // Find and validate student
    const student = await Student.findById(studentId)
      .populate("user", "firstName lastName")
      .populate("department", "name")
      .session(session);

    if (!student) {
      throw new ApiError(404, "Student not found");
    }

    if (departmentId && student.department._id.toString() !== departmentId) {
      throw new ApiError(403, "Access denied: Student not in your department");
    }

    // Validate semester
    const semester = await Semester.findById(semesterId).session(session);
    if (!semester) {
      throw new ApiError(404, "Semester not found");
    }

    // Validate courses exist and calculate total credits
    let totalCredits = 0;
    const courseDetails = [];

    for (const courseId of courses) {
      const course = await Course.findById(courseId)
        .populate("department", "name")
        .session(session);

      if (!course) {
        throw new ApiError(400, `Course with ID ${courseId} not found`);
      }

      if (
        course.department._id.toString() !== student.department._id.toString()
      ) {
        // Allow cross-department electives but log for review
        console.log(
          `Cross-department enrollment: ${student.user.firstName} ${student.user.lastName} enrolling in ${course.name}`,
        );
      }

      totalCredits += course.credits;
      courseDetails.push(course);
    }

    // Validate credit limits (VTU typically allows 18-28 credits per semester)
    if (totalCredits > 28) {
      throw new ApiError(
        400,
        `Total credits (${totalCredits}) exceed maximum limit of 28`,
      );
    }

    if (totalCredits < 18) {
      throw new ApiError(
        400,
        `Total credits (${totalCredits}) below minimum requirement of 18`,
      );
    }

    // Check for existing registrations to prevent duplicates
    const existingRegistrations = await CourseRegistration.find({
      student: studentId,
      semester: semesterId,
    }).session(session);

    if (existingRegistrations.length > 0) {
      throw new ApiError(
        400,
        "Student already registered for courses in this semester",
      );
    }

    // Create course registrations
    const registrations = [];
    for (const courseId of courses) {
      const registration = new CourseRegistration({
        student: studentId,
        course: courseId,
        semester: semesterId,
        academicYear,
        status: "REGISTERED",
        registrationDate: new Date(),
        registeredBy: req.user._id,
      });

      await registration.save({ session });
      registrations.push(registration);
    }

    await session.commitTransaction();

    res.status(201).json(
      new ApiResponse(
        201,
        {
          student: {
            id: student._id,
            name: `${student.user.firstName} ${student.user.lastName}`,
            usn: student.usn,
          },
          registrations: registrations.length,
          totalCredits,
          courses: courseDetails.map((course) => ({
            id: course._id,
            name: course.name,
            code: course.code,
            credits: course.credits,
            type: course.courseType,
          })),
        },
        "Courses registered successfully",
      ),
    );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Validate course registration eligibility
 * GET /api/admin/students/:id/courses/validate
 */
export const validateCourseRegistration = async (req, res) => {
  const { id: studentId } = req.params;
  const { semesterId, courses } = req.query;

  const student = await Student.findById(studentId)
    .populate("user", "firstName lastName")
    .populate("department");

  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  // Get student's backlog count
  const backlogCount = await ExamResult.countDocuments({
    student: studentId,
    isBacklog: true,
  });

  // Get current semester registrations
  const currentRegistrations = await CourseRegistration.find({
    student: studentId,
    semester: semesterId,
  }).populate("course", "name code credits");

  // Validation results
  const validation = {
    eligible: true,
    warnings: [],
    errors: [],
    recommendations: [],
    summary: {
      student: `${student.user.firstName} ${student.user.lastName}`,
      currentSemester: student.academics.currentSemester,
      backlogCount,
      currentRegistrations: currentRegistrations.length,
    },
  };

  // Check backlog eligibility
  if (backlogCount > 5) {
    validation.errors.push(
      "Student has more than 5 backlogs - registration restricted",
    );
    validation.eligible = false;
  } else if (backlogCount > 3) {
    validation.warnings.push(
      `Student has ${backlogCount} backlogs - monitor closely`,
    );
  }

  // Check semester progression
  if (student.academics.currentSemester > 8) {
    validation.warnings.push("Student is beyond normal program duration");
  }

  res.json(new ApiResponse(200, validation, "Validation completed"));
};

// ==================== GRADES MANAGEMENT ====================

/**
 * Get all grades for a student
 * GET /api/admin/students/:id/grades
 */
export const getStudentGrades = async (req, res) => {
  const { id: studentId } = req.params;
  const { semesterId, academicYear } = req.query;

  let query = { student: studentId };

  if (semesterId) query.semester = semesterId;
  if (academicYear) query.academicYear = academicYear;

  const grades = await ExamResult.find(query)
    .populate("course", "name code credits courseType")
    .populate("semester", "number term academicYear")
    .sort({ "semester.number": 1, "course.code": 1 });

  // Group by semester for better organization
  const groupedGrades = grades.reduce((acc, grade) => {
    const semesterKey = `${grade.semester.academicYear}-${grade.semester.term}`;
    if (!acc[semesterKey]) {
      acc[semesterKey] = {
        semester: grade.semester,
        courses: [],
        summary: {
          totalCredits: 0,
          totalGradePoints: 0,
          sgpa: 0,
          passedCourses: 0,
          failedCourses: 0,
        },
      };
    }

    acc[semesterKey].courses.push({
      course: grade.course,
      cieMarks: grade.cieMarks,
      externalMarks: grade.externalMarks,
      totalMarks: grade.totalMarks,
      percentage: grade.percentage,
      gradeLetter: grade.gradeLetter,
      gradePoint: grade.gradePoint,
      status: grade.status,
      isBacklog: grade.isBacklog,
      attemptNumber: grade.attemptNumber,
    });

    // Update summary
    const summary = acc[semesterKey].summary;
    summary.totalCredits += grade.credits;
    summary.totalGradePoints += grade.gradePoint * grade.credits;

    if (grade.status === "PASS") {
      summary.passedCourses++;
    } else {
      summary.failedCourses++;
    }

    return acc;
  }, {});

  // Calculate SGPA for each semester
  Object.keys(groupedGrades).forEach((semesterKey) => {
    const semester = groupedGrades[semesterKey];
    if (semester.summary.totalCredits > 0) {
      semester.summary.sgpa = (
        semester.summary.totalGradePoints / semester.summary.totalCredits
      ).toFixed(2);
    }
  });

  res.json(
    new ApiResponse(
      200,
      groupedGrades,
      "Student grades retrieved successfully",
    ),
  );
};

/**
 * Add or update grades for a student
 * POST /api/admin/students/:id/grades
 */
export const addOrUpdateGrades = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: studentId } = req.params;
    const { grades } = req.body; // Array of grade objects

    if (!grades || !Array.isArray(grades)) {
      throw new ApiError(400, "Grades array is required");
    }

    const student = await Student.findById(studentId).session(session);
    if (!student) {
      throw new ApiError(404, "Student not found");
    }

    const results = [];

    for (const gradeData of grades) {
      const {
        courseId,
        semesterId,
        academicYear,
        cieMarks,
        externalMarks,
        examType = "REGULAR",
      } = gradeData;

      // Validate course and get credits
      const course = await Course.findById(courseId).session(session);
      if (!course) {
        throw new ApiError(400, `Course with ID ${courseId} not found`);
      }

      // Check if result already exists
      const existingResult = await ExamResult.findOne({
        student: studentId,
        course: courseId,
        semester: semesterId,
      }).session(session);

      let result;
      if (existingResult) {
        // Update existing result
        existingResult.cieMarks = cieMarks;
        existingResult.externalMarks = externalMarks;
        existingResult.examType = examType;
        existingResult.publishedBy = req.user._id;

        result = await existingResult.save({ session });
      } else {
        // Create new result
        result = new ExamResult({
          student: studentId,
          course: courseId,
          semester: semesterId,
          academicYear,
          cieMarks,
          externalMarks,
          credits: course.credits,
          examType,
          publishedBy: req.user._id,
          department: student.department,
        });

        result = await result.save({ session });
      }

      results.push(result);
    }

    // Update student's CGPA and backlog count
    await updateStudentAcademicSummary(studentId, session);

    await session.commitTransaction();

    res.json(
      new ApiResponse(
        200,
        {
          updated: results.length,
          results: results.map((r) => ({
            course: r.course,
            totalMarks: r.totalMarks,
            gradeLetter: r.gradeLetter,
            gradePoint: r.gradePoint,
            status: r.status,
          })),
        },
        "Grades updated successfully",
      ),
    );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Calculate comprehensive CGPA data for a student
 * GET /api/admin/students/:id/cgpa
 */
export const calculateStudentCGPA = async (req, res) => {
  const { id: studentId } = req.params;

  const student = await Student.findById(studentId)
    .populate("user", "firstName lastName")
    .populate("department", "name");

  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  // Get all results
  const allResults = await ExamResult.find({ student: studentId })
    .populate("course", "name code credits courseType")
    .populate("semester", "number term academicYear")
    .sort({ "semester.number": 1 });

  // Calculate semester-wise SGPA
  const semesterWiseData = {};
  let overallGradePoints = 0;
  let overallCredits = 0;
  let totalBacklogs = 0;

  allResults.forEach((result) => {
    const semKey = `sem_${result.semester.number}`;

    if (!semesterWiseData[semKey]) {
      semesterWiseData[semKey] = {
        semester: result.semester.number,
        term: result.semester.term,
        academicYear: result.semester.academicYear,
        courses: [],
        totalCredits: 0,
        totalGradePoints: 0,
        sgpa: 0,
      };
    }

    semesterWiseData[semKey].courses.push({
      course: result.course,
      gradePoint: result.gradePoint,
      gradeLetter: result.gradeLetter,
      credits: result.credits,
      status: result.status,
      isBacklog: result.isBacklog,
    });

    if (result.status === "PASS") {
      semesterWiseData[semKey].totalCredits += result.credits;
      semesterWiseData[semKey].totalGradePoints +=
        result.gradePoint * result.credits;

      overallCredits += result.credits;
      overallGradePoints += result.gradePoint * result.credits;
    }

    if (result.isBacklog) {
      totalBacklogs++;
    }
  });

  // Calculate SGPA for each semester
  Object.keys(semesterWiseData).forEach((key) => {
    const sem = semesterWiseData[key];
    if (sem.totalCredits > 0) {
      sem.sgpa = (sem.totalGradePoints / sem.totalCredits).toFixed(2);
    }
  });

  // Calculate overall CGPA
  const cgpa =
    overallCredits > 0 ? (overallGradePoints / overallCredits).toFixed(2) : 0;

  // Performance classification
  let classification = "Poor";
  if (cgpa >= 9.0) classification = "Outstanding";
  else if (cgpa >= 8.0) classification = "Excellent";
  else if (cgpa >= 7.0) classification = "Very Good";
  else if (cgpa >= 6.0) classification = "Good";
  else if (cgpa >= 5.0) classification = "Average";

  const cgpaData = {
    student: {
      id: student._id,
      name: `${student.user.firstName} ${student.user.lastName}`,
      usn: student.usn,
      department: student.department.name,
      currentSemester: student.academics.currentSemester,
    },
    academic: {
      cgpa: parseFloat(cgpa),
      classification,
      totalCreditsEarned: overallCredits,
      totalBacklogs,
      completedSemesters: Object.keys(semesterWiseData).length,
    },
    semesterWise: Object.values(semesterWiseData),
    summary: {
      highestSGPA: Math.max(
        ...Object.values(semesterWiseData).map((s) => parseFloat(s.sgpa) || 0),
      ),
      lowestSGPA: Math.min(
        ...Object.values(semesterWiseData).map((s) => parseFloat(s.sgpa) || 0),
      ),
      averageSGPA: (
        Object.values(semesterWiseData).reduce(
          (sum, s) => sum + parseFloat(s.sgpa || 0),
          0,
        ) / Object.keys(semesterWiseData).length
      ).toFixed(2),
    },
  };

  res.json(new ApiResponse(200, cgpaData, "CGPA calculated successfully"));
};

// ==================== BULK OPERATIONS ====================

/**
 * Bulk semester promotion with comprehensive validation
 * POST /api/admin/students/promote-semester
 */
export const bulkPromoteSemester = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { studentIds, promotionRules = {} } = req.body;
    const departmentId = getScopedDepartmentId(req.user);

    const {
      allowWithBacklogs = true,
      maxBacklogs = 5,
      minimumCGPA = 4.0,
      requireAttendance = false,
      minimumAttendance = 75,
    } = promotionRules;

    if (!studentIds || !Array.isArray(studentIds)) {
      throw new ApiError(400, "Student IDs array is required");
    }

    const promotionResults = {
      promoted: [],
      restricted: [],
      errors: [],
    };

    for (const studentId of studentIds) {
      try {
        const student = await Student.findById(studentId)
          .populate("user", "firstName lastName")
          .session(session);

        if (!student) {
          promotionResults.errors.push({
            studentId,
            reason: "Student not found",
          });
          continue;
        }

        // Department access check
        if (departmentId && student.department.toString() !== departmentId) {
          promotionResults.errors.push({
            studentId,
            student: `${student.user.firstName} ${student.user.lastName}`,
            reason: "Access denied: Student not in your department",
          });
          continue;
        }

        // Check promotion eligibility
        const backlogCount = await ExamResult.countDocuments({
          student: studentId,
          isBacklog: true,
        }).session(session);

        const cgpa = await ExamResult.calculateCGPA(studentId);

        let canPromote = true;
        let restrictionReasons = [];

        // Backlog check
        if (!allowWithBacklogs && backlogCount > 0) {
          canPromote = false;
          restrictionReasons.push(`Has ${backlogCount} backlogs`);
        } else if (backlogCount > maxBacklogs) {
          canPromote = false;
          restrictionReasons.push(
            `Exceeds maximum allowed backlogs (${backlogCount}/${maxBacklogs})`,
          );
        }

        // CGPA check
        if (cgpa < minimumCGPA) {
          canPromote = false;
          restrictionReasons.push(
            `CGPA below minimum (${cgpa}/${minimumCGPA})`,
          );
        }

        // Semester limit check
        if (student.academics.currentSemester >= 8) {
          canPromote = false;
          restrictionReasons.push("Already in final semester");
        }

        if (canPromote) {
          // Promote student
          student.academics.currentSemester += 1;
          await student.save({ session });

          promotionResults.promoted.push({
            studentId,
            student: `${student.user.firstName} ${student.user.lastName}`,
            usn: student.usn,
            previousSemester: student.academics.currentSemester - 1,
            newSemester: student.academics.currentSemester,
            cgpa: parseFloat(cgpa),
          });
        } else {
          promotionResults.restricted.push({
            studentId,
            student: `${student.user.firstName} ${student.user.lastName}`,
            usn: student.usn,
            currentSemester: student.academics.currentSemester,
            reasons: restrictionReasons,
            cgpa: parseFloat(cgpa),
            backlogs: backlogCount,
          });
        }
      } catch (error) {
        promotionResults.errors.push({
          studentId,
          reason: error.message,
        });
      }
    }

    await session.commitTransaction();

    res.json(
      new ApiResponse(
        200,
        {
          summary: {
            total: studentIds.length,
            promoted: promotionResults.promoted.length,
            restricted: promotionResults.restricted.length,
            errors: promotionResults.errors.length,
          },
          details: promotionResults,
        },
        "Bulk promotion completed",
      ),
    );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ==================== ANALYTICS & REPORTING ====================
// ==================== MISSING CONTROLLERS COMPLETION ====================

/**
 * Get comprehensive academic analytics
 * GET /api/admin/analytics/academic
 */
export const getAcademicAnalytics = async (req, res) => {
  try {
    const departmentId = getScopedDepartmentId(req.user);
    const { academicYear, semester } = req.query;

    // Build query filters
    let studentQuery = {};
    let resultQuery = {};

    if (departmentId) {
      studentQuery.department = departmentId;
      resultQuery.department = departmentId;
    }

    if (academicYear) {
      resultQuery.academicYear = academicYear;
    }

    // Get total students
    const totalStudents = await Student.countDocuments(studentQuery);

    // Get active students
    const activeStudents = await Student.countDocuments({
      ...studentQuery,
      "user.status": "active",
    });

    // Get semester-wise distribution
    const semesterDistribution = await Student.aggregate([
      { $match: studentQuery },
      {
        $group: {
          _id: "$academics.currentSemester",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get CGPA distribution
    const cgpaDistribution = await Student.aggregate([
      { $match: studentQuery },
      {
        $bucket: {
          groupBy: "$academics.cgpa",
          boundaries: [0, 5, 6, 7, 8, 9, 10],
          default: "Unknown",
          output: {
            count: { $sum: 1 },
            students: {
              $push: {
                usn: "$usn",
                cgpa: "$academics.cgpa",
              },
            },
          },
        },
      },
    ]);

    // Get backlog statistics
    const backlogStats = await ExamResult.aggregate([
      { $match: { ...resultQuery, isBacklog: true } },
      {
        $group: {
          _id: "$student",
          backlogCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          totalStudentsWithBacklogs: { $sum: 1 },
          averageBacklogsPerStudent: { $avg: "$backlogCount" },
          maxBacklogs: { $max: "$backlogCount" },
          totalBacklogs: { $sum: "$backlogCount" },
        },
      },
    ]);

    // Get top performers
    const topPerformers = await Student.find(studentQuery)
      .populate("user", "firstName lastName")
      .sort({ "academics.cgpa": -1 })
      .limit(10)
      .select("usn academics.cgpa user");

    // Get course-wise performance
    const coursePerformance = await ExamResult.aggregate([
      { $match: resultQuery },
      {
        $lookup: {
          from: "courses",
          localField: "course",
          foreignField: "_id",
          as: "courseInfo",
        },
      },
      { $unwind: "$courseInfo" },
      {
        $group: {
          _id: "$course",
          courseName: { $first: "$courseInfo.name" },
          courseCode: { $first: "$courseInfo.code" },
          totalStudents: { $sum: 1 },
          passedStudents: {
            $sum: { $cond: [{ $eq: ["$status", "PASS"] }, 1, 0] },
          },
          averageMarks: { $avg: "$totalMarks" },
          averageGradePoint: { $avg: "$gradePoint" },
        },
      },
      {
        $addFields: {
          passPercentage: {
            $multiply: [
              { $divide: ["$passedStudents", "$totalStudents"] },
              100,
            ],
          },
        },
      },
      { $sort: { passPercentage: 1 } },
    ]);

    // Get recent trends (last 3 semesters)
    const recentTrends = await ExamResult.aggregate([
      {
        $match: {
          ...resultQuery,
          createdAt: {
            $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
          },
        },
      },
      {
        $lookup: {
          from: "semesters",
          localField: "semester",
          foreignField: "_id",
          as: "semesterInfo",
        },
      },
      { $unwind: "$semesterInfo" },
      {
        $group: {
          _id: {
            semester: "$semesterInfo.number",
            academicYear: "$academicYear",
          },
          totalStudents: { $sum: 1 },
          passedStudents: {
            $sum: { $cond: [{ $eq: ["$status", "PASS"] }, 1, 0] },
          },
          averageCGPA: { $avg: "$gradePoint" },
        },
      },
      {
        $addFields: {
          passPercentage: {
            $multiply: [
              { $divide: ["$passedStudents", "$totalStudents"] },
              100,
            ],
          },
        },
      },
      { $sort: { "_id.academicYear": -1, "_id.semester": -1 } },
      { $limit: 6 },
    ]);

    const analytics = {
      overview: {
        totalStudents,
        activeStudents,
        inactiveStudents: totalStudents - activeStudents,
        departmentName: departmentId
          ? (await Department.findById(departmentId).select("name")).name
          : "All Departments",
      },
      distribution: {
        semester: semesterDistribution.map((item) => ({
          semester: item._id,
          students: item.count,
          percentage: ((item.count / totalStudents) * 100).toFixed(1),
        })),
        cgpa: cgpaDistribution.map((bucket) => ({
          range:
            bucket._id === "Unknown"
              ? "No CGPA"
              : `${bucket._id}-${bucket._id + 1}`,
          count: bucket.count,
          percentage: ((bucket.count / totalStudents) * 100).toFixed(1),
        })),
      },
      performance: {
        topPerformers: topPerformers.map((student) => ({
          usn: student.usn,
          name: `${student.user.firstName} ${student.user.lastName}`,
          cgpa: student.academics.cgpa,
        })),
        backlogStatistics: backlogStats[0] || {
          totalStudentsWithBacklogs: 0,
          averageBacklogsPerStudent: 0,
          maxBacklogs: 0,
          totalBacklogs: 0,
        },
      },
      courseAnalysis: {
        totalCourses: coursePerformance.length,
        bestPerformingCourse: coursePerformance[coursePerformance.length - 1],
        worstPerformingCourse: coursePerformance[0],
        averagePassPercentage: (
          coursePerformance.reduce(
            (sum, course) => sum + course.passPercentage,
            0,
          ) / coursePerformance.length
        ).toFixed(1),
      },
      trends: {
        recentSemesters: recentTrends,
        summary: {
          improvingTrend:
            recentTrends.length > 1
              ? recentTrends[0].passPercentage > recentTrends[1].passPercentage
              : false,
          averagePassRate: (
            recentTrends.reduce((sum, trend) => sum + trend.passPercentage, 0) /
            recentTrends.length
          ).toFixed(1),
        },
      },
      generatedAt: new Date(),
      filters: {
        departmentId,
        academicYear,
        semester,
      },
    };

    res.json(
      new ApiResponse(
        200,
        analytics,
        "Academic analytics generated successfully",
      ),
    );
  } catch (error) {
    console.error("Academic Analytics Error:", error);
    throw new ApiError(500, "Failed to generate academic analytics");
  }
};

// ==================== HELPER FUNCTION ====================

/**
 * Update student's academic summary (CGPA, backlog count)
 * Used internally by other controllers
 */
const updateStudentAcademicSummary = async (studentId, session = null) => {
  try {
    // Calculate current CGPA
    const cgpaResult = await ExamResult.aggregate([
      {
        $match: {
          student: new mongoose.Types.ObjectId(studentId),
          status: "PASS",
        },
      },
      {
        $group: {
          _id: null,
          totalGradePoints: {
            $sum: { $multiply: ["$gradePoint", "$credits"] },
          },
          totalCredits: { $sum: "$credits" },
        },
      },
    ]).session(session);

    const cgpa =
      cgpaResult.length > 0 && cgpaResult[0].totalCredits > 0
        ? cgpaResult[0].totalGradePoints / cgpaResult[0].totalCredits
        : 0;

    // Count current backlogs
    const backlogCount = await ExamResult.countDocuments({
      student: studentId,
      isBacklog: true,
    }).session(session);

    // Update student record
    const updateData = {
      "academics.cgpa": parseFloat(cgpa.toFixed(2)),
      "academics.backlogCount": backlogCount,
      "academics.lastUpdated": new Date(),
    };

    if (session) {
      await Student.findByIdAndUpdate(studentId, updateData).session(session);
    } else {
      await Student.findByIdAndUpdate(studentId, updateData);
    }

    return { cgpa: parseFloat(cgpa.toFixed(2)), backlogCount };
  } catch (error) {
    console.error("Error updating student academic summary:", error);
    throw error;
  }
};
