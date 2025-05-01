import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const facultySchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      immutable: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      unique: true,
      index: true,
    },
    facultyId: {
      type: String,
      required: [true, "Faculty ID is required"],
      unique: true,
      trim: true,
      maxlength: [20, "Faculty ID cannot be more than 20 characters"],
      match: [
        /^[A-Z0-9-]+$/,
        "Faculty ID must contain only uppercase letters, numbers, and hyphens",
      ],
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
      index: true,
    },
    // Basic Information

    // Address is handled by a separate model with references
    permanentAddress: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
    },
    currentAddress: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
    },
    // Professional Information
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      unique: true,
      trim: true,
      maxlength: [20, "Employee ID cannot be more than 20 characters"],
      match: [
        /^[A-Z0-9-]+$/,
        "Employee ID must contain only uppercase letters, numbers, and hyphens",
      ],
      index: true,
    },
    designation: {
      type: String,
      required: [true, "Designation is required"],
      trim: true,
      maxlength: [100, "Designation cannot be more than 100 characters"],
      enum: {
        values: [
          "Professor",
          "Associate Professor",
          "Assistant Professor",
          "Lecturer",
          "Teaching Assistant",
          "Lab Assistant",
          "Visiting Faculty",
          "Guest Faculty",
          "HOD",
          "Dean",
          "Principal",
        ],
        message: "{VALUE} is not a valid designation",
      },
    },
    qualification: {
      type: String,
      required: [true, "Qualification is required"],
      trim: true,
      maxlength: [200, "Qualification cannot be more than 200 characters"],
    },
    specialization: {
      type: [String],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "At least one specialization is required",
      },
    },

    experience: {
      type: Number,
      default: 0,
      min: [0, "Experience cannot be negative"],
      validate: {
        validator: function (v) {
          return Number.isInteger(v);
        },
        message: "Experience must be a whole number",
      },
    },
    experienceDetails: [
      {
        organization: {
          type: String,
          required: true,
          trim: true,
        },
        designation: {
          type: String,
          required: true,
          trim: true,
        },
        startDate: {
          type: Date,
          required: true,
        },
        endDate: {
          type: Date,
          validate: {
            validator: function (endDate) {
              return !endDate || endDate >= this.startDate;
            },
            message: "End date must be after start date",
          },
        },
        responsibilities: {
          type: String,
          trim: true,
        },
        isCurrentJob: {
          type: Boolean,
          default: false,
        },
      },
    ],
    // Academic Information
    publications: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },
        authors: {
          type: [String],
          required: true,
        },
        publishedIn: {
          type: String,
          required: true,
          trim: true,
        },
        publishedDate: {
          type: Date,
          required: true,
        },
        doi: {
          type: String,
          trim: true,
        },
        url: {
          type: String,
          trim: true,
          validate: {
            validator: function (v) {
              if (!v) return true; // URL is optional
              return /^(http|https):\/\/[^ "]+$/.test(v);
            },
            message: "Invalid URL format",
          },
        },
        type: {
          type: String,
          enum: ["journal", "conference", "book", "bookChapter", "other"],
          required: true,
        },
      },
    ],
    certifications: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        issuedBy: {
          type: String,
          required: true,
          trim: true,
        },
        issuedDate: {
          type: Date,
          required: true,
        },
        expiryDate: {
          type: Date,
        },
        credentialId: {
          type: String,
          trim: true,
        },
      },
    ],
    // Employment Information
    dateOfJoining: {
      type: Date,
      required: [true, "Date of joining is required"],
      validate: {
        validator: function (date) {
          return date <= new Date();
        },
        message: "Date of joining cannot be in the future",
      },
    },
    contractEndDate: {
      type: Date,
      validate: {
        validator: function (date) {
          return !date || date >= this.dateOfJoining;
        },
        message: "Contract end date must be after date of joining",
      },
    },
    isContractual: {
      type: Boolean,
      default: false,
    },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contractual", "visiting"],
      default: "full-time",
      required: true,
    },
    // Status and Leaves
    status: {
      type: String,
      enum: {
        values: ["active", "inactive", "on_leave", "terminated", "retired"],
        message: "{VALUE} is not a valid status",
      },
      default: "active",
      required: true,
      index: true,
    },
    statusReason: {
      type: String,
      trim: true,
      maxlength: [200, "Status reason cannot exceed 200 characters"],
    },
    leaveBalance: {
      casual: {
        type: Number,
        default: 12, // Example: 12 casual leaves per year
        min: [0, "Leave balance cannot be negative"],
      },
      sick: {
        type: Number,
        default: 10, // Example: 10 sick leaves per year
        min: [0, "Leave balance cannot be negative"],
      },
      earned: {
        type: Number,
        default: 30, // Example: 30 earned leaves per year
        min: [0, "Leave balance cannot be negative"],
      },
    },
    // Additional Information
    aadhaarNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty
          return /^\d{12}$/.test(v);
        },
        message: "Aadhaar number must be 12 digits",
      },
      select: false, // For privacy
    },
    panNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty
          return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: "Invalid PAN card format",
      },
      select: false, // For privacy
    },
    bankDetails: {
      accountNumber: {
        type: String,
        trim: true,
        select: false, // For privacy
      },
      ifscCode: {
        type: String,
        trim: true,
        validate: {
          validator: function (v) {
            if (!v) return true; // Allow empty
            return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
          },
          message: "Invalid IFSC code format",
        },
        select: false, // For privacy
      },
      bankName: {
        type: String,
        trim: true,
        select: false, // For privacy
      },
      branchName: {
        type: String,
        trim: true,
        select: false, // For privacy
      },
    },
    // Teaching Information
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    // Mentorship Information
    mentees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
      },
    ],
    // Admin and meta fields
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

