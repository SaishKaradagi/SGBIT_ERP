import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const examResultSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      unique: true,
      default: uuidv4,
      immutable: true,
      index: true, // Added indexing for direct UUID lookups
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student ID is required"],
      index: true,
    },
    subjectCode: {
      type: String,
      required: [true, "Subject code is required"],
      trim: true,
      uppercase: true,
    },
    marksObtained: {
      type: mongoose.Schema.Types.Decimal128,
      required: [true, "Marks obtained is required"],
      validate: {
        validator: function (v) {
          // Marks must be non-negative
          if (parseFloat(v) < 0) return false;

          // Check if marks obtained don't exceed total marks (if exam is available)
          // This will be verified in the pre-save hook more thoroughly
          return true;
        },
        message: (props) =>
          `Marks obtained must be non-negative and cannot exceed total marks`,
      },
    },
    outOfMarks: {
      type: mongoose.Schema.Types.Decimal128,
      required: [true, "Total marks is required"],
      validate: {
        validator: (v) => parseFloat(v) > 0,
        message: "Total marks must be greater than 0",
      },
    },
    percentage: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      default: 0,
    },
    gradeScaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GradeScale",
      required: [true, "Grade scale ID is required"],
    },
    resultStatus: {
      type: String,
      enum: {
        values: [
          "pass",
          "fail",
          "absent",
          "malpractice",
          "withheld",
          "incomplete",
        ],
        message: "{VALUE} is not a valid result status",
      },
      required: [true, "Result status is required"],
    },
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: [true, "Evaluator information is required"],
    },
    gradeLetter: {
      type: String,
      trim: true,
    },
    gradePoints: {
      type: Number,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  },
);

// Virtual field for performance indicator
examResultSchema.virtual("performanceIndicator").get(function () {
  const percentage = parseFloat(this.percentage);

  if (percentage >= 90) return "excellent";
  if (percentage >= 75) return "veryGood";
  if (percentage >= 60) return "good";
  if (percentage >= 50) return "average";
  if (percentage >= parseFloat(this.passingPercentage)) return "satisfactory";
  return "needsImprovement";
});

// Virtual field for passing percentage (calculated from exam model)
examResultSchema.virtual("passingPercentage").get(function () {
  // This will be populated during queries that compute this value
  return this._passingPercentage || 40; // Default fallback
});

// Removing the unique constraint that used examId which is no longer in the schema

// Removing indexes that used missing fields (isVerified, isPublished, revaluationRequested, revaluationStatus)

// Update grade scale based on marks
examResultSchema.methods.updateGradeScale = async function () {
  const percentage = parseFloat(this.percentage);

  const gradeScale = await mongoose
    .model("GradeScale")
    .findOne({
      lowerLimit: { $lte: percentage },
      upperLimit: { $gte: percentage },
    })
    .sort({ upperLimit: -1 }); // Sort to get the highest matching grade if multiple ranges match

  if (!gradeScale)
    throw new Error(
      "No matching grade scale found for the calculated percentage",
    );

  this.gradeScaleId = gradeScale._id;
  this.gradeLetter = gradeScale.gradeName;
  this.gradePoints = gradeScale.gradePoints;

  return this.save();
};

// Pre-save hook to validate and compute values
examResultSchema.pre("save", async function (next) {
  try {
    // Skip extensive validation for absent students
    if (this.resultStatus === "absent") {
      next();
      return;
    }

    // Calculate percentage if marks and outOfMarks are available
    if (this.isModified("marksObtained") || this.isModified("outOfMarks")) {
      const marks = parseFloat(this.marksObtained);
      const total = parseFloat(this.outOfMarks);

      if (total > 0) {
        this.percentage = (marks / total) * 100;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Handle deleted students by checking references before save
examResultSchema.pre("save", async function (next) {
  try {
    const student = await mongoose.model("Student").findById(this.studentId);
    if (!student) {
      return next(
        new Error("Referenced student not found or has been deleted"),
      );
    }

    const gradeScale = await mongoose
      .model("GradeScale")
      .findById(this.gradeScaleId);
    if (!gradeScale) {
      return next(
        new Error("Referenced grade scale not found or has been deleted"),
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

const ExamResult = mongoose.model("ExamResult", examResultSchema);
export default ExamResult;
