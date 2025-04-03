const mongoose = require('mongoose');

const feeBalanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  feeStructure: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeStructure',
    required: true
  },
  totalFeePaid: {
    type: Number,
    required: true,
    min: [0, 'Total fee paid cannot be negative'],
    default: 0
  },
  concessionAmount: {
    type: Number,
    default: 0,
    min: [0, 'Concession amount cannot be negative']
  },
  waiverRemarks: {
    type: String,
    trim: true,
    maxlength: 255
  },
  lastPaymentDate: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create a compound index for student and feeStructure (unique constraint)
feeBalanceSchema.index({ student: 1, feeStructure: 1 }, { unique: true });

// Virtual for balance amount (requires population of feeStructure)
feeBalanceSchema.virtual('balanceAmount').get(function() {
  if (this.populated('feeStructure') && this.feeStructure) {
    return this.feeStructure.feeAmount - this.totalFeePaid - this.concessionAmount;
  }
  return null; // Can't calculate without populated feeStructure
});

// Method to add a payment
feeBalanceSchema.methods.addPayment = async function(amount, date = new Date()) {
  if (amount <= 0) {
    throw new Error('Payment amount must be positive');
  }
  
  this.totalFeePaid += amount;
  this.lastPaymentDate = date;
  return await this.save();
};

// Method to add concession
feeBalanceSchema.methods.addConcession = async function(amount, remarks) {
  if (amount <= 0) {
    throw new Error('Concession amount must be positive');
  }
  
  this.concessionAmount += amount;
  if (remarks) {
    this.waiverRemarks = remarks;
  }
  return await this.save();
};

// Static method to get balance amount with a single query
feeBalanceSchema.statics.getBalanceAmount = async function(studentId, feeStructureId) {
  const result = await this.findOne({ student: studentId, feeStructure: feeStructureId })
    .populate('feeStructure', 'feeAmount');
  
  if (!result || !result.feeStructure) {
    return null;
  }
  
  return result.feeStructure.feeAmount - result.totalFeePaid - result.concessionAmount;
};

// Static method to check if a student has any pending balances
feeBalanceSchema.statics.hasPendingBalances = async function(studentId) {
  const balances = await this.find({ student: studentId })
    .populate('feeStructure', 'feeAmount');
  
  return balances.some(balance => 
    balance.feeStructure.feeAmount > (balance.totalFeePaid + balance.concessionAmount)
  );
};

const FeeBalance = mongoose.model('FeeBalance', feeBalanceSchema);

module.exports = FeeBalance;