import mongoose from "mongoose";

/**
 * Fee Balance Schema
 * Tracks the current fee balance status for each student per fee structure
 */
const feeBalanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student reference is required"],
    },
    feeStructure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeStructure",
      required: [true, "Fee structure reference is required"],
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
    },
    totalFeePaid: {
      type: Number,
      required: true,
      min: [0, "Total fee paid cannot be negative"],
      default: 0,
    },
    concessionAmount: {
      type: Number,
      default: 0,
      min: [0, "Concession amount cannot be negative"],
    },
    waiverCategory: {
      type: String,
      enum: [
        "merit",
        "sports",
        "financially-challenged",
        "staff-ward",
        "other",
      ],
      trim: true,
    },
    waiverRemarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    waiverApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    waiverApprovedDate: {
      type: Date,
    },
    lastPaymentDate: {
      type: Date,
    },
    paymentHistory: [
      {
        amount: Number,
        date: Date,
        transactionRef: String,
      },
    ],
    status: {
      type: String,
      enum: ["pending", "partial", "complete", "overdue"],
      default: "pending",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Create a compound index for student, feeStructure and academicYear (unique constraint)
feeBalanceSchema.index(
  { student: 1, feeStructure: 1, academicYear: 1 },
  { unique: true },
);

// Index for frequently queried fields
feeBalanceSchema.index({ status: 1 });
feeBalanceSchema.index({ lastPaymentDate: 1 });

// Virtual for balance amount (requires population of feeStructure)
feeBalanceSchema.virtual("balanceAmount").get(function () {
  if (this.populated("feeStructure") && this.feeStructure) {
    const totalFee = parseFloat(this.feeStructure.feeAmount.toString());
    return totalFee - this.totalFeePaid - this.concessionAmount;
  }
  return null; // Can't calculate without populated feeStructure
});

// Virtual for payment percentage
feeBalanceSchema.virtual("paymentPercentage").get(function () {
  if (this.populated("feeStructure") && this.feeStructure) {
    const totalFee = parseFloat(this.feeStructure.feeAmount.toString());
    if (totalFee === 0) return 100; // Prevent division by zero
    return Math.round(
      ((this.totalFeePaid + this.concessionAmount) / totalFee) * 100,
    );
  }
  return null;
});

// Method to add a payment
feeBalanceSchema.methods.addPayment = async function (
  amount,
  transactionRef = null,
  date = new Date(),
) {
  if (amount <= 0) {
    throw new Error("Payment amount must be positive");
  }

  this.totalFeePaid += amount;
  this.lastPaymentDate = date;

  // Add to payment history
  this.paymentHistory.push({
    amount,
    date,
    transactionRef,
  });

  // Update status
  await this.updatePaymentStatus();

  return await this.save();
};

// Method to add concession
feeBalanceSchema.methods.addConcession = async function (
  amount,
  category,
  remarks,
  approvedBy,
) {
  if (amount <= 0) {
    throw new Error("Concession amount must be positive");
  }

  this.concessionAmount += amount;
  if (category) this.waiverCategory = category;
  if (remarks) this.waiverRemarks = remarks;
  if (approvedBy) {
    this.waiverApprovedBy = approvedBy;
    this.waiverApprovedDate = new Date();
  }

  // Update status
  await this.updatePaymentStatus();

  return await this.save();
};

// Method to update payment status
feeBalanceSchema.methods.updatePaymentStatus = async function () {
  // Need to populate feeStructure if not already populated
  if (!this.populated("feeStructure")) {
    await this.populate("feeStructure");
  }

  if (!this.feeStructure) return;

  const totalFee = parseFloat(this.feeStructure.feeAmount.toString());
  const totalPaid = this.totalFeePaid + this.concessionAmount;

  if (totalPaid >= totalFee) {
    this.status = "complete";
  } else if (totalPaid > 0) {
    this.status = "partial";
  } else {
    // Check if due date is passed
    const currentDate = new Date();
    if (this.feeStructure.dueDate < currentDate) {
      this.status = "overdue";
    } else {
      this.status = "pending";
    }
  }
};

// Static method to get balance amount with a single query
feeBalanceSchema.statics.getBalanceAmount = async function (
  studentId,
  feeStructureId,
  academicYear,
) {
  const result = await this.findOne({
    student: studentId,
    feeStructure: feeStructureId,
    academicYear,
    isActive: true,
  }).populate("feeStructure", "feeAmount");

  if (!result || !result.feeStructure) {
    return null;
  }

  const totalFee = parseFloat(result.feeStructure.feeAmount.toString());
  return totalFee - result.totalFeePaid - result.concessionAmount;
};

// Static method to check if a student has any pending balances
feeBalanceSchema.statics.hasPendingBalances = async function (studentId) {
  const balances = await this.find({
    student: studentId,
    status: { $in: ["pending", "partial", "overdue"] },
    isActive: true,
  }).populate("feeStructure", "feeAmount");

  return balances.length > 0;
};

// Get overdue fee balances
feeBalanceSchema.statics.getOverdueFees = async function (options = {}) {
  const { limit = 100, page = 1, departmentId } = options;
  const skip = (page - 1) * limit;

  let query = {
    status: "overdue",
    isActive: true,
  };

  // If department is specified, join with student and filter
  if (departmentId) {
    // This is a complex query requiring aggregation
    return await this.aggregate([
      {
        $match: {
          status: "overdue",
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "students",
          localField: "student",
          foreignField: "_id",
          as: "studentData",
        },
      },
      {
        $unwind: "$studentData",
      },
      {
        $match: {
          "studentData.department": new mongoose.Types.ObjectId(departmentId),
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);
  }

  // Simple query without department filter
  return await this.find(query)
    .populate("student", "name usn mobile email")
    .populate("feeStructure", "feeAmount dueDate")
    .skip(skip)
    .limit(limit)
    .sort({ "feeStructure.dueDate": 1 })
    .exec();
};

// Get fee collection summary by academic year
feeBalanceSchema.statics.getFeeCollectionSummary = async function (
  academicYear,
) {
  const result = await this.aggregate([
    {
      $match: {
        academicYear,
        isActive: true,
      },
    },
    {
      $lookup: {
        from: "feestructures",
        localField: "feeStructure",
        foreignField: "_id",
        as: "feeStructureData",
      },
    },
    {
      $unwind: "$feeStructureData",
    },
    {
      $group: {
        _id: "$status",
        totalStudents: { $sum: 1 },
        expectedAmount: {
          $sum: { $toDouble: "$feeStructureData.feeAmount" },
        },
        paidAmount: { $sum: "$totalFeePaid" },
        concessionAmount: { $sum: "$concessionAmount" },
      },
    },
  ]);

  return result;
};

const FeeBalance = mongoose.model("FeeBalance", feeBalanceSchema);

export default FeeBalance;
