const mongoose = require('mongoose');

const coursePrerequisiteSchema = new mongoose.Schema({
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  prerequisiteCourse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    validate: {
      validator: function(value) {
        return this.course.toString() !== value.toString();
      },
      message: 'A course cannot be its own prerequisite'
    }
  },
  isRequired: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true 
});

// Unique constraint on (course, prerequisiteCourse)
coursePrerequisiteSchema.index({ course: 1, prerequisiteCourse: 1 }, { unique: true });

// Static Method to Get Prerequisites for a Course
coursePrerequisiteSchema.statics.getPrerequisites = function(courseId) {
  return this.find({ course: courseId }).populate('prerequisiteCourse', 'name code');
};

// Static Method to Get Courses That Require a Specific Prerequisite
coursePrerequisiteSchema.statics.getDependentCourses = function(prerequisiteCourseId) {
  return this.find({ prerequisiteCourse: prerequisiteCourseId }).populate('course', 'name code');
};

// Pre-save Hook to Ensure No Circular Dependency
coursePrerequisiteSchema.pre('save', async function(next) {
  if (this.course.equals(this.prerequisiteCourse)) {
    return next(new Error('A course cannot be its own prerequisite'));
  }
  next();
});

const CoursePrerequisite = mongoose.model('CoursePrerequisite', coursePrerequisiteSchema);

module.exports = CoursePrerequisite;
