const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const studentSchema = new mongoose.Schema({
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
    required: [true, 'User reference is required'],
    unique: true
  },
  usn: {
    type: String,
    required: [true, 'USN is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [20, 'USN cannot exceed 20 characters']
  },
  admissionYear: {
    type: Number,
    required: true,
    min: [1900, 'Admission year must be after 1900'],
    max: [new Date().getFullYear(), 'Admission year cannot be in the future']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department reference is required']
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: [true, 'Batch reference is required']
  },
  dob: {
    type: Date,
    validate: {
      validator: function (date) {
        return date < new Date();
      },
      message: 'Date of birth cannot be in the future'
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  bloodGroup: {
    type: String,
    trim: true,
    maxlength: [5, 'Blood group cannot exceed 5 characters']
  },
  category: {
    type: String,
    trim: true,
    maxlength: [50, 'Category cannot exceed 50 characters']
  },
  nationality: {
    type: String,
    default: 'Indian',
    trim: true,
    maxlength: [50, 'Nationality cannot exceed 50 characters']
  },
  proctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    default: null
  },
  address: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address',
    default: null
  },
  guardian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentGuardian',
    default: null
  }
}, { 
  timestamps: true 
});

// Indexing for Faster Queries
studentSchema.index({ usn: 1 });
studentSchema.index({ admissionYear: 1 });
studentSchema.index({ department: 1 });
studentSchema.index({ batch: 1 });
studentSchema.index({ address: 1 });
studentSchema.index({ guardian: 1 });

// Virtual Property for Age Calculation
studentSchema.virtual('age').get(function () {
  if (!this.dob) return null;
  const diff = new Date() - new Date(this.dob);
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)); // Convert milliseconds to years
});

// Static Method to Find Students by Batch
studentSchema.statics.findByBatch = function (batchId) {
  return this.find({ batch: batchId }).populate('user', 'firstName lastName email');
};

// Static Method to Find Students by Department
studentSchema.statics.findByDepartment = function (departmentId) {
  return this.find({ department: departmentId }).populate('user', 'firstName lastName email');
};

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
