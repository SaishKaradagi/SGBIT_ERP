const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const examSchema = new mongoose.Schema({
  uuid: {
    type: String,
    unique: true,
    default: uuidv4,
    immutable: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
  },
  semesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    required: true,
    index: true
  },
  examTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
    required: true,
    index: true
  },
  examDate: {
    type: Date,
    required: true,
    validate: {
      validator: (date) => date >= new Date(),
      message: 'Exam date must be in the future.'
    }
  },
  totalMarks: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: (v) => parseFloat(v) > 0,
      message: 'Total marks must be greater than 0.'
    }
  },
  passingMarks: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: function (v) {
        return parseFloat(v) > 0 && parseFloat(v) <= parseFloat(this.totalMarks);
      },
      message: 'Passing marks must be greater than 0 and less than or equal to total marks.'
    }
  },
  weightage: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: (v) => parseFloat(v) >= 0 && parseFloat(v) <= 100,
      message: 'Weightage must be between 0 and 100.'
    }
  }
}, { 
  timestamps: true 
});

// ✅ Indexes for Query Optimization
examSchema.index({ courseId: 1 });
examSchema.index({ semesterId: 1 });
examSchema.index({ examTypeId: 1 });

// ✅ Get Upcoming Exams
examSchema.statics.getUpcomingExams = function () {
  return this.find({ examDate: { $gte: new Date() } })
    .populate('courseId', 'code name')
    .populate('examTypeId', 'name')
    .sort({ examDate: 1 });
};

// ✅ Get Exams by Course
examSchema.statics.getExamsByCourse = function (courseId) {
  return this.find({ courseId })
    .populate('semesterId', 'name')
    .populate('examTypeId', 'name')
    .sort({ examDate: -1 });
};

// ✅ Update Exam Details
examSchema.methods.updateExamDetails = function (updates) {
  Object.keys(updates).forEach((key) => {
    if (key !== '_id' && key !== 'uuid') {
      this[key] = updates[key];
    }
  });
  return this.save();
};

// ✅ Calculate Passing Percentage
examSchema.methods.calculatePassingPercentage = function () {
  return (parseFloat(this.passingMarks) / parseFloat(this.totalMarks)) * 100;
};

// ✅ Pre-Save Hook: Ensure Passing Marks ≤ Total Marks
examSchema.pre('save', function (next) {
  if (parseFloat(this.passingMarks) > parseFloat(this.totalMarks)) {
    return next(new Error('Passing marks cannot exceed total marks.'));
  }
  next();
});

const Exam = mongoose.model('Exam', examSchema);
module.exports = Exam;
