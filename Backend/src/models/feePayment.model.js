const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const feePaymentSchema = new mongoose.Schema({
  uuid: {
    type: String,
    unique: true,
    default: uuidv4,
    required: true,
    immutable: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  semesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    required: true
  },
  feeStructureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure',
    required: true
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  amountPaid: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: function (v) {
        return parseFloat(v) >= 0;
      },
      message: 'Amount paid must be non-negative.'
    }
  },
  paymentMode: {
    type: String,
    enum: ['cash', 'card', 'online', 'cheque', 'dd'],
    default: 'online',
    required: true
  },
  transactionId: {
    type: String,
    trim: true,
    maxlength: 255
  },
  receiptNumber: {
    type: String,
    trim: true,
    maxlength: 255
  }
}, { 
  timestamps: true 
});

// Indexes for faster queries
feePaymentSchema.index({ studentId: 1 });
feePaymentSchema.index({ semesterId: 1 });
feePaymentSchema.index({ feeStructureId: 1 });

// ✅ Find Payments by Student & Semester
feePaymentSchema.statics.findByStudentAndSemester = function (studentId, semesterId) {
  return this.find({ studentId, semesterId })
    .populate('studentId', 'name')
    .populate('semesterId', 'name')
    .populate('feeStructureId', 'feeAmount')
    .sort({ paymentDate: -1 })
    .exec();
};

// ✅ List All Payments
feePaymentSchema.statics.listAllPayments = function () {
  return this.find()
    .populate('studentId', 'name')
    .populate('semesterId', 'name')
    .populate('feeStructureId', 'feeAmount')
    .sort({ paymentDate: -1 })
    .exec();
};

// ✅ Check if Student has Paid Fees for a Semester
feePaymentSchema.statics.hasPaidFees = async function (studentId, semesterId) {
  return (await this.countDocuments({ studentId, semesterId })) > 0;
};

// ✅ Calculate Total Amount Paid by a Student
feePaymentSchema.statics.calculateTotalPaid = async function (studentId) {
  const result = await this.aggregate([
    { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
    { $group: { _id: null, totalPaid: { $sum: '$amountPaid' } } }
  ]);

  return result.length ? result[0].totalPaid.toString() : '0';
};

const FeePayment = mongoose.model('FeePayment', feePaymentSchema);
module.exports = FeePayment;
