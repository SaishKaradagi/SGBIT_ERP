const mongoose = require('mongoose');

const attendanceStatusTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    default: ''
  },
  isCountedPresent: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

// Index for optimized queries
attendanceStatusTypeSchema.index({ name: 1 }, { unique: true });

// Predefined Attendance Statuses (To be seeded)
attendanceStatusTypeSchema.statics.seedDefaults = async function () {
  const defaultStatuses = [
    { name: 'PRESENT', isCountedPresent: true, description: 'Student was present for the class' },
    { name: 'ABSENT', isCountedPresent: false, description: 'Student was absent for the class' },
    { name: 'LATE', isCountedPresent: true, description: 'Student arrived late but attended the class' },
    { name: 'EXCUSED', isCountedPresent: true, description: 'Student was absent with a valid excuse' }
  ];

  for (const status of defaultStatuses) {
    await this.updateOne({ name: status.name }, status, { upsert: true });
  }
};

const AttendanceStatusType = mongoose.model('AttendanceStatusType', attendanceStatusTypeSchema);

module.exports = AttendanceStatusType;
