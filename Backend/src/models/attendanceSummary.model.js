// attendanceSummary.model.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const attendanceSummarySchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      unique: true,
      default: uuidv4,
      immutable: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student ID is required"],
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course ID is required"],
      index: true,
    },
    semesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: [true, "Semester ID is required"],
      index: true,
    },
    totalClasses: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Total classes cannot be negative"],
    },
    attended: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Attended classes cannot be negative"],
      validate: {
        validator: function (value) {
          return value <= this.totalClasses;
        },
        message: "Attended classes cannot exceed total classes",
      },
    },
    lastCalculated: {
      type: Date,
      default: Date.now,
    },
    condonationApplied: {
      type: Boolean,
      default: false,
    },
    condonationPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    condonationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "not_applicable"],
      default: "not_applicable",
    },
    condonationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Condonation reason cannot exceed 500 characters"],
    },
    isEligible: {
      type: Boolean,
      default: true,
    },
    requiredPercentage: {
      type: Number,
      default: 75,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual Field: Auto-Calculate Percentage
attendanceSummarySchema.virtual("percentage").get(function () {
  return this.totalClasses > 0
    ? (this.attended / this.totalClasses) * 100
    : null;
});

// Virtual Field: Calculate effective percentage (including condonation)
attendanceSummarySchema.virtual("effectivePercentage").get(function () {
  if (this.totalClasses === 0) return null;

  const basePercentage = (this.attended / this.totalClasses) * 100;

  if (this.condonationApplied && this.condonationStatus === "approved") {
    return Math.min(basePercentage + this.condonationPercentage, 100);
  }

  return basePercentage;
});

// Virtual Field: Calculate shortage
attendanceSummarySchema.virtual("shortagePercentage").get(function () {
  if (this.totalClasses === 0) return null;

  const currentPercentage = this.effectivePercentage || this.percentage;
  if (currentPercentage >= this.requiredPercentage) return 0;

  return this.requiredPercentage - currentPercentage;
});

// Virtual Field: Calculate required sessions to reach minimum attendance
attendanceSummarySchema.virtual("requiredSessions").get(function () {
  if (this.totalClasses === 0) return null;
  if (this.effectivePercentage >= this.requiredPercentage) return 0;

  // Formula: (required % * total - 100 * attended) / (100 - required %)
  const requiredClasses = Math.ceil(
    (this.requiredPercentage * this.totalClasses - 100 * this.attended) /
      (100 - this.requiredPercentage),
  );
  return Math.max(0, requiredClasses);
});

// Unique Constraint: Prevent Duplicate Records
attendanceSummarySchema.index(
  { studentId: 1, courseId: 1, semesterId: 1 },
  { unique: true },
);

// Compound indexes for common queries
attendanceSummarySchema.index({ courseId: 1, semesterId: 1 }); // For course attendance reports
attendanceSummarySchema.index({ studentId: 1, semesterId: 1 }); // For student semester reports
attendanceSummarySchema.index({ semesterId: 1, percentage: 1 }); // For shortage reports
attendanceSummarySchema.index({ isEligible: 1, semesterId: 1 }); // For exam eligibility lists

// Pre-save middleware for validation and calculations
attendanceSummarySchema.pre("save", async function (next) {
  try {
    // Calculate eligibility status
    const effectivePercentage = this.effectivePercentage;

    this.isEligible = effectivePercentage >= this.requiredPercentage;

    // Update last calculated timestamp
    this.lastCalculated = new Date();

    next();
  } catch (error) {
    next(error);
  }
});

// Method to recalculate attendance from raw attendance records
attendanceSummarySchema.methods.recalculate = async function () {
  const Attendance = mongoose.model("Attendance");
  const AttendanceStatusType = mongoose.model("AttendanceStatusType");

  // Get all status types that count as present
  const presentStatuses = await AttendanceStatusType.find({
    isCountedPresent: true,
  });
  const presentStatusIds = presentStatuses.map((status) => status._id);

  // Get all attendance records for this student in this course for this semester
  const attendanceRecords = await Attendance.find({
    studentId: this.studentId,
    courseId: this.courseId,
    date: {
      // Assuming semester model has startDate and endDate fields
      $gte: (await mongoose.model("Semester").findById(this.semesterId))
        .startDate,
      $lte: (await mongoose.model("Semester").findById(this.semesterId))
        .endDate,
    },
  });

  // Calculate totals
  this.totalClasses = attendanceRecords.length;
  this.attended = attendanceRecords.filter((record) =>
    presentStatusIds.some((id) => id.equals(record.attendanceStatusTypeId)),
  ).length;

  // Save changes
  return this.save();
};

// Method to apply for condonation
attendanceSummarySchema.methods.applyForCondonation = function (
  reason,
  percentage = 0,
) {
  this.condonationApplied = true;
  this.condonationStatus = "pending";
  this.condonationReason = reason;
  this.condonationPercentage = percentage;
  return this;
};

// Method to process condonation
attendanceSummarySchema.methods.processCondonation = function (status) {
  this.condonationStatus = status;
  return this;
};

// Static methods for common queries
attendanceSummarySchema.statics.getStudentSemesterSummary = async function (
  studentId,
  semesterId,
) {
  return this.find({ studentId, semesterId })
    .populate("courseId")
    .sort("-percentage");
};

attendanceSummarySchema.statics.getCourseSummary = async function (
  courseId,
  semesterId,
) {
  return this.find({ courseId, semesterId })
    .populate("studentId")
    .sort("studentId.rollNumber");
};

attendanceSummarySchema.statics.getShortageList = async function (
  semesterId,
  requiredPercentage = 75,
) {
  return this.find({
    semesterId,
    $expr: {
      $lt: [
        {
          $cond: [
            { $gt: ["$totalClasses", 0] },
            { $multiply: [{ $divide: ["$attended", "$totalClasses"] }, 100] },
            null,
          ],
        },
        requiredPercentage,
      ],
    },
  }).populate("studentId courseId");
};

attendanceSummarySchema.statics.getEligibilityList = async function (
  semesterId,
) {
  return this.find({
    semesterId,
  })
    .populate("studentId courseId")
    .sort({ isEligible: -1, "studentId.rollNumber": 1 });
};

attendanceSummarySchema.statics.updateFromAttendanceRecords = async function (
  studentId,
  courseId,
  semesterId,
) {
  // Find or create summary record
  let summary = await this.findOne({ studentId, courseId, semesterId });

  if (!summary) {
    // Get academic year ID based on semester
    const semester = await mongoose.model("Semester").findById(semesterId);
    if (!semester) {
      throw new Error("Semester not found");
    }

    summary = new this({
      studentId,
      courseId,
      semesterId,
    });
  }

  // Recalculate attendance
  return summary.recalculate();
};

const AttendanceSummary = mongoose.model(
  "AttendanceSummary",
  attendanceSummarySchema,
);

export default AttendanceSummary;