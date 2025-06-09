// student.model.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { ADDRESS_TYPES } from "./address.model.js"; // Import from your address model

const studentSchema = new mongoose.Schema(
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
    usn: {
      type: String,
      required: [true, "USN is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, "USN cannot exceed 20 characters"],
      index: true,
    },
    admissionYear: {
      type: Number,
      required: true,
      min: [1900, "Admission year must be after 1900"],
      max: [new Date().getFullYear(), "Admission year cannot be in the future"],
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department reference is required"],
      index: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: [true, "Batch reference is required"],
      index: true,
    },
    section: {
      type: String,
      required: [true, "Section is required"],
      trim: true,
      uppercase: true,
    },
    // Corrected: Student-specific personal information as direct properties, not references
    religion: {
      type: String,
      trim: true,
    },

    caste: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    proctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      default: null,
    },
    // Addresses will be stored in the Address collection with a reference to this student
    // No need to define address fields here

    // Indian-specific fields
    aadharNumber: {
      type: String,
      trim: true,
      select: false, // Hide by default due to sensitivity
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty
          // Validate Aadhar number (12 digits)
          return /^\d{12}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid Aadhar number!`,
      },
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      select: false, // Hide by default due to sensitivity
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow empty
          // Validate PAN number format (AAAAA9999A)
          return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid PAN number!`,
      },
    },
    // Academic-specific fields
    academics: {
      currentSemester: {
        type: Number,
        min: [1, "Semester must be at least 1"],
        max: [8, "Semester cannot exceed 12"],
      },
      cgpa: {
        type: Number,
        min: [0, "CGPA cannot be negative"],
        max: [10, "CGPA cannot exceed 10"],
      },
      backlogCount: {
        type: Number,
        default: 0,
        min: [0, "Backlog count cannot be negative"],
      },
      achievements: [String],
    },
    // Guardian reference
    guardians: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StudentGuardian",
      },
    ],
    // Metadata and additional info
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for Faster Queries
studentSchema.index({ "academics.currentSemester": 1 });
studentSchema.index({ "academics.cgpa": 1 });

// Virtual Property for Age Calculation (now correctly uses the dob field as Date)
studentSchema.virtual("age").get(function () {
  if (!this.dob) return null;
  const diff = Date.now() - this.dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)); // Convert milliseconds to years
});

// Virtual to get all addresses for this student
studentSchema.virtual("addresses", {
  ref: "Address",
  localField: "user", // The addresses are linked to the user ID
  foreignField: "user",
  options: { match: { isActive: true } }, // Only fetch active addresses
});

// Static Method to Find Students by Batch
studentSchema.statics.findByBatch = function (batchId) {
  return this.find({ batch: batchId }).populate(
    "user",
    "firstName lastName email",
  );
};

// Static Method to Find Students by Department
studentSchema.statics.findByDepartment = function (departmentId) {
  return this.find({ department: departmentId }).populate(
    "user",
    "firstName lastName email",
  );
};

// Static Method to Find Students by Proctor
studentSchema.statics.findByProctor = function (proctorId) {
  return this.find({ proctor: proctorId }).populate(
    "user",
    "firstName lastName email",
  );
};

// Helper method to get address of specific type
studentSchema.methods.getAddressByType = async function (addressType) {
  if (!Object.values(ADDRESS_TYPES).includes(addressType)) {
    throw new Error(`Invalid address type: ${addressType}`);
  }

  const Address = mongoose.model("Address");
  return Address.findOne({
    user: this.user,
    addressType: addressType,
    isActive: true,
    isDefaultForType: true,
  });
};

// Helper method to get all addresses
studentSchema.methods.getAllAddresses = async function () {
  const Address = mongoose.model("Address");
  return Address.getUserAddresses(this.user);
};

// Enhanced Student Model Updates (student.model.js additions)
// Add these methods to your existing student model:

// Method to update CGPA
studentSchema.methods.updateCGPA = async function () {
  const { ExamResult } = await import("./examResult.model.js");
  const cgpa = await ExamResult.calculateCGPA(this._id);

  this.academics.cgpa = parseFloat(cgpa);
  await this.save();

  return this.academics.cgpa;
};

// Method to get current semester results
studentSchema.methods.getCurrentSemesterResults = async function () {
  const { ExamResult } = await import("./examResult.model.js");
  const { Semester } = await import("./semester.model.js");

  const currentSemester = await Semester.findOne({
    number: this.academics.currentSemester,
    status: "current",
  });

  if (!currentSemester) return [];

  return await ExamResult.findByStudent(this._id)
    .where("semester")
    .equals(currentSemester._id);
};

// Method to get all backlogs
studentSchema.methods.getBacklogs = async function () {
  const { ExamResult } = await import("./examResult.model.js");
  return await ExamResult.findBacklogs(this._id);
};

// Method to update backlog count
studentSchema.methods.updateBacklogCount = async function () {
  const backlogs = await this.getBacklogs();
  this.academics.backlogCount = backlogs.length;
  await this.save();
  return this.academics.backlogCount;
};

// Virtual for academic performance summary
studentSchema.virtual("academicSummary").get(function () {
  return {
    currentSemester: this.academics.currentSemester,
    cgpa: this.academics.cgpa,
    backlogCount: this.academics.backlogCount,
    performance:
      this.academics.cgpa >= 8.5
        ? "Excellent"
        : this.academics.cgpa >= 7.0
          ? "Good"
          : this.academics.cgpa >= 6.0
            ? "Average"
            : "Poor",
  };
});

// Static method for department-scoped student queries
studentSchema.statics.findByDepartmentScoped = function (
  departmentId,
  options = {},
) {
  const query = this.find({ department: departmentId });

  if (options.batch) query.where("batch").equals(options.batch);
  if (options.semester)
    query.where("academics.currentSemester").equals(options.semester);
  if (options.proctor) query.where("proctor").equals(options.proctor);
  if (options.section) query.where("section").equals(options.section);
  if (options.search) {
    query.or([
      { usn: new RegExp(options.search, "i") },
      { "user.firstName": new RegExp(options.search, "i") },
      { "user.lastName": new RegExp(options.search, "i") },
      { "user.email": new RegExp(options.search, "i") },
    ]);
  }

  return query
    .populate("user", "firstName middleName lastName email phone")
    .populate("department", "name code")
    .populate("batch", "code academicYear")
    .populate("proctor", "user")
    .sort(options.sort || { createdAt: -1 });
};

const Student = mongoose.model("Student", studentSchema);
export default Student;