// Indexes for better performance
facultySchema.index({ facultyId: 1 }, { unique: true });
facultySchema.index({ employeeId: 1 }, { unique: true });
facultySchema.index({ department: 1 });
facultySchema.index({ status: 1 });
facultySchema.index({ designation: 1 });
facultySchema.index({ "experienceDetails.isCurrentJob": 1 });

// Virtual to get tenure (time since joining)
facultySchema.virtual("tenure").get(function () {
  const joinDate = new Date(this.dateOfJoining);
  const now = new Date();
  const diffTime = Math.abs(now - joinDate);
  const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
  return diffYears;
});

// Virtual to get age
facultySchema.virtual("age").get(function () {
  // Get dateOfBirth from populated user document
  const dateOfBirth = this.user && this.user.dateOfBirth;
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  const now = new Date();
  const diffTime = Math.abs(now - birthDate);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
});

// Virtual to calculate retirement date (assuming 65 years retirement age)
facultySchema.virtual("retirementDate").get(function () {
  // Get dateOfBirth from populated user document
  const dateOfBirth = this.user && this.user.dateOfBirth;
  if (!dateOfBirth) return null;

  const retirementDate = new Date(dateOfBirth);
  retirementDate.setFullYear(retirementDate.getFullYear() + 65);
  return retirementDate;
});

// Virtual to get total publications count
facultySchema.virtual("publicationsCount").get(function () {
  return this.publications ? this.publications.length : 0;
});

// Virtual to get course allocations
facultySchema.virtual("courseAllocations", {
  ref: "CourseAllocation",
  localField: "_id",
  foreignField: "faculty",
});

// Virtual to get faculty leaves
facultySchema.virtual("leaves", {
  ref: "Leave",
  localField: "_id",
  foreignField: "faculty",
});

// Method to get the full name from the user document
facultySchema.virtual("fullName").get(function () {
  if (!this.user) return "";
  return `${this.user.firstName || ""} ${this.user.middleName || ""} ${this.user.lastName || ""}`
    .trim()
    .replace(/\s+/g, " ");
});

// Method to get email from the user document
facultySchema.virtual("email").get(function () {
  return this.user ? this.user.email : "";
});

// Method to get phone from the user document
facultySchema.virtual("phone").get(function () {
  return this.user ? this.user.phone : "";
});

facultySchema.virtual("gender").get(function () {
  return this.user ? this.user.phone : "";
});

// Method to update faculty experience
facultySchema.methods.updateExperience = function (yearsToAdd = 1) {
  this.experience += yearsToAdd;
  return this.save();
};

// Method to change faculty status
facultySchema.methods.changeStatus = function (newStatus, reason = "") {
  if (
    !["active", "inactive", "on_leave", "terminated", "retired"].includes(
      newStatus,
    )
  ) {
    throw new Error("Invalid status value");
  }
  this.status = newStatus;
  this.statusReason = reason;
  return this.save();
};

