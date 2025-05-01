import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

/**
 * Fee Payment Schema
 * Records individual fee payment transactions made by students
 */
const feePaymentSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      unique: true,
      default: uuidv4,
      required: true,
      immutable: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student reference is required"],
    },
    semesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: [true, "Semester reference is required"],
    },
    feeStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeStructure",
      required: [true, "Fee structure reference is required"],
    },

    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    amountPaid: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      validate: {
        validator: function (v) {
          return parseFloat(v) > 0; // Must be positive
        },
        message: "Amount paid must be positive.",
      },
    },
    paymentMode: {
      type: String,
      enum: [
        "cash",
        "card",
        "upi",
        "netbanking",
        "cheque",
        "dd",
        "neft",
        "rtgs",
      ],
      default: "upi",
      required: true,
    },
    bankName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    bankBranch: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    transactionId: {
      type: String,
      trim: true,
      maxlength: 255,
      index: true,
    },
    receiptNumber: {
      type: String,
      trim: true,
      maxlength: 255,
      unique: true,
      required: true,
      index: true,
    },
    chequeOrDdNumber: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    chequeOrDdDate: {
      type: Date,
    },
    paymentStatus: {
      type: String,
      enum: ["success", "pending", "failed", "refunded"],
      default: "success",
    },
    paymentGateway: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    feeBalanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeBalance",
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    deletionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
feePaymentSchema.index({ studentId: 1 });
feePaymentSchema.index({ semesterId: 1 });
feePaymentSchema.index({ feeStructureId: 1 });
feePaymentSchema.index({ isDeleted: 1 });
feePaymentSchema.index({ paymentStatus: 1 });

// Generate receipt number before saving
feePaymentSchema.pre("save", async function (next) {
  if (this.isNew && !this.receiptNumber) {
    const prefix = "SGBIT-FEE-";
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");

    // Get count of documents for this month to generate sequential number
    const count = await mongoose.model("FeePayment").countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), 1),
        $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
      },
    });

    // Format: SGBIT-FEE-YYMM-XXXX (XXXX is sequential number)
    this.receiptNumber = `${prefix}${year}${month}-${(count + 1).toString().padStart(4, "0")}`;
  }

  // Additional validations for payment modes
  if (["cheque", "dd"].includes(this.paymentMode)) {
    if (!this.chequeOrDdNumber) {
      return next(
        new Error(
          `${this.paymentMode.toUpperCase()} number is required for ${this.paymentMode} payments`,
        ),
      );
    }
    if (!this.chequeOrDdDate) {
      return next(
        new Error(
          `${this.paymentMode.toUpperCase()} date is required for ${this.paymentMode} payments`,
        ),
      );
    }
    if (!this.bankName) {
      return next(
        new Error(`Bank name is required for ${this.paymentMode} payments`),
      );
    }
  }

  if (
    ["card", "upi", "netbanking", "neft", "rtgs"].includes(this.paymentMode) &&
    !this.transactionId
  ) {
    return next(
      new Error(`Transaction ID is required for ${this.paymentMode} payments`),
    );
  }

  next();
});

// Soft delete method
feePaymentSchema.methods.softDelete = async function (adminId, reason) {
  if (!adminId) {
    throw new Error("Admin ID is required for deletion");
  }

  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = adminId;

  if (reason) {
    this.deletionReason = reason;
  }

  return await this.save();
};

// Find Payments by Student & Semester
feePaymentSchema.statics.findByStudentAndSemester = function (
  studentId,
  semesterId,
) {
  return this.find({
    studentId,
    semesterId,
    isDeleted: false,
    paymentStatus: "success",
  })
    .populate("studentId", "name usn email mobile")
    .populate("semesterId", "name")
    .populate("feeStructureId", "feeAmount")
    .populate("collectedBy", "name")
    .sort({ paymentDate: -1 })
    .exec();
};

