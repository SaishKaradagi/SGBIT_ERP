// src/models/courseRegistration.model.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const courseRegistrationSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      immutable: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student is required"],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course is required"],
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: [true, "Semester is required"],
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: [true, "Batch is required"],
    },
    registrationDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ["registered", "dropped", "completed", "failed", "backlog"],
      default: "registered",
      required: true,
    },
    isRepeat: {
      type: Boolean,
      default: false,
    },
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Unique constraint on (student, course, semester)
courseRegistrationSchema.index(
  {
    student: 1,
    course: 1,
    semester: 1,
  },
  { unique: true },
);

// Indexes for efficient queries
courseRegistrationSchema.index({ student: 1 });
courseRegistrationSchema.index({ course: 1 });
courseRegistrationSchema.index({ semester: 1 });
courseRegistrationSchema.index({ status: 1 });
courseRegistrationSchema.index({ batch: 1 });

// Static Method to Find Registrations by Student
courseRegistrationSchema.statics.findByStudent = function (studentId) {
  return this.find({ student: studentId })
    .populate("course", "name code credits")
    .populate("semester", "academicYear term")
    .sort({ createdAt: -1 });
};

// Static Method to Find Current Semester Registrations
courseRegistrationSchema.statics.findCurrentSemesterRegistrations = function (
  studentId,
  semesterId,
) {
  return this.find({
    student: studentId,
    semester: semesterId,
    status: { $in: ["registered", "completed"] },
  })
    .populate("course", "name code credits")
    .populate("semester", "academicYear term");
};

// Static method to get student's completed courses
courseRegistrationSchema.statics.getCompletedCourses = function (studentId) {
  return this.find({
    student: studentId,
    status: "completed",
  })
    .populate("course", "name code credits")
    .populate("semester", "academicYear term");
};

// Pre-save Hook to Validate Registration
courseRegistrationSchema.pre("save", async function (next) {
  // For new registrations
  if (this.isNew) {
    // Check for existing registration
    const existingRegistration = await this.constructor.findOne({
      student: this.student,
      course: this.course,
      semester: this.semester,
    });

    if (existingRegistration) {
      return next(new Error("This course registration already exists!"));
    }

    // Check if the course allocation exists for this batch
    const CourseAllocation = mongoose.model("CourseAllocation");
    const allocation = await CourseAllocation.findOne({
      course: this.course,
      semester: this.semester,
      batch: this.batch,
      status: "active",
    });

    if (!allocation) {
      return next(
        new Error(
          "No active course allocation found for this course and batch",
        ),
      );
    }

    // Check prerequisites if not a repeat registration
    if (!this.isRepeat) {
      const CoursePrerequisite = mongoose.model("CoursePrerequisite");
      const prerequisiteCheck =
        await CoursePrerequisite.checkCompletedPrerequisites(
          this.course,
          this.student,
        );

      if (!prerequisiteCheck.eligible) {
        return next(
          new Error(
            `Missing prerequisites: ${prerequisiteCheck.missingPrerequisites.map((p) => p.code).join(", ")}`,
          ),
        );
      }
    }
  }

  next();
});

const CourseRegistration = mongoose.model(
  "CourseRegistration",
  courseRegistrationSchema,
);

export default CourseRegistration;