// Method to add a publication
facultySchema.methods.addPublication = function (publicationData) {
  this.publications.push(publicationData);
  return this.save();
};

// Method to add a certification
facultySchema.methods.addCertification = function (certificationData) {
  this.certifications.push(certificationData);
  return this.save();
};

// Method to add a mentee
facultySchema.methods.addMentee = function (studentId) {
  if (!this.mentees.includes(studentId)) {
    this.mentees.push(studentId);
  }
  return this.save();
};

// Method to remove a mentee
facultySchema.methods.removeMentee = function (studentId) {
  this.mentees = this.mentees.filter(
    (mentee) => mentee.toString() !== studentId.toString(),
  );
  return this.save();
};

// Method to update leave balance
facultySchema.methods.updateLeaveBalance = function (
  leaveType,
  days,
  isDeduction = true,
) {
  const validLeaveTypes = ["casual", "sick", "earned"];

  if (!validLeaveTypes.includes(leaveType)) {
    throw new Error("Invalid leave type");
  }

  if (isDeduction) {
    // Ensure balance doesn't go negative
    if (this.leaveBalance[leaveType] < days) {
      throw new Error(`Insufficient ${leaveType} leave balance`);
    }
    this.leaveBalance[leaveType] -= days;
  } else {
    this.leaveBalance[leaveType] += days;
  }

  return this.save();
};

// Static method to find active faculty by department
facultySchema.statics.findByDepartment = function (departmentId) {
  return this.find({
    department: departmentId,
    status: "active",
  })
    .populate(
      "user",
      "firstName middleName lastName email phone dateOfBirth gender",
    )
    .populate("department", "name code");
};

// Static method to find faculty by designation
facultySchema.statics.findByDesignation = function (designation) {
  return this.find({
    designation: designation,
    status: "active",
  })
    .populate(
      "user",
      "firstName middleName lastName email phone dateOfBirth gender",
    )
    .populate("department", "name code");
};

// Static method to get faculty expiring contracts in next n days
facultySchema.statics.getExpiringContracts = function (days = 30) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  return this.find({
    isContractual: true,
    contractEndDate: { $gte: today, $lte: futureDate },
    status: "active",
  })
    .populate("user", "firstName middleName lastName email phone")
    .populate("department", "name code");
};

// Static method to get faculty count by department
facultySchema.statics.countByDepartment = async function () {
  return this.aggregate([
    { $match: { status: "active" } },
    { $group: { _id: "$department", count: { $sum: 1 } } },
    {
      $lookup: {
        from: "departments",
        localField: "_id",
        foreignField: "_id",
        as: "departmentInfo",
      },
    },
    { $unwind: "$departmentInfo" },
    {
      $project: {
        department: "$departmentInfo.name",
        count: 1,
        _id: 0,
      },
    },
  ]);
};

// Static method to find a faculty with populated user information
facultySchema.statics.findOneWithUserDetails = function (filter = {}) {
  return this.findOne(filter)
    .populate(
      "user",
      "firstName middleName lastName email phone dateOfBirth gender",
    )
    .populate("department", "name code")
    .populate("permanentAddress")
    .populate("currentAddress");
};

// Static method to find faculties with populated user information
facultySchema.statics.findWithUserDetails = function (filter = {}) {
  return this.find(filter)
    .populate(
      "user",
      "firstName middleName lastName email phone dateOfBirth gender",
    )
    .populate("department", "name code");
};

// Pre-save hook to calculate experience based on experienceDetails
facultySchema.pre("save", function (next) {
  if (this.isModified("experienceDetails")) {
    let totalExperience = 0;

    this.experienceDetails.forEach((job) => {
      const startDate = new Date(job.startDate);
      let endDate;

      if (job.isCurrentJob) {
        endDate = new Date(); // Current date for current job
      } else if (job.endDate) {
        endDate = new Date(job.endDate);
      } else {
        return; // Skip if no end date and not current job
      }

      const diffTime = Math.abs(endDate - startDate);
      const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
      totalExperience += diffYears;
    });

    this.experience = Math.round(totalExperience);
  }

  next();
});

// Default query middleware to populate user information
facultySchema.pre(/^find/, function (next) {
  // This will run before any find query
  this.populate(
    "user",
    "firstName middleName lastName email phone dateOfBirth gender",
  );
  next();
});

// Define the model and export
const Faculty = mongoose.model("Faculty", facultySchema);
export default Faculty;
