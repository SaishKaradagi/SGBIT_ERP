// src/models/attendance.model.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const attendanceSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: [true, "Date is required"],
      index: true, // Optimized for date-based queries
      validate: {
        validator: function (v) {
          return v instanceof Date && !isNaN(v) && v <= new Date();
        },
        message: "Date must be valid and cannot be in the future",
      },
    },
    attendanceStatusTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttendanceStatusType",
      required: [true, "Attendance status is required"],
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: [true, "Faculty ID who marked attendance is required"],
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editHistory: [
      {
        previousStatus: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AttendanceStatusType",
        },
        modifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        modifiedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Unique constraint to prevent duplicate attendance records
attendanceSchema.index(
  { studentId: 1, courseId: 1, date: 1},
  { unique: true, partialFilterExpression: { sessionId: { $exists: true } } },
);

attendanceSchema.index(
  { studentId: 1, courseId: 1, date: 1 },
  { unique: true, partialFilterExpression: { sessionId: { $exists: false } } },
);

// Time-To-Live (TTL) Index Alternative to Partitioning
attendanceSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 * 5 },
); // 5 years retention

// Compound indexes for frequent queries
attendanceSchema.index({ courseId: 1, date: 1 }); // For listing course attendance on a specific date
attendanceSchema.index({ studentId: 1, date: 1 }); // For student's daily attendance report
attendanceSchema.index({ markedBy: 1, date: 1 }); // For faculty attendance records

// Virtual to populate attendance status details
attendanceSchema.virtual("status", {
  ref: "AttendanceStatusType",
  localField: "attendanceStatusTypeId",
  foreignField: "_id",
  justOne: true,
});

// Virtual to populate student details
attendanceSchema.virtual("student", {
  ref: "Student",
  localField: "studentId",
  foreignField: "_id",
  justOne: true,
});

// Virtual to populate course details
attendanceSchema.virtual("course", {
  ref: "Course",
  localField: "courseId",
  foreignField: "_id",
  justOne: true,
});

// Basic model methods (moved complex business logic to service)
attendanceSchema.methods.changeStatus = function (newStatusId, userId, reason) {
  // Store previous status in edit history
  const historyEntry = {
    previousStatus: this.attendanceStatusTypeId,
    modifiedBy: userId,
    modifiedAt: new Date(),
    reason: reason || "Status changed",
  };
  
  this.attendanceStatusTypeId = newStatusId;
  this.lastModifiedBy = userId;
  this.isEdited = true;
  this.editHistory.push(historyEntry);
  
  return this;
};

// Simple query statics (complex ones moved to service)
attendanceSchema.statics.getStudentAttendanceForCourse = function (
  studentId,
  courseId,
  startDate,
  endDate,
) {
  return this.find({
    studentId,
    courseId,
    date: { $gte: startDate, $lte: endDate },
  })
    .populate("status")
    .sort({ date: 1 });
};

attendanceSchema.statics.getCourseAttendanceForDate = function (
  courseId,
  date,
) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    courseId,
    date: { $gte: startOfDay, $lte: endOfDay },
  })
    .populate("student status")
    .sort("student.rollNumber");
};

attendanceSchema.statics.getStudentDailyAttendance = function (
  studentId,
  date,
) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    studentId,
    date: { $gte: startOfDay, $lte: endOfDay },
  })
    .populate("course status")
    .sort("course.name");
};

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;