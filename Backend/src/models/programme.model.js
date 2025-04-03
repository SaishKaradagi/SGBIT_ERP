const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const programmeSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  code: {
    type: String,
    required: [true, 'Programme code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [10, 'Programme code cannot exceed 10 characters']
  },
  name: {
    type: String,
    required: [true, 'Programme name is required'],
    trim: true,
    maxlength: [100, 'Programme name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true
  },
  duration: {
    type: Number,
    required: true,
    min: [1, 'Duration must be greater than 0'],
    validate: {
      validator: Number.isInteger,
      message: 'Duration must be an integer'
    }
  }
}, { 
  timestamps: true 
});

// Indexing for Faster Queries
programmeSchema.index({ code: 1 });

// Static Method to Find Programmes by Code
programmeSchema.statics.findByCode = function (code) {
  return this.findOne({ code: code.toUpperCase() });
};

const Programme = mongoose.model('Programme', programmeSchema);

module.exports = Programme;
