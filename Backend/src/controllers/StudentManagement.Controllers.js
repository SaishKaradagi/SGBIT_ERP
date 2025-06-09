// Student Management Controllers (StudentManagement.Controllers.js)
import Student from "../models/student.model.js";
import User from "../models/user.model.js";
import Department from "../models/department.model.js";
import Batch from "../models/batch.model.js";
import Faculty from "../models/faculty.model.js";
import ExamResult from "../models/examResult.model.js";
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
