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
    section: {
      type: String,
      required: [true, "Section is required"],
      trim: true,
      uppercase: true,
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
    grade: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function (v) {
          // Only validate if a grade is provided
          if (!v) return true;
          // Common grades in Indian universities
          return [
            "A+",
            "A",
            "B+",
            "B",
            "C+",
            "C",
            "D+",
            "D",
            "E",
            "F",
            "I",
            "W",
          ].includes(v);
        },
        message: (props) => `${props.value} is not a valid grade`,
      },
    },
    gradePoints: {
      type: Number,
      min: 0,
      max: 10, // 10-point grading system common in India
    },
    attendancePercentage: {
      type: Number,
      min: 0,
      max: 100,
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
      ref: "Admin",
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
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

// Static method to calculate SGPA for a semester
courseRegistrationSchema.statics.calculateSGPA = async function (
  studentId,
  semesterId,
) {
  const registrations = await this.find({
    student: studentId,
    semester: semesterId,
    status: "completed",
    gradePoints: { $exists: true },
  }).populate("course", "credits");

  if (registrations.length === 0) {
    return 0;
  }

  let totalCredits = 0;
  let totalGradePoints = 0;

  for (const reg of registrations) {
    totalCredits += reg.course.credits;
    totalGradePoints += reg.course.credits * reg.gradePoints;
  }

  return totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;
};

// Static method to calculate CGPA
courseRegistrationSchema.statics.calculateCGPA = async function (studentId) {
  const registrations = await this.find({
    student: studentId,
    status: "completed",
    gradePoints: { $exists: true },
  }).populate("course", "credits");

  if (registrations.length === 0) {
    return 0;
  }

  let totalCredits = 0;
  let totalGradePoints = 0;

  for (const reg of registrations) {
    totalCredits += reg.course.credits;
    totalGradePoints += reg.course.credits * reg.gradePoints;
  }

  return totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;
};

// Method to update course status and grade
courseRegistrationSchema.methods.updateGradeAndStatus = function (
  grade,
  status,
  userId,
) {
  const gradeMap = {
    "A+": 10,
    A: 9,
    "B+": 8,
    B: 7,
    "C+": 6,
    C: 5,
    "D+": 4,
    D: 3,
    E: 2,
    F: 0,
  };

  if (grade) {
    this.grade = grade;
    this.gradePoints = gradeMap[grade] || 0;
  }

  if (
    status &&
    ["registered", "dropped", "completed", "failed", "backlog"].includes(status)
  ) {
    this.status = status;
  }

  this.approvedBy = userId;
  return this.save();
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

    // Check if the course allocation exists for this section and batch
    const CourseAllocation = mongoose.model("CourseAllocation");
    const allocation = await CourseAllocation.findOne({
      course: this.course,
      semester: this.semester,
      section: this.section,
      batch: this.batch,
      status: "active",
    });

    if (!allocation) {
      return next(
        new Error(
          "No active course allocation found for this course, section, and batch",
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

  // For grade updates
  if (this.isModified("grade") && this.grade) {
    const gradeMap = {
      "A+": 10,
      A: 9,
      "B+": 8,
      B: 7,
      "C+": 6,
      C: 5,
      "D+": 4,
      D: 3,
      E: 2,
      F: 0,
    };

    this.gradePoints = gradeMap[this.grade] || 0;

    // Update status based on grade
    if (this.grade === "F") {
      this.status = "failed";
    } else if (["I", "W"].includes(this.grade)) {
      this.status = "dropped";
    } else {
      this.status = "completed";
    }
  }

  next();
});

const CourseRegistration = mongoose.model(
  "CourseRegistration",
  courseRegistrationSchema,
);

export default CourseRegistration;
