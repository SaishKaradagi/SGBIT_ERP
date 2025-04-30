import mongoose from "mongoose";
import { Schema } from 'mongoose';


/**
 * GradeScale Schema - Defines grading system used in the college
 * Used for academic evaluation and calculation of SGPA/CGPA as per Indian standards
 */
const gradeScaleSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: [true, 'Grade code is required'],
    trim: true,
    uppercase: true, // Automatically convert to uppercase
    maxlength: [5, 'Grade code cannot exceed 5 characters'],
    index: true // Improve query performance
  },
  gradeName: {
    type: String,
    required: [true, 'Grade name is required'],
    trim: true,
    maxlength: [30, 'Grade name cannot exceed 30 characters']
  },
  lowerLimit: {
    type: mongoose.Types.Decimal128,
    required: [true, 'Lower limit is required'],
    get: v => parseFloat(v.toString()), // Convert Decimal128 to Number for easier usage
    validate: {
      validator: function(v) {
        return parseFloat(v) >= 0 && parseFloat(v) <= 100;
      },
      message: 'Lower limit must be between 0 and 100'
    }
  },
  upperLimit: {
    type: mongoose.Types.Decimal128,
    required: [true, 'Upper limit is required'],
    get: v => parseFloat(v.toString()), // Convert Decimal128 to Number for easier usage
    validate: {
      validator: function(v) {
        return parseFloat(v) >= 0 && parseFloat(v) <= 100;
      },
      message: 'Upper limit must be between 0 and 100'
    }
  },
  gradePoints: {
    type: mongoose.Types.Decimal128,
    required: [true, 'Grade points are required'],
    get: v => parseFloat(v.toString()), // Convert Decimal128 to Number for easier usage
    validate: {
      validator: function(v) {
        return parseFloat(v) >= 0 && parseFloat(v) <= 10;
      },
      message: 'Grade points must be between 0 and 10 as per Indian academic standards'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [255, 'Description cannot exceed 255 characters']
  },
  isActive: {
    type: Boolean, 
    default: true,
    index: true // Improve query performance
  },
  academicYear: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // Format: YYYY-YYYY (e.g., 2023-2024)
        return /^\d{4}-\d{4}$/.test(v);
      },
      message: 'Academic year should be in format YYYY-YYYY'
    }
  },
  college: {
    type: Schema.Types.ObjectId,
    ref: 'College',
    required: false // Optional for multi-college management
  }
}, { 
  timestamps: true,
  toJSON: { getters: true, virtuals: true }, // Include getters when document is converted to JSON
  toObject: { getters: true, virtuals: true }
});

// Compound index for unique combination of code and academicYear
gradeScaleSchema.index({ code: 1, academicYear: 1 }, { 
  unique: true, 
  sparse: true, // Only index documents where academicYear exists
  name: 'code_academicYear_unique'
});

// Virtual for displaying grade with points
gradeScaleSchema.virtual('displayGrade').get(function() {
  return `${this.code} (${this.gradePoints})`;
});

// Pre-save validation to ensure upperLimit > lowerLimit
gradeScaleSchema.pre('save', function(next) {
  if (parseFloat(this.upperLimit) < parseFloat(this.lowerLimit)) {
    return next(new Error('Upper limit must be greater than or equal to lower limit'));
  }
  next();
});

