const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const facultySchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  facultyId: {
    type: String,
    required: [true, 'Faculty ID is required'],
    unique: true,
    trim: true,
    maxlength: [20, 'Faculty ID cannot be more than 20 characters']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  designation: {
    type: String,
    required: [true, 'Designation is required'],
    trim: true,
    maxlength: [100, 'Designation cannot be more than 100 characters']
  },
  qualification: {
    type: String,
    required: [true, 'Qualification is required'],
    trim: true
  },
  specialization: {
    type: String,
    trim: true
  },
  experience: {
    type: Number,
    default: 0,
    min: [0, 'Experience cannot be negative']
  },
  dateOfJoining: {
    type: Date,
    required: [true, 'Date of joining is required'],
    validate: {
      validator: function(date) {
        return date <= new Date();
      },
      message: 'Date of joining cannot be in the future'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave'],
    default: 'active',
    required: true
  }
}, {
  timestamps: true
});

// Create indexes for commonly queried fields
facultySchema.index({ facultyId: 1 });
facultySchema.index({ department: 1 });
facultySchema.index({ status: 1 });

// Virtual to get tenure (time since joining)
facultySchema.virtual('tenure').get(function() {
  const joinDate = new Date(this.dateOfJoining);
  const now = new Date();
  const diffTime = Math.abs(now - joinDate);
  const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
  return diffYears;
});

// Method to update faculty experience
facultySchema.methods.updateExperience = function(yearsToAdd = 1) {
  this.experience += yearsToAdd;
  return this.save();
};

// Method to change faculty status
facultySchema.methods.changeStatus = function(newStatus) {
  if (!['active', 'inactive', 'on_leave'].includes(newStatus)) {
    throw new Error('Invalid status value');
  }
  this.status = newStatus;
  return this.save();
};

// Static method to find active faculty by department
facultySchema.statics.findByDepartment = function(departmentId) {
  return this.find({ 
    department: departmentId,
    status: 'active'
  }).populate('user', 'firstName lastName email');
};

const Faculty = mongoose.model('Faculty', facultySchema);

module.exports = Faculty;