import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

/**
 * Fee Structure Schema
 * Defines different fee structures available in the institution
 */
const feeStructureSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      unique: true,
      default: uuidv4,
      required: true,
      immutable: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Fee structure name is required"],
      trim: true,
      maxlength: [100, "Fee structure name cannot exceed 100 characters"],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    feeCode: {
      type: String,
      required: [true, "Fee code is required"],
      trim: true,
      maxlength: [50, "Fee code cannot exceed 50 characters"],
      unique: true,
      index: true,
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
      index: true,
    },
    programmeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Programme",
      required: [true, "Programme reference is required"],
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department reference is required"],
      index: true,
    },
    semesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: [true, "Semester reference is required"],
      index: true,
    },
    category: {
      type: String,
      enum: [
        "tuition",
        "exam",
        "admission",
        "hostel",
        "transport",
        "library",
        "laboratory",
        "event",
        "other",
      ],
      required: [true, "Fee category is required"],
      default: "tuition",
      index: true,
    },
    applicableFor: {
      type: String,
      enum: ["all", "firstYear", "lateral", "management", "nri"],
      default: "all",
      required: true,
      index: true,
    },
    feeAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: [true, "Fee amount is required"],
      validate: {
        validator: function (v) {
          return parseFloat(v) >= 0;
        },
        message: "Fee amount must be non-negative",
      },
    },
    currency: {
      type: String,
      default: "INR",
      required: true,
      enum: ["INR"],
    },
    gstApplicable: {
      type: Boolean,
      default: false,
    },
    gstPercentage: {
      type: Number,
      default: 0,
      min: [0, "GST percentage cannot be negative"],
      max: [100, "GST percentage cannot exceed 100"],
      validate: {
        validator: function (v) {
          // Only validate if GST is applicable
          return !this.gstApplicable || (v >= 0 && v <= 100);
        },
        message: "Valid GST percentage required when GST is applicable",
      },
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
      index: true,
    },
    lateFee: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      validate: {
        validator: function (v) {
          return parseFloat(v) >= 0;
        },
        message: "Late fee must be non-negative",
      },
    },
    lateFeeApplicableAfter: {
      type: Date,
    },
    isInstallmentAllowed: {
      type: Boolean,
      default: false,
    },
    installmentDetails: [
      {
        installmentNumber: {
          type: Number,
          required: true,
          min: [1, "Installment number must be positive"],
        },
        amount: {
          type: mongoose.Schema.Types.Decimal128,
          required: true,
          validate: {
            validator: function (v) {
              return parseFloat(v) > 0;
            },
            message: "Installment amount must be positive",
          },
        },
        dueDate: {
          type: Date,
          required: true,
        },
        lateFee: {
          type: mongoose.Schema.Types.Decimal128,
          default: 0,
        },
      },
    ],
    refundPolicy: {
      type: String,
      trim: true,
      maxlength: [1000, "Refund policy cannot exceed 1000 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound index for uniqueness constraint
feeStructureSchema.index(
  {
    programmeId: 1,
    semesterId: 1,
    category: 1,
    academicYear: 1,
    applicableFor: 1,
  },
  { unique: true },
);

// Virtual field for total fee amount including GST
feeStructureSchema.virtual("totalFeeAmount").get(function () {
  const feeAmount = parseFloat(this.feeAmount.toString());
  if (this.gstApplicable && this.gstPercentage > 0) {
    const gstAmount = (feeAmount * this.gstPercentage) / 100;
    return (feeAmount + gstAmount).toFixed(2);
  }
  return feeAmount.toFixed(2);
});

// Calculate remaining installment amount
feeStructureSchema.virtual("remainingInstallmentAmount").get(function () {
  if (!this.isInstallmentAllowed || !this.installmentDetails.length) {
    return "0.00";
  }

  const totalFeeAmount = parseFloat(this.feeAmount.toString());
  const totalInstallmentAmount = this.installmentDetails.reduce(
    (sum, installment) => sum + parseFloat(installment.amount.toString()),
    0,
  );

  return Math.max(totalFeeAmount - totalInstallmentAmount, 0).toFixed(2);
});

// Pre-save hook for validation
feeStructureSchema.pre("save", function (next) {
  // Validate installments total amount doesn't exceed fee amount
  if (this.isInstallmentAllowed && this.installmentDetails.length > 0) {
    const totalFeeAmount = parseFloat(this.feeAmount.toString());
    const totalInstallmentAmount = this.installmentDetails.reduce(
      (sum, installment) => sum + parseFloat(installment.amount.toString()),
      0,
    );

    if (Math.abs(totalInstallmentAmount - totalFeeAmount) > 0.01) {
      return next(
        new Error("Sum of installment amounts must equal the total fee amount"),
      );
    }

    // Check installment numbers and due dates
    const installmentNumbers = new Set();
    let prevDueDate = null;

    for (const installment of this.installmentDetails) {
      // Check for duplicate installment numbers
      if (installmentNumbers.has(installment.installmentNumber)) {
        return next(new Error("Installment numbers must be unique"));
      }
      installmentNumbers.add(installment.installmentNumber);

      // Ensure due dates are in order
      const currentDueDate = new Date(installment.dueDate);
      if (prevDueDate && currentDueDate < prevDueDate) {
        return next(
          new Error("Installment due dates must be in chronological order"),
        );
      }
      prevDueDate = currentDueDate;
    }
  }

  // Validate late fee details
  if (parseFloat(this.lateFee.toString()) > 0 && !this.lateFeeApplicableAfter) {
    return next(
      new Error(
        "Late fee applicable date is required when late fee is specified",
      ),
    );
  }

  // Validate GST details
  if (
    this.gstApplicable &&
    (this.gstPercentage <= 0 || this.gstPercentage > 100)
  ) {
    return next(
      new Error(
        "Valid GST percentage (1-100) is required when GST is applicable",
      ),
    );
  }

  next();
});

// Static method to get active fee structures for a programme and semester
feeStructureSchema.statics.getActiveFeeStructures = function (
  programmeId,
  semesterId,
  academicYear,
) {
  return this.find({
    programmeId,
    semesterId,
    academicYear,
    isActive: true,
  })
    .sort({ category: 1, name: 1 })
    .exec();
};

// Static method to calculate total fees for a student based on their applicable categories
feeStructureSchema.statics.calculateTotalFees = async function (
  programmeId,
  semesterId,
  academicYear,
  applicableFor = "all",
) {
  const feeStructures = await this.find({
    programmeId,
    semesterId,
    academicYear,
    isActive: true,
    $or: [{ applicableFor: "all" }, { applicableFor }],
  });

  let totalAmount = 0;
  let feeBreakdown = [];

  for (const fee of feeStructures) {
    const feeAmount = parseFloat(fee.feeAmount.toString());
    let totalFeeAmount = feeAmount;

    if (fee.gstApplicable && fee.gstPercentage > 0) {
      const gstAmount = (feeAmount * fee.gstPercentage) / 100;
      totalFeeAmount += gstAmount;
    }

    totalAmount += totalFeeAmount;
    feeBreakdown.push({
      feeId: fee._id,
      feeName: fee.name,
      feeCategory: fee.category,
      baseAmount: feeAmount.toFixed(2),
      gstAmount: fee.gstApplicable
        ? ((feeAmount * fee.gstPercentage) / 100).toFixed(2)
        : "0.00",
      totalAmount: totalFeeAmount.toFixed(2),
    });
  }

  return {
    totalAmount: totalAmount.toFixed(2),
    feeBreakdown,
  };
};

// Check if fee is late
feeStructureSchema.methods.isLate = function (currentDate = new Date()) {
  return this.dueDate < currentDate;
};

// Get applicable late fee as of a certain date
feeStructureSchema.methods.getApplicableLateFee = function (
  currentDate = new Date(),
) {
  if (
    parseFloat(this.lateFee.toString()) > 0 &&
    this.lateFeeApplicableAfter &&
    currentDate > this.lateFeeApplicableAfter
  ) {
    return parseFloat(this.lateFee.toString());
  }
  return 0;
};

// Method to get installment details with status
feeStructureSchema.methods.getInstallmentStatus = function (
  paidAmount = 0,
  currentDate = new Date(),
) {
  if (!this.isInstallmentAllowed || !this.installmentDetails.length) {
    return [];
  }

  let remainingAmount = paidAmount;
  const installments = [...this.installmentDetails]
    .sort((a, b) => a.installmentNumber - b.installmentNumber)
    .map((installment) => {
      const installmentAmount = parseFloat(installment.amount.toString());
      const isDue = new Date(installment.dueDate) <= currentDate;
      const isLate = new Date(installment.dueDate) < currentDate;

      let status = "upcoming";
      if (remainingAmount >= installmentAmount) {
        status = "paid";
        remainingAmount -= installmentAmount;
      } else if (isDue) {
        status = "due";
      }

      return {
        installmentNumber: installment.installmentNumber,
        amount: installmentAmount.toFixed(2),
        dueDate: installment.dueDate,
        status,
        isLate,
        lateFee:
          isLate && status !== "paid"
            ? parseFloat(installment.lateFee.toString()).toFixed(2)
            : "0.00",
      };
    });

  return installments;
};

const FeeStructure = mongoose.model("FeeStructure", feeStructureSchema);

export default FeeStructure;
