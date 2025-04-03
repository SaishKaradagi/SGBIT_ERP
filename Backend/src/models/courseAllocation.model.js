const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const courseAllocationSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  semester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    required: true
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    trim: true,
    maxlength: [10, 'Section name cannot exceed 10 characters']
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true
  }
}, { 
  timestamps: true 
});

// Unique constraint on (course, faculty, semester, section, batch)
courseAllocationSchema.index({ 
  course: 1, faculty: 1, semester: 1, section: 1, batch: 1 
}, { unique: true });

// Indexes for efficient queries
courseAllocationSchema.index({ course: 1 });
courseAllocationSchema.index({ faculty: 1 });
courseAllocationSchema.index({ semester: 1 });

// Static Method to Find Course Allocations by Faculty
courseAllocationSchema.statics.findByFaculty = function(facultyId) {
  return this.find({ faculty: facultyId })
    .populate('course', 'name code')
    .populate('semester', 'academicYear term')
    .populate('batch', 'name');
};

// Pre-save Hook to Ensure Unique Allocation
courseAllocationSchema.pre('save', async function(next) {
  const existingAllocation = await this.constructor.findOne({
    course: this.course,
    faculty: this.faculty,
    semester: this.semester,
    section: this.section,
    batch: this.batch
  });

  if (existingAllocation) {
    return next(new Error('This course allocation already exists!'));
  }
  next();
});

const CourseAllocation = mongoose.model('CourseAllocation', courseAllocationSchema);

module.exports = CourseAllocation;
