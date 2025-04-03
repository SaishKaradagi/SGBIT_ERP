const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const courseSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  code: {
    type: String,
    required: [true, 'Course code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [20, 'Course code cannot exceed 20 characters']
  },
  name: {
    type: String,
    required: [true, 'Course name is required'],
    trim: true,
    maxlength: [255, 'Course name cannot exceed 255 characters']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  credits: {
    type: Number,
    required: true,
    min: [0, 'Credits cannot be negative'],
    max: [999.9, 'Credits cannot exceed 999.9']
  },
  description: {
    type: String,
    trim: true
  },
  courseType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CourseType',
    required: true
  },
  syllabus: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    required: true
  }
}, { 
  timestamps: true 
});

// Index for Efficient Queries
courseSchema.index({ code: 1 }, { unique: true });
courseSchema.index({ department: 1 });
courseSchema.index({ courseType: 1 });
courseSchema.index({ status: 1 });

// Static Method to Find Active Courses by Department
courseSchema.statics.findActiveByDepartment = function(departmentId) {
  return this.find({ department: departmentId, status: 'active' })
    .populate('department', 'name')
    .populate('courseType', 'name');
};

// Method to Change Course Status
courseSchema.methods.changeStatus = function(newStatus) {
  if (!['active', 'inactive'].includes(newStatus)) {
    throw new Error('Invalid status value');
  }
  this.status = newStatus;
  return this.save();
};

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
