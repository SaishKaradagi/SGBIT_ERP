import { Student } from "../models/student.model.js";
import { ExamResult } from "../models/examResult.model.js";
import { Batch } from "../models/batch.model.js";

/**
 * Generate unique USN for student
 * Format: YYYYDEPTXX where YYYY is year, DEPT is department code, XX is sequence
 */
export const generateUSN = async (departmentCode, admissionYear) => {
  const prefix = `${admissionYear}${departmentCode}`;

  // Find the highest sequence number for this prefix
  const lastStudent = await Student.findOne({
    usn: new RegExp(`^${prefix}`),
  }).sort({ usn: -1 });

  let sequence = 1;
  if (lastStudent) {
    const lastSequence = parseInt(lastStudent.usn.slice(-2));
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(2, "0")}`;
};

/**
 * Calculate academic performance metrics
 */
export const calculateAcademicMetrics = async (studentId) => {
  const [cgpa, backlogs, totalCredits, semesterResults] = await Promise.all([
    ExamResult.calculateCGPA(studentId),
    ExamResult.findBacklogs(studentId),
    ExamResult.aggregate([
      { $match: { student: studentId, status: "PASS" } },
      { $group: { _id: null, total: { $sum: "$credits" } } },
    ]),
    ExamResult.aggregate([
      { $match: { student: studentId } },
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
          _id: "$semesterInfo.number",
          results: { $push: "$$ROOT" },
          totalCredits: { $sum: "$credits" },
          earnedCredits: {
            $sum: { $cond: [{ $eq: ["$status", "PASS"] }, "$credits", 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    cgpa: parseFloat(cgpa),
    backlogCount: backlogs.length,
    totalCreditsEarned: totalCredits[0]?.total || 0,
    semesterWiseProgress: semesterResults,
    performance:
      cgpa >= 8.5
        ? "Excellent"
        : cgpa >= 7.0
          ? "Good"
          : cgpa >= 6.0
            ? "Average"
            : "Poor",
  };
};

/**
 * Validate student eligibility for semester promotion
 */
export const validatePromotionEligibility = async (studentId, toSemester) => {
  const student = await Student.findById(studentId);
  if (!student) {
    return { eligible: false, reason: "Student not found" };
  }

  // Check if promotion is sequential
  if (toSemester !== student.academics.currentSemester + 1) {
    return {
      eligible: false,
      reason: `Cannot promote from semester ${student.academics.currentSemester} to ${toSemester}. Must be sequential.`,
    };
  }

  // Check for backlogs (configurable rule)
  const backlogs = await ExamResult.findBacklogs(studentId);
  const maxAllowedBacklogs = 3; // Configurable based on college rules

  if (backlogs.length > maxAllowedBacklogs) {
    return {
      eligible: false,
      reason: `Student has ${backlogs.length} backlogs. Maximum allowed: ${maxAllowedBacklogs}`,
    };
  }

  // Check minimum attendance (if attendance tracking is implemented)
  // const attendance = await checkMinimumAttendance(studentId);
  // if (!attendance.eligible) return attendance;

  return { eligible: true, reason: "Student eligible for promotion" };
};

/**
 * Format student data for export
 */
export const formatStudentForExport = (students) => {
  return students.map((student) => ({
    USN: student.usn,
    "First Name": student.user.firstName,
    "Middle Name": student.user.middleName || "",
    "Last Name": student.user.lastName || "",
    "Full Name": student.user.fullName,
    Email: student.user.email,
    Phone: student.user.phone,
    Department: student.department.name,
    Batch: student.batch.code,
    "Academic Year": student.batch.academicYear,
    Section: student.section,
    "Current Semester": student.academics.currentSemester,
    CGPA: student.academics.cgpa,
    "Backlog Count": student.academics.backlogCount,
    Proctor: student.proctor ? student.proctor.user.fullName : "Not Assigned",
    Status: student.user.status,
    "Admission Year": student.admissionYear,
    Category: student.category,
    Religion: student.religion,
    Caste: student.caste,
  }));
};

/**
 * Parse bulk import data and validate
 */
export const parseBulkImportData = (data) => {
  const requiredFields = ["usn", "firstName", "email", "batchCode"];
  const validatedData = [];
  const errors = [];

  data.forEach((row, index) => {
    const rowErrors = [];

    // Check required fields
    requiredFields.forEach((field) => {
      if (!row[field] || row[field].toString().trim() === "") {
        rowErrors.push(`${field} is required`);
      }
    });

    // Validate USN format
    if (row.usn && !/^[A-Z0-9]{10}$/.test(row.usn.toString().toUpperCase())) {
      rowErrors.push("USN must be 10 characters alphanumeric");
    }

    // Validate email
    if (row.email && !/\S+@\S+\.\S+/.test(row.email)) {
      rowErrors.push("Invalid email format");
    }

    // Validate phone (Indian format)
    if (row.phone && !/^[6-9]\d{9}$/.test(row.phone.toString())) {
      rowErrors.push("Invalid phone number format");
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: index + 1,
        errors: rowErrors,
        data: row,
      });
    } else {
      validatedData.push({
        ...row,
        usn: row.usn.toString().toUpperCase(),
        email: row.email.toString().toLowerCase(),
        firstName: row.firstName.toString().trim(),
        lastName: row.lastName ? row.lastName.toString().trim() : "",
        middleName: row.middleName ? row.middleName.toString().trim() : "",
        phone: row.phone ? row.phone.toString() : "",
        section: row.section ? row.section.toString().toUpperCase() : "A",
        currentSemester: row.currentSemester
          ? parseInt(row.currentSemester)
          : 1,
        admissionYear: row.admissionYear
          ? parseInt(row.admissionYear)
          : new Date().getFullYear(),
      });
    }
  });

  return { validatedData, errors };
};
