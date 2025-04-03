const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const courseRegistrationSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  semester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    required: true
  },
  registrationDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  status: {
    type: String,
    enum: ['registered', 'dropped', 'completed'],
    default: 'registered',
    required: true
  }
}, { 
  timestamps: true 
});

// Unique constraint on (student, course, semester)
courseRegistrationSchema.index({ 
  student: 1, course: 1, semester: 1 
}, { unique: true });

// Indexes for efficient queries
courseRegistrationSchema.index({ student: 1 });
courseRegistrationSchema.index({ course: 1 });
courseRegistrationSchema.index({ semester: 1 });
courseRegistrationSchema.index({ status: 1 });

// Static Method to Find Registrations by Student
courseRegistrationSchema.statics.findByStudent = function(studentId) {
  return this.find({ student: studentId })
    .populate('course', 'name code')
    .populate('semester', 'academicYear term');
};

// Pre-save Hook to Prevent Duplicate Registrations
courseRegistrationSchema.pre('save', async function(next) {
  const existingRegistration = await this.constructor.findOne({
    student: this.student,
    course: this.course,
    semester: this.semester
  });

  if (existingRegistration) {
    return next(new Error('This course registration already exists!'));
  }
  next();
});

const CourseRegistration = mongoose.model('CourseRegistration', courseRegistrationSchema);

module.exports = CourseRegistration;
