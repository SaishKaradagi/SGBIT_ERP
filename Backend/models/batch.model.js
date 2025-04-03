const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const batchSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  name: {
    type: String,
    required: [true, 'Batch name is required'],
    trim: true,
    maxlength: [50, 'Batch name cannot exceed 50 characters']
  },
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{4}$/.test(v); // Ensures format like '2024-2025'
      },
      message: 'Academic year must be in the format YYYY-YYYY'
    }
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  }
}, { timestamps: true });

// Indexes for optimized queries
batchSchema.index({ academicYear: 1 });
batchSchema.index({ department: 1 });

// Virtual to calculate duration in months
batchSchema.virtual('durationMonths').get(function() {
  const diffTime = Math.abs(this.endDate - this.startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)); // Approximate months
});

// Static method to find batches by department
batchSchema.statics.findByDepartment = function(departmentId) {
  return this.find({ department: departmentId });
};

// Export the model
const Batch = mongoose.model('Batch', batchSchema);
module.exports = Batch;