// Pre-save hooks to prevent overlapping grade ranges
gradeScaleSchema.pre('save', async function(next) {
  try {
    // Skip validation for document updates that don't modify limits
    if (this.isModified('lowerLimit') || this.isModified('upperLimit') || this.isNew) {
      const lowerLimit = parseFloat(this.lowerLimit);
      const upperLimit = parseFloat(this.upperLimit);
      
      // Find grades with overlapping ranges
      const query = {
        _id: { $ne: this._id }, // Exclude current document
        $or: [
          { lowerLimit: { $lte: upperLimit }, upperLimit: { $gte: lowerLimit } }
        ]
      };
      
      // Add academicYear condition if exists
      if (this.academicYear) {
        query.academicYear = this.academicYear;
      }
      
      const overlappingGrades = await this.constructor.find(query);
      
      if (overlappingGrades.length > 0) {
        return next(new Error(`Grade range overlaps with existing grades: ${overlappingGrades.map(g => g.code).join(', ')}`));
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Static methods
gradeScaleSchema.statics = {
  /**
   * Seed default Indian grading system
   * Based on typical 10-point grading system used in Indian universities
   * @param {String} academicYear - Optional academic year
   * @returns {Promise}
   */
  async seedGradeScales(academicYear = null) {
    const defaultGrades = [
      { code: 'O', gradeName: 'Outstanding', lowerLimit: 90, upperLimit: 100, gradePoints: 10, description: 'Excellent performance' },
      { code: 'A+', gradeName: 'Excellent', lowerLimit: 80, upperLimit: 89.99, gradePoints: 9, description: 'Very good performance' },
      { code: 'A', gradeName: 'Very Good', lowerLimit: 70, upperLimit: 79.99, gradePoints: 8, description: 'Good performance' },
      { code: 'B+', gradeName: 'Good', lowerLimit: 60, upperLimit: 69.99, gradePoints: 7, description: 'Above average performance' },
      { code: 'B', gradeName: 'Average', lowerLimit: 50, upperLimit: 59.99, gradePoints: 6, description: 'Average performance' },
      { code: 'C', gradeName: 'Satisfactory', lowerLimit: 45, upperLimit: 49.99, gradePoints: 5, description: 'Below average performance' },
      { code: 'P', gradeName: 'Pass', lowerLimit: 40, upperLimit: 44.99, gradePoints: 4, description: 'Minimum passing performance' },
      { code: 'F', gradeName: 'Fail', lowerLimit: 0, upperLimit: 39.99, gradePoints: 0, description: 'Failed to meet minimum criteria' },
      { code: 'AB', gradeName: 'Absent', lowerLimit: 0, upperLimit: 0, gradePoints: 0, description: 'Student was absent' },
      { code: 'I', gradeName: 'Incomplete', lowerLimit: 0, upperLimit: 0, gradePoints: 0, description: 'Course requirements not completed' }
    ];

    const bulkOps = defaultGrades.map(grade => {
      // Add academic year if provided
      if (academicYear) {
        grade.academicYear = academicYear;
      }
      
      return {
        updateOne: {
          filter: { code: grade.code, ...(academicYear ? { academicYear } : {}) },
          update: grade,
          upsert: true
        }
      };
    });

    return this.bulkWrite(bulkOps);
  },

  /**
   * Find grade by code
   * @param {String} code - Grade code
   * @param {String} academicYear - Optional academic year
   * @returns {Promise<Document>}
   */
  async findByCode(code, academicYear = null) {
    const query = { code: code.toUpperCase(), isActive: true };
    if (academicYear) {
      query.academicYear = academicYear;
    }
    return this.findOne(query).exec();
  },

  /**
   * Find appropriate grade for given marks
   * @param {Number} marks - Student's marks
   * @param {String} academicYear - Optional academic year
   * @returns {Promise<Document>}
   */
  async findByMarks(marks, academicYear = null) {
    const numMarks = parseFloat(marks);
    const query = { 
      lowerLimit: { $lte: numMarks }, 
      upperLimit: { $gte: numMarks },
      isActive: true
    };
    
    if (academicYear) {
      query.academicYear = academicYear;
    }
    
    return this.findOne(query).exec();
  },

  /**
   * List all grade scales, optionally filtered by academic year
   * @param {String} academicYear - Optional academic year
   * @param {Boolean} activeOnly - Whether to include only active grades
   * @returns {Promise<Array>}
   */
  listAllGrades(academicYear = null, activeOnly = true) {
    const query = {};
    if (academicYear) {
      query.academicYear = academicYear;
    }
    if (activeOnly) {
      query.isActive = true;
    }
    return this.find(query).sort({ gradePoints: -1 }).exec();
  },

  /**
   * Check if a grade code exists
   * @param {String} code - Grade code
   * @param {String} academicYear - Optional academic year
   * @returns {Promise<Boolean>}
   */
  async exists(code, academicYear = null) {
    const query = { code: code.toUpperCase() };
    if (academicYear) {
      query.academicYear = academicYear;
    }
    return (await this.countDocuments(query)) > 0;
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
    
    courseGrades.forEach(course => {
      totalCredits += course.credits;
      totalGradePoints += (course.credits * course.gradePoints);
    });
    
    return totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;
  },
  
  /**
   * Import grades from CSV/JSON
   * @param {Array} gradeData - Array of grade objects
   * @param {String} academicYear - Academic year for the grades
   * @returns {Promise} - Result of bulk operation
   */
  async importGrades(gradeData, academicYear = null) {
    try {
      const bulkOps = gradeData.map(grade => {
        if (academicYear) {
          grade.academicYear = academicYear;
        }
        
        return {
          updateOne: {
            filter: { 
              code: grade.code.toUpperCase(),
              ...(academicYear ? { academicYear } : {})
            },
            update: {
              $set: {
                gradeName: grade.gradeName,
                lowerLimit: grade.lowerLimit,
                upperLimit: grade.upperLimit,
                gradePoints: grade.gradePoints,
                description: grade.description,
                isActive: grade.isActive !== undefined ? grade.isActive : true
              }
            },
            upsert: true
          }
        };
      });
      
      return this.bulkWrite(bulkOps);
    } catch (error) {
      throw new Error(`Error importing grades: ${error.message}`);
    }
  }
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
    if (numScore >= parseFloat(this.lowerLimit) && numScore <= parseFloat(this.upperLimit)) {
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
    return parseFloat(this.gradePoints) > 0 && this.code !== 'F' && this.code !== 'AB' && this.code !== 'I';
  },
  
  /**
   * Archive grade scale (mark as inactive)
   */
  async archive() {
    this.isActive = false;
    return this.save();
  }
};

const GradeScale = mongoose.model('GradeScale', gradeScaleSchema);
export default GradeScale;