// List All Payments with pagination
feePaymentSchema.statics.listAllPayments = function (options = {}) {
  const {
    limit = 50,
    page = 1,
    sortBy = "paymentDate",
    sortOrder = -1,
  } = options;
  const skip = (page - 1) * limit;

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder;

  return this.find({ isDeleted: false, paymentStatus: "success" })
    .populate("studentId", "name usn email mobile")
    .populate("semesterId", "name")
    .populate("feeStructureId", "feeAmount")
    .populate("collectedBy", "name")
    .sort(sortOptions)
    .skip(skip)
    .limit(limit)
    .exec();
};

// Check if Student has Paid Fees for a Semester
feePaymentSchema.statics.hasPaidFees = async function (studentId, semesterId) {
  return (
    (await this.countDocuments({
      studentId,
      semesterId,
      isDeleted: false,
      paymentStatus: "success",
    })) > 0
  );
};

// Calculate Total Amount Paid by a Student
feePaymentSchema.statics.calculateTotalPaid = async function (studentId) {
  const result = await this.aggregate([
    {
      $match: {
        studentId: new mongoose.Types.ObjectId(studentId),
        isDeleted: false,
        paymentStatus: "success",
      },
    },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: { $toDouble: "$amountPaid" } },
      },
    },
  ]);

  return result.length ? result[0].totalPaid.toFixed(2) : "0.00";
};

// Get payment statistics by date range
feePaymentSchema.statics.getPaymentStatistics = async function (
  startDate,
  endDate,
) {
  const matchStage = {
    isDeleted: false,
    paymentStatus: "success",
  };

  if (startDate || endDate) {
    matchStage.paymentDate = {};

    if (startDate) {
      matchStage.paymentDate.$gte = new Date(startDate);
    }

    if (endDate) {
      matchStage.paymentDate.$lte = new Date(endDate);
    }
  }

  const result = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: "$paymentDate" },
          month: { $month: "$paymentDate" },
          day: { $dayOfMonth: "$paymentDate" },
        },
        totalAmount: { $sum: { $toDouble: "$amountPaid" } },
        count: { $sum: 1 },
        paymentModes: {
          $push: "$paymentMode",
        },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
        "_id.day": 1,
      },
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateFromParts: {
            year: "$_id.year",
            month: "$_id.month",
            day: "$_id.day",
          },
        },
        totalAmount: 1,
        count: 1,
        paymentModes: 1,
      },
    },
  ]);

  return result;
};

// Get receipts by payment mode
feePaymentSchema.statics.getReceiptsByPaymentMode = function (
  paymentMode,
  options = {},
) {
  const { limit = 50, page = 1 } = options;
  const skip = (page - 1) * limit;

  return this.find({
    paymentMode,
    isDeleted: false,
    paymentStatus: "success",
  })
    .populate("studentId", "name usn email mobile")
    .populate("semesterId", "name")
    .populate("feeStructureId", "feeAmount")
    .populate("collectedBy", "name")
    .sort({ paymentDate: -1 })
    .skip(skip)
    .limit(limit)
    .exec();
};

// Find payment by transaction ID
feePaymentSchema.statics.findByTransactionId = function (transactionId) {
  return this.findOne({
    transactionId,
    isDeleted: false,
  })
    .populate("studentId", "name usn email mobile")
    .populate("semesterId", "name")
    .populate("feeStructureId", "feeAmount")
    .populate("collectedBy", "name")
    .exec();
};

// Find payment by receipt number
feePaymentSchema.statics.findByReceiptNumber = function (receiptNumber) {
  return this.findOne({
    receiptNumber,
    isDeleted: false,
  })
    .populate("studentId", "name usn email mobile")
    .populate("semesterId", "name")
    .populate("feeStructureId", "feeAmount")
    .populate("collectedBy", "name")
    .exec();
};

const FeePayment = mongoose.model("FeePayment", feePaymentSchema);
export default FeePayment;
