const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const departmentSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Department code cannot be more than 10 characters']
  },
  name: {
    type: String,
    required: [true, 'Department name is required'],
    trim: true,
    maxlength: [100, 'Department name cannot be more than 100 characters']
  },
  hod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty', // Changed from 'User' to 'Faculty'
    default: null
  },
  establishedYear: {
    type: Number,
    required: true,
    validate: {
      validator: function(year) {
        return year > 1900 && year <= new Date().getFullYear();
      },
      message: props => `${props.value} is not a valid year!`
    }
  },
  description: {
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

// Create indexes for commonly queried fields
departmentSchema.index({ code: 1 });
departmentSchema.index({ status: 1 });

// Virtual to get the department age
departmentSchema.virtual('age').get(function() {
  return new Date().getFullYear() - this.establishedYear;
});

// Static method to find active departments
departmentSchema.statics.findActiveDepartments = function() {
  return this.find({ status: 'active' });
};

// Method to assign HOD
departmentSchema.methods.assignHOD = async function(facultyId) {
  this.hod = facultyId;
  return await this.save();
};

// Pre middleware to ensure HOD is a faculty member
departmentSchema.pre('save', async function(next) {
  if (this.isModified('hod') && this.hod) {
    const Faculty = mongoose.model('Faculty');
    const faculty = await Faculty.findById(this.hod);
    
    if (!faculty) {
      return next(new Error('Assigned HOD does not exist in Faculty'));
    }
  }
  next();
});

// Middleware to handle "ON DELETE SET NULL" for HOD
departmentSchema.pre('save', async function(next) {
  if (this.isModified('hod') && !this.hod) {
    this.hod = null;
  }
  next();
});

// Middleware to set HOD to null when a Faculty member is deleted
const Faculty = mongoose.model('Faculty'); 
Faculty.watch().on('change', async (change) => {
  if (change.operationType === 'delete') {
    await mongoose.model('Department').updateMany(
      { hod: change.documentKey._id },
      { $set: { hod: null } }  // Equivalent to ON DELETE SET NULL
    );
  }
});

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;
