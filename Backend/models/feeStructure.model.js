const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const feeStructureSchema = new mongoose.Schema({
  uuid: {
    type: String,
    unique: true,
    default: uuidv4,
    required: true,
    immutable: true
  },
  programmeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Programme',
    required: true
  },
  semesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    required: true
  },
  feeAmount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: function (v) {
        return parseFloat(v) >= 0;
      },
      message: 'Fee amount must be non-negative.'
    }
  },
  dueDate: {
    type: Date,
    required: true,
    validate: {
      validator: function (v) {
        return v >= new Date();
      },
      message: 'Due date must be in the future.'
    }
  }
}, { 
  timestamps: true 
});

// Unique index for programme + semester fee structure
feeStructureSchema.index({ programmeId: 1, semesterId: 1 }, { unique: true });

// ✅ Find Fee by Programme & Semester
feeStructureSchema.statics.findByProgrammeAndSemester = function (programmeId, semesterId) {
  return this.findOne({ programmeId, semesterId })
    .populate('programmeId', 'name')
    .populate('semesterId', 'name')
    .exec();
};

// ✅ List All Fee Structures
feeStructureSchema.statics.listAllFees = function () {
  return this.find()
    .populate('programmeId', 'name')
    .populate('semesterId', 'name')
    .sort({ dueDate: 1 })
    .exec();
};

// ✅ Check if a Fee Structure Exists
feeStructureSchema.statics.exists = async function (programmeId, semesterId) {
  return (await this.countDocuments({ programmeId, semesterId })) > 0;
};

// ✅ Calculate Total Fees for a Programme
feeStructureSchema.statics.calculateTotalFees = async function (programmeId) {
  const result = await this.aggregate([
    { $match: { programmeId: new mongoose.Types.ObjectId(programmeId) } },
    { $group: { _id: null, totalFee: { $sum: '$feeAmount' } } }
  ]);

  return result.length ? result[0].totalFee.toString() : '0';
};

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);
module.exports = FeeStructure;
