import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const batchSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      immutable: true,
      index: true, // Added index for faster lookups by UUID
    },
    name: {
      type: String,
      required: [true, "Batch name is required"],
      trim: true,
      maxlength: [50, "Batch name cannot exceed 50 characters"],
      minlength: [2, "Batch name must be at least 2 characters long"],
    },
    code: {
      type: String,
      required: [true, "Batch code is required"],
      trim: true,
      uppercase: true,
      unique: true,
      match: [
        /^[A-Z0-9-]{2,20}$/,
        "Batch code can only contain uppercase letters, numbers, and hyphens",
      ],
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
      validate: {
        validator: function (v) {
          // Ensures format like '2024-2025' and that the second year is one more than first
          const years = v.split("-");
          return (
            /^\d{4}-\d{4}$/.test(v) &&
            parseInt(years[1]) === parseInt(years[0]) + 1
          );
        },
        message: (props) =>
          `${props.value} is not a valid academic year format. Must be YYYY-YYYY with second year being one more than first year`,
      },
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      validate: {
        validator: function (value) {
          // Prevent start dates too far in the past or future
          const now = new Date();
          const fiveYearsAgo = new Date(
            now.getFullYear() - 5,
            now.getMonth(),
            now.getDate(),
          );
          const fiveYearsFromNow = new Date(
            now.getFullYear() + 5,
            now.getMonth(),
            now.getDate(),
          );
          return value >= fiveYearsAgo && value <= fiveYearsFromNow;
        },
        message:
          "Start date must be within a reasonable range (±5 years from current date)",
      },
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function (value) {
          if (!this.startDate) return false;

          // End date must be after start date
          if (value <= this.startDate) return false;

          // End date shouldn't be too far after start date (more than 7 years)
          const maxDuration = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years in milliseconds
          return value - this.startDate <= maxDuration;
        },
        message:
          "End date must be after start date and within 7 years of start date",
      },
    },
    status: {
      type: String,
      enum: {
        values: ["UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"],
        message: "{VALUE} is not a valid batch status",
      },
      default: "UPCOMING",
      required: true,
      index: true,
    },
    capacity: {
      type: Number,
      min: [1, "Capacity must be at least 1"],
      max: [1000, "Capacity cannot exceed 1000"],
      default: 60,
    },
    coordinators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Faculty",
      },
    ],
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for optimized queries
batchSchema.index({ academicYear: 1 });
batchSchema.index({ name: 1, department: 1 }, { unique: true }); // Unique constraint for batch name within a department
batchSchema.index({ startDate: 1, endDate: 1 }); // For date range queries

// Virtual to calculate duration in months
batchSchema.virtual("durationMonths").get(function () {
  if (!this.startDate || !this.endDate) return null;

  const startYear = this.startDate.getFullYear();
  const startMonth = this.startDate.getMonth();
  const endYear = this.endDate.getFullYear();
  const endMonth = this.endDate.getMonth();

  return (endYear - startYear) * 12 + (endMonth - startMonth);
});

// Virtual to get current semester based on current date
batchSchema.virtual("currentSemester").get(function () {
  if (!this.startDate || !this.endDate) return null;
  const now = new Date();

  // If batch hasn't started or has ended
  if (now < this.startDate || now > this.endDate) return null;

  const monthsElapsed =
    (now.getFullYear() - this.startDate.getFullYear()) * 12 +
    (now.getMonth() - this.startDate.getMonth());

  // Assuming each semester is 6 months
  return Math.floor(monthsElapsed / 6) + 1;
});

// Virtual to reference students in this batch - will be populated on demand
batchSchema.virtual("students", {
  ref: "Student",
  localField: "_id",
  foreignField: "batch",
});

// Static method to find batches by department
batchSchema.statics.findByDepartment = function (departmentId) {
  return this.find({ department: departmentId, isActive: true }).sort({
    startDate: -1,
  });
};

// Static method to find active batches
batchSchema.statics.findActiveBatches = function () {
  const now = new Date();
  return this.find({
    startDate: { $lte: now },
    endDate: { $gte: now },
    isActive: true,
    status: "ACTIVE",
  }).populate("department", "name code");
};

// Instance method to check if batch is currently active
batchSchema.methods.isCurrentlyActive = function () {
  const now = new Date();
  return (
    this.startDate <= now &&
    now <= this.endDate &&
    this.isActive &&
    this.status === "ACTIVE"
  );
};

// Pre-save middleware to automatically set status based on dates
batchSchema.pre("save", function (next) {
  const now = new Date();

  if (
    this.isModified("startDate") ||
    this.isModified("endDate") ||
    this.isModified("status")
  ) {
    if (now < this.startDate) {
      this.status = "UPCOMING";
    } else if (now > this.endDate) {
      this.status = "COMPLETED";
    } else if (this.status !== "CANCELLED") {
      this.status = "ACTIVE";
    }
  }

  next();
});

// Ensure the model name is capitalized as per convention
const Batch = mongoose.model("Batch", batchSchema);

export default Batch;
