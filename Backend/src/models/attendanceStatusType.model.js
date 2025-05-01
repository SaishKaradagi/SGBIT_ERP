// attendanceStatusType.model.js
import mongoose from "mongoose";

const attendanceStatusTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      required: [true, "Status name is required"],
      trim: true,
      uppercase: true,
      maxlength: [50, "Status name cannot exceed 50 characters"],
    },
    code: {
      type: String,
      unique: true,
      required: [true, "Status code is required"],
      trim: true,
      uppercase: true,
      maxlength: [10, "Status code cannot exceed 10 characters"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [255, "Description cannot exceed  255 characters"],
    },
    isCountedPresent: {
      type: Boolean,
      default: false,
      required: true,
    },
    color: {
      type: String,
      default: "#000000",
      validate: {
        validator: function (v) {
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: "Color must be a valid hex color code",
      },
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    allowFacultyUse: {
      type: Boolean,
      default: true,
    },
    affectsAttendancePercentage: {
      type: Boolean,
      default: true,
    },
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    requiresDocumentation: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for optimized queries
attendanceStatusTypeSchema.index({ name: 1 }, { unique: true });
attendanceStatusTypeSchema.index({ code: 1 }, { unique: true });
attendanceStatusTypeSchema.index({ isActive: 1 });
attendanceStatusTypeSchema.index({ displayOrder: 1 });

// Ensure there's only one default status
attendanceStatusTypeSchema.pre("save", async function (next) {
  try {
    if (this.isDefault && this.isModified("isDefault")) {
      // If setting this status as default, unset all others
      await this.constructor.updateMany(
        { _id: { $ne: this._id } },
        { $set: { isDefault: false } },
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Predefined Attendance Statuses (To be seeded)
attendanceStatusTypeSchema.statics.seedDefaults = async function () {
  const defaultStatuses = [
    {
      name: "PRESENT",
      code: "P",
      isCountedPresent: true,
      description: "Student was present for the class",
      color: "#4CAF50",
      displayOrder: 1,
      isDefault: true,
      allowFacultyUse: true,
      affectsAttendancePercentage: true,
      requiresApproval: false,
      requiresDocumentation: false,
    },
    {
      name: "ABSENT",
      code: "A",
      isCountedPresent: false,
      description: "Student was absent for the class",
      color: "#F44336",
      displayOrder: 2,
      isDefault: false,
      allowFacultyUse: true,
      affectsAttendancePercentage: true,
      requiresApproval: false,
      requiresDocumentation: false,
    },
    {
      name: "LATE",
      code: "L",
      isCountedPresent: true,
      description: "Student arrived late but attended the class",
      color: "#FFC107",
      displayOrder: 3,
      isDefault: false,
      allowFacultyUse: true,
      affectsAttendancePercentage: true,
      requiresApproval: false,
      requiresDocumentation: false,
    },
    {
      name: "EXCUSED",
      code: "E",
      isCountedPresent: true,
      description: "Student was absent with a valid excuse",
      color: "#2196F3",
      displayOrder: 4,
      isDefault: false,
      allowFacultyUse: false,
      affectsAttendancePercentage: true,
      requiresApproval: true,
      requiresDocumentation: true,
    },
    {
      name: "MEDICAL",
      code: "M",
      isCountedPresent: true,
      description: "Student was absent due to medical reasons",
      color: "#9C27B0",
      displayOrder: 5,
      isDefault: false,
      allowFacultyUse: false,
      affectsAttendancePercentage: true,
      requiresApproval: true,
      requiresDocumentation: true,
    },
    {
      name: "OFFICIAL DUTY",
      code: "OD",
      isCountedPresent: true,
      description: "Student was on official college duty",
      color: "#009688",
      displayOrder: 6,
      isDefault: false,
      allowFacultyUse: false,
      affectsAttendancePercentage: true,
      requiresApproval: true,
      requiresDocumentation: true,
    },
  ];

  // Use bulkWrite for better performance
  const operations = defaultStatuses.map((status) => ({
    updateOne: {
      filter: { name: status.name },
      update: status,
      upsert: true,
    },
  }));

  return this.bulkWrite(operations);
};

// Method to get statuses available to faculty
attendanceStatusTypeSchema.statics.getFacultyStatuses = function () {
  return this.find({
    isActive: true,
    allowFacultyUse: true,
  }).sort({ displayOrder: 1 });
};

// Method to get all active statuses
attendanceStatusTypeSchema.statics.getActiveStatuses = function () {
  return this.find({ isActive: true }).sort({ displayOrder: 1 });
};

// Method to get default status
attendanceStatusTypeSchema.statics.getDefaultStatus = function () {
  return this.findOne({ isDefault: true, isActive: true });
};

const AttendanceStatusType = mongoose.model(
  "AttendanceStatusType",
  attendanceStatusTypeSchema,
);

export default AttendanceStatusType;
