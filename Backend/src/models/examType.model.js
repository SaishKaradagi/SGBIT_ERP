import mongoose from "mongoose";
import logger from "../utils/logger";

/**
 * Exam Type Schema
 * Represents different types of exams conducted in the institution
 */
const examTypeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      required: [true, "Exam type code is required"],
      uppercase: true,
      trim: true,
      maxlength: [10, "Exam type code cannot exceed 10 characters"],
      match: [
        /^[A-Z0-9]+$/,
        "Exam type code can only contain uppercase letters and numbers",
      ],
    },
    name: {
      type: String,
      unique: true,
      required: [true, "Exam type name is required"],
      trim: true,
      maxlength: [100, "Exam type name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    weightage: {
      type: Number,
      min: [0, "Weightage cannot be negative"],
      max: [100, "Weightage cannot exceed 100"],
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound index for better query performance
examTypeSchema.index({ code: 1, name: 1 });

// Pre-save hook to validate code format
examTypeSchema.pre("save", function (next) {
  // Additional validations if needed
  if (this.isModified("code")) {
    this.code = this.code.toUpperCase();
  }
  next();
});

/**
 * Seed default exam types for Indian educational context
 * Creates exam types if they don't exist
 */
examTypeSchema.statics.seedExamTypes = async function () {
  try {
    const examTypes = [
      {
        code: "CIE1",
        name: "Continuous Internal Evaluation 1",
        description: "First internal assessment test",
        weightage: 15,
      },
      {
        code: "CIE2",
        name: "Continuous Internal Evaluation 2",
        description: "Second internal assessment test",
        weightage: 15,
      },
      {
        code: "CIE3",
        name: "Continuous Internal Evaluation 3",
        description: "Third internal assessment test",
        weightage: 15,
      },
      {
        code: "LAB1",
        name: "Laboratory Assessment 1",
        description: "First lab assessment",
        weightage: 10,
      },
      {
        code: "LAB2",
        name: "Laboratory Assessment 2",
        description: "Second lab assessment",
        weightage: 10,
      },
      {
        code: "AAT",
        name: "Alternative Assessment Test",
        description: "Assignment/quiz based assessment",
        weightage: 5,
      },
      {
        code: "SEE",
        name: "Semester End Examination",
        description: "Final semester examination",
        weightage: 50,
      },
      {
        code: "MAKEUP",
        name: "Make-up Examination",
        description:
          "Make-up exam for students who missed regular exams with valid reasons",
        weightage: 0,
      },
      {
        code: "SUPP",
        name: "Supplementary Examination",
        description: "Exam for students who failed in previous attempts",
        weightage: 0,
      },
    ];

    const operations = examTypes.map((examType) => ({
      updateOne: {
        filter: { code: examType.code },
        update: examType,
        upsert: true,
      },
    }));

    const result = await this.bulkWrite(operations);
    logger.info(
      `ExamType seeding completed: ${result.upsertedCount} inserted, ${result.modifiedCount} modified`,
    );
    return result;
  } catch (error) {
    logger.error("Error seeding exam types:", error);
    throw error;
  }
};

/**
 * Find exam type by code
 * @param {string} code - The exam type code
 * @returns {Promise<Object>} - The exam type document
 */
examTypeSchema.statics.findByCode = async function (code) {
  if (!code) {
    throw new Error("Exam type code is required");
  }
  return this.findOne({
    code: code.toString().toUpperCase(),
    isActive: true,
  }).exec();
};

/**
 * List all active exam types
 * @param {boolean} includeInactive - Whether to include inactive exam types
 * @returns {Promise<Array>} - Array of exam types
 */
examTypeSchema.statics.listAllExamTypes = function (includeInactive = false) {
  const query = includeInactive ? {} : { isActive: true };
  return this.find(query).sort({ weightage: -1, name: 1 }).exec();
};

/**
 * Check if an exam type exists
 * @param {string} code - The exam type code
 * @returns {Promise<boolean>} - Whether the exam type exists
 */
examTypeSchema.statics.exists = async function (code) {
  if (!code) return false;

  const count = await this.countDocuments({
    code: code.toString().toUpperCase(),
    isActive: true,
  });
  return count > 0;
};

/**
 * Update exam type weightage
 * @param {string} code - The exam type code
 * @param {number} weightage - The new weightage
 * @returns {Promise<Object>} - The updated exam type
 */
examTypeSchema.statics.updateWeightage = async function (code, weightage) {
  if (!code) {
    throw new Error("Exam type code is required");
  }

  if (typeof weightage !== "number" || weightage < 0 || weightage > 100) {
    throw new Error("Weightage must be a number between 0 and 100");
  }

  return this.findOneAndUpdate(
    { code: code.toString().toUpperCase() },
    { $set: { weightage } },
    { new: true, runValidators: true },
  ).exec();
};

/**
 * Deactivate an exam type
 * @param {string} code - The exam type code
 * @returns {Promise<Object>} - The updated exam type
 */
examTypeSchema.statics.deactivate = async function (code) {
  if (!code) {
    throw new Error("Exam type code is required");
  }

  return this.findOneAndUpdate(
    { code: code.toString().toUpperCase() },
    { $set: { isActive: false } },
    { new: true },
  ).exec();
};

// Virtual for getting the total weightage for CIE components
examTypeSchema.virtual("isCIE").get(function () {
  return this.code.startsWith("CIE");
});

// Virtual for SEE identification
examTypeSchema.virtual("isSEE").get(function () {
  return this.code === "SEE";
});

const ExamType = mongoose.model("ExamType", examTypeSchema);
export default ExamType;
