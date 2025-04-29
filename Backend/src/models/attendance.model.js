// attendance.model.js
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
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimeTable",
      required: false,
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockDate: {
      type: Date,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deviceInfo: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
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
  { studentId: 1, courseId: 1, date: 1, sessionId: 1 },
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

// Pre-save middleware to handle updates and tracking
attendanceSchema.pre("save", async function (next) {
  try {
    if (!this.isNew && this.isModified("attendanceStatusTypeId")) {
      // If attendance status is being changed, track the change
      this.isEdited = true;

      const oldStatus = this._previousStatus;
      if (oldStatus) {
        this.editHistory.push({
          previousStatus: oldStatus,
          modifiedBy: this.lastModifiedBy,
          modifiedAt: new Date(),
          reason: this._editReason || "Status updated",
        });
      }
    }

    // Auto-update the attendance summary when attendance is marked or updated
    if (this.isNew || this.isModified("attendanceStatusTypeId")) {
      const AttendanceModel = mongoose.model("Attendance");
      const AttendanceStatusType = mongoose.model("AttendanceStatusType");
      const AttendanceSummary = mongoose.model("AttendanceSummary");

      // Get current semester ID - you'll need to implement a utility to determine this
      // This is a placeholder - replace with actual implementation
      const currentSemester = await mongoose.model("Semester").findOne({
        isActive: true,
        startDate: { $lte: this.date },
        endDate: { $gte: this.date },
      });

      if (!currentSemester) {
        throw new Error(
          "Unable to determine current semester for this attendance record",
        );
      }

      // Get current and previous status to determine attendance count changes
      const currentStatus = await AttendanceStatusType.findById(
        this.attendanceStatusTypeId,
      );
      let oldStatus = null;

      if (!this.isNew && this._previousStatus) {
        oldStatus = await AttendanceStatusType.findById(this._previousStatus);
      }

      // Update attendance summary
      let summary = await AttendanceSummary.findOne({
        studentId: this.studentId,
        courseId: this.courseId,
        semesterId: currentSemester._id,
      });

      if (!summary) {
        // Create new summary if it doesn't exist
        summary = new AttendanceSummary({
          studentId: this.studentId,
          courseId: this.courseId,
          semesterId: currentSemester._id,
          totalClasses: 1,
          attended: currentStatus.isCountedPresent ? 1 : 0,
        });
      } else {
        // Update existing summary
        if (this.isNew) {
          // New attendance record
          summary.totalClasses += 1;
          if (currentStatus.isCountedPresent) {
            summary.attended += 1;
          }
        } else if (this.isModified("attendanceStatusTypeId")) {
          // Status changed - adjust counts accordingly
          if (
            oldStatus &&
            oldStatus.isCountedPresent &&
            !currentStatus.isCountedPresent
          ) {
            // Changed from present to absent
            summary.attended -= 1;
          } else if (
            (!oldStatus || !oldStatus.isCountedPresent) &&
            currentStatus.isCountedPresent
          ) {
            // Changed from absent to present
            summary.attended += 1;
          }
        }
      }

      await summary.save();
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Method to track status changes
attendanceSchema.methods.changeStatus = function (newStatusId, userId, reason) {
  this._previousStatus = this.attendanceStatusTypeId;
  this.attendanceStatusTypeId = newStatusId;
  this.lastModifiedBy = userId;
  this._editReason = reason;
  return this;
};

// Method to lock attendance record
attendanceSchema.methods.lock = function (userId) {
  this.isLocked = true;
  this.lockDate = new Date();
  this.lockedBy = userId;
  return this;
};

// Method to unlock attendance record
attendanceSchema.methods.unlock = function () {
  this.isLocked = false;
  this.lockDate = null;
  this.lockedBy = null;
  return this;
};

// Statics for common queries
attendanceSchema.statics.getStudentAttendanceForCourse = async function (
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

attendanceSchema.statics.getCourseAttendanceForDate = async function (
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

attendanceSchema.statics.getStudentDailyAttendance = async function (
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

// Bulk attendance marking
attendanceSchema.statics.markBulkAttendance = async function (
  courseId,
  date,
  attendanceData,
  markedBy,
  sessionId = null,
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const records = [];

    for (const data of attendanceData) {
      // Check if record already exists
      const existing = await this.findOne({
        courseId,
        date,
        studentId: data.studentId,
        ...(sessionId ? { sessionId } : {}),
      }).session(session);

      if (existing) {
        // Update existing record
        existing.attendanceStatusTypeId = data.statusId;
        existing.lastModifiedBy = markedBy;
        existing.isEdited = true;
        existing.editHistory.push({
          previousStatus: existing.attendanceStatusTypeId,
          modifiedBy: markedBy,
          modifiedAt: new Date(),
          reason: "Bulk update",
        });

        await existing.save({ session });
        records.push(existing);
      } else {
        // Create new record
        const newRecord = new this({
          studentId: data.studentId,
          courseId,
          date,
          attendanceStatusTypeId: data.statusId,
          markedBy,
          sessionId,
          deviceInfo: data.deviceInfo || "",
          ipAddress: data.ipAddress || "",
          location: data.location || "",
          remarks: data.remarks || "",
        });

        await newRecord.save({ session });
        records.push(newRecord);
      }
    }

    await session.commitTransaction();
    return records;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
