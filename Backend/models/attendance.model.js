const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const attendanceSchema = new mongoose.Schema({
  uuid: {
    type: String,
    unique: true,
    default: uuidv4
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true // Optimized for date-based queries
  },
  attendanceStatusTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceStatusType',
    required: true
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  }
}, { 
  timestamps: true 
});

// Unique constraint to prevent duplicate attendance records
attendanceSchema.index({ studentId: 1, courseId: 1, date: 1 }, { unique: true });

// Time-To-Live (TTL) Index Alternative to Partitioning
attendanceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 5 }); // 5 years retention

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
