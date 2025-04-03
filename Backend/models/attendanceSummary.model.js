const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const attendanceSummarySchema = new mongoose.Schema({
  uuid: {
    type: String,
    unique: true,
    default: uuidv4
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
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
  totalClasses: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  attended: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: {
      validator: function (value) {
        return value <= this.totalClasses;
      },
      message: 'Attended classes cannot exceed total classes'
    }
  },
  condonationApplied: {
    type: Boolean,
    default: false
  },
  condonationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { 
  timestamps: true
});

// ✅ Virtual Field: Auto-Calculate Percentage
attendanceSummarySchema.virtual('percentage').get(function () {
  return this.totalClasses > 0 ? (this.attended / this.totalClasses) * 100 : null;
});

// ✅ Unique Constraint: Prevent Duplicate Records
attendanceSummarySchema.index({ studentId: 1, courseId: 1, semesterId: 1 }, { unique: true });

// ✅ Auto-Update Percentage Before Save
attendanceSummarySchema.pre('save', function (next) {
  if (this.totalClasses > 0) {
    this.percentage = (this.attended / this.totalClasses) * 100;
  } else {
    this.percentage = null;
  }
  next();
});

const AttendanceSummary = mongoose.model('AttendanceSummary', attendanceSummarySchema);

module.exports = AttendanceSummary;
