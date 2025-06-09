import mongoose from "mongoose";

const examResultSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => crypto.randomUUID(),
      unique: true,
      immutable: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
      match: /^\d{4}-\d{4}$/,
    },
    // VTU Assessment Components
    cieMarks: {
      type: Number,
      min: 0,
      max: 50,
      default: 0,
    },
    externalMarks: {
      type: Number,
      min: 0,
      max: 50,
      default: 0,
    },
    totalMarks: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    gradeLetter: {
      type: String,
      enum: ["O", "A+", "A", "B+", "B", "C", "D", "F"],
      uppercase: true,
    },
    gradePoint: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    credits: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    // Status tracking
    status: {
      type: String,
      enum: ["PASS", "FAIL", "ABSENT", "WITHHELD", "REVALUATION"],
      default: function () {
        return this.totalMarks >= 40 ? "PASS" : "FAIL";
      },
    },
    isBacklog: {
      type: Boolean,
      default: function () {
        return this.status === "FAIL" || this.status === "ABSENT";
      },
    },
    attemptNumber: {
      type: Number,
      default: 1,
      min: 1,
      max: 6, // VTU allows up to 6 attempts
    },
    examType: {
      type: String,
      enum: ["REGULAR", "SUPPLEMENTARY", "REVALUATION"],
      default: "REGULAR",
    },
    resultDate: {
      type: Date,
      default: Date.now,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Calculate total marks and grade before saving
examResultSchema.pre("save", async function (next) {
  if (this.isModified("cieMarks") || this.isModified("externalMarks")) {
    this.totalMarks = this.cieMarks + this.externalMarks;
    this.percentage = this.totalMarks;

    // Import GradeScale model to calculate grade
    const { GradeScale } = await import("./gradeScale.model.js");
    const grade = GradeScale.calculateGrade(this.percentage);

    this.gradeLetter = grade.gradeLetter;
    this.gradePoint = grade.gradePoint;
    this.status = this.totalMarks >= 40 ? "PASS" : "FAIL";
    this.isBacklog = this.status === "FAIL" || this.status === "ABSENT";
  }
  next();
});

// Compound indexes for efficient queries
examResultSchema.index(
  { student: 1, course: 1, semester: 1 },
  { unique: true },
);
examResultSchema.index({ student: 1, academicYear: 1 });
examResultSchema.index({ department: 1, semester: 1 });
examResultSchema.index({ status: 1, isBacklog: 1 });

// Static methods
examResultSchema.statics.findByStudent = function (studentId) {
  return this.find({ student: studentId })
    .populate("course", "name code credits")
    .populate("semester", "number term academicYear")
    .sort({ createdAt: -1 });
};

examResultSchema.statics.findBacklogs = function (studentId) {
  return this.find({ student: studentId, isBacklog: true })
    .populate("course", "name code credits")
    .populate("semester", "number term academicYear");
};

examResultSchema.statics.calculateSGPA = async function (
  studentId,
  semesterId,
) {
  const results = await this.find({
    student: studentId,
    semester: semesterId,
    status: "PASS",
  }).populate("course", "credits");

  if (results.length === 0) return 0;

  const totalGradePoints = results.reduce((sum, result) => {
    return sum + result.gradePoint * result.credits;
  }, 0);

  const totalCredits = results.reduce((sum, result) => {
    return sum + result.credits;
  }, 0);

  return totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;
};

examResultSchema.statics.calculateCGPA = async function (studentId) {
  const results = await this.find({
    student: studentId,
    status: "PASS",
  }).populate("course", "credits");

  if (results.length === 0) return 0;

  const totalGradePoints = results.reduce((sum, result) => {
    return sum + result.gradePoint * result.credits;
  }, 0);

  const totalCredits = results.reduce((sum, result) => {
    return sum + result.credits;
  }, 0);

  return totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;
};

export const ExamResult = mongoose.model("ExamResult", examResultSchema);

export default ExamResult;
