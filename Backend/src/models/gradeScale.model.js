import mongoose from "mongoose";

/**
 * GradeScale Schema - Defines grading system used in the college
 * Used for academic evaluation and calculation of SGPA/CGPA as per Indian standards
 */
const gradeScaleSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      required: [true, "Grade code is required"],
      trim: true,
      uppercase: true, // Automatically convert to uppercase
      maxlength: [5, "Grade code cannot exceed 5 characters"],
    },
    gradeName: {
      type: String,
      required: [true, "Grade name is required"],
      trim: true,
      maxlength: [30, "Grade name cannot exceed 30 characters"],
    },
    lowerLimit: {
      type: mongoose.Types.Decimal128,
      required: [true, "Lower limit is required"],
      get: (v) => parseFloat(v.toString()), // Convert Decimal128 to Number for easier usage
      validate: {
        validator: function (v) {
          return parseFloat(v) >= 0 && parseFloat(v) <= 100;
        },
        message: "Lower limit must be between 0 and 100",
      },
    },
    upperLimit: {
      type: mongoose.Types.Decimal128,
      required: [true, "Upper limit is required"],
      get: (v) => parseFloat(v.toString()), // Convert Decimal128 to Number for easier usage
      validate: {
        validator: function (v) {
          return parseFloat(v) >= 0 && parseFloat(v) <= 100;
        },
        message: "Upper limit must be between 0 and 100",
      },
    },
    gradePoints: {
      type: mongoose.Types.Decimal128,
      required: [true, "Grade points are required"],
      get: (v) => parseFloat(v.toString()), // Convert Decimal128 to Number for easier usage
      validate: {
        validator: function (v) {
          return parseFloat(v) >= 0 && parseFloat(v) <= 10;
        },
        message:
          "Grade points must be between 0 and 10 as per Indian academic standards",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

// Pre-save validation to ensure upperLimit > lowerLimit
gradeScaleSchema.pre("save", function (next) {
  if (parseFloat(this.upperLimit) < parseFloat(this.lowerLimit)) {
    return next(
      new Error("Upper limit must be greater than or equal to lower limit"),
    );
  }
  next();
});

// Basic static methods
gradeScaleSchema.statics = {
  /**
   * Find grade by code
   * @param {String} code - Grade code
   * @returns {Promise<Document>}
   */
  async findByCode(code) {
    return this.findOne({ code: code.toUpperCase(), isActive: true }).exec();
  },

  /**
   * Find appropriate grade for given marks
   * @param {Number} marks - Student's marks
   * @returns {Promise<Document>}
   */
  async findByMarks(marks) {
    const numMarks = parseFloat(marks);
    return this.findOne({
      lowerLimit: { $lte: numMarks },
      upperLimit: { $gte: numMarks },
      isActive: true,
    }).exec();
  },

  /**
   * List all active grade scales
   * @returns {Promise<Array>}
   */
  listAllGrades() {
    return this.find({ isActive: true }).sort({ gradePoints: -1 }).exec();
  },

  /**
   * Check if a grade code exists
   * @param {String} code - Grade code
   * @returns {Promise<Boolean>}
   */
  async exists(code) {
    return (await this.countDocuments({ code: code.toUpperCase() })) > 0;
  },

  /**
   * Calculate SGPA for a set of courses
   * @param {Array} courseGrades - Array of {courseId, credits, grade} objects
   * @returns {Number} - SGPA value
   */
  calculateSGPA(courseGrades) {
    if (!courseGrades || courseGrades.length === 0) return 0;

    let totalCredits = 0;
    let totalGradePoints = 0;

    courseGrades.forEach((course) => {
      totalCredits += course.credits;
      totalGradePoints += course.credits * course.gradePoints;
    });

    return totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;
  },
};

// Instance methods
gradeScaleSchema.methods = {
  /**
   * Get letter grade for a numeric score
   * @param {Number} score - Numeric score
   * @returns {String} - Letter grade
   */
  getLetterGrade(score) {
    const numScore = parseFloat(score);
    if (
      numScore >= parseFloat(this.lowerLimit) &&
      numScore <= parseFloat(this.upperLimit)
    ) {
      return this.code;
    }
    return null;
  },

  /**
   * Check if the grade is a passing grade
   * @returns {Boolean}
   */
  isPassingGrade() {
    // In most Indian universities, grades with points > 0 are passing grades
    return (
      parseFloat(this.gradePoints) > 0 &&
      this.code !== "F" &&
      this.code !== "AB" &&
      this.code !== "I"
    );
  },

  /**
   * Archive grade scale (mark as inactive)
   */
  async archive() {
    this.isActive = false;
    return this.save();
  },
};

const GradeScale = mongoose.model("GradeScale", gradeScaleSchema);
export default GradeScale;
