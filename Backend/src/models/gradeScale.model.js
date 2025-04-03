const mongoose = require('mongoose');

const gradeScaleSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    maxlength: 5
  },
  gradeName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30
  },
  lowerLimit: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: function (v) {
        return parseFloat(v) >= 0 && parseFloat(v) <= 100;
      },
      message: 'Lower limit must be between 0 and 100.'
    }
  },
  upperLimit: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: function (v) {
        return parseFloat(v) >= 0 && parseFloat(v) <= 100 && parseFloat(v) >= parseFloat(this.lowerLimit);
      },
      message: 'Upper limit must be between 0 and 100, and >= lower limit.'
    }
  },
  gradePoints: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: (v) => parseFloat(v) >= 0 && parseFloat(v) <= 10,
      message: 'Grade points must be between 0 and 10.'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: 255
  }
}, { 
  timestamps: true 
});

// Unique index for grade code
gradeScaleSchema.index({ code: 1 }, { unique: true });

// ✅ Auto-Seeding Method
gradeScaleSchema.statics.seedGradeScales = async function () {
  const defaultGrades = [
    { code: 'A+', gradeName: 'Excellent', lowerLimit: 90, upperLimit: 100, gradePoints: 10 },
    { code: 'A', gradeName: 'Very Good', lowerLimit: 80, upperLimit: 89.99, gradePoints: 9 },
    { code: 'B+', gradeName: 'Good', lowerLimit: 70, upperLimit: 79.99, gradePoints: 8 },
    { code: 'B', gradeName: 'Above Average', lowerLimit: 60, upperLimit: 69.99, gradePoints: 7 },
    { code: 'C+', gradeName: 'Average', lowerLimit: 50, upperLimit: 59.99, gradePoints: 6 },
    { code: 'C', gradeName: 'Pass', lowerLimit: 40, upperLimit: 49.99, gradePoints: 5 },
    { code: 'F', gradeName: 'Fail', lowerLimit: 0, upperLimit: 39.99, gradePoints: 0 }
  ];

  for (const grade of defaultGrades) {
    await this.updateOne({ code: grade.code }, grade, { upsert: true });
  }
};

// ✅ Find Grade by Code
gradeScaleSchema.statics.findByCode = async function (code) {
  return this.findOne({ code: code.toUpperCase() }).exec();
};

// ✅ Find Grade by Marks
gradeScaleSchema.statics.findByMarks = async function (marks) {
  return this.findOne({ lowerLimit: { $lte: marks }, upperLimit: { $gte: marks } }).exec();
};

// ✅ List All Grade Scales
gradeScaleSchema.statics.listAllGrades = function () {
  return this.find().sort({ lowerLimit: -1 }).exec();
};

// ✅ Check if a Grade Code Exists
gradeScaleSchema.statics.exists = async function (code) {
  return (await this.countDocuments({ code: code.toUpperCase() })) > 0;
};

const GradeScale = mongoose.model('GradeScale', gradeScaleSchema);
module.exports = GradeScale;
