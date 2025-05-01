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
    // Corrected: Student-specific personal information as direct properties, not references
    dob: {
      type: Date,
      required: [true, "Date of birth is required"],
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["Male", "Female", "Other", "Prefer not to say"],
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
      default: "Unknown",
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
        max: [12, "Semester cannot exceed 12"],
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
  localField: "user",  // The addresses are linked to the user ID
  foreignField: "user",
  options: { match: { isActive: true } } // Only fetch active addresses
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
    isDefaultForType: true
  });
};

// Helper method to get all addresses
studentSchema.methods.getAllAddresses = async function () {
  const Address = mongoose.model("Address");
  return Address.getUserAddresses(this.user);
};

const Student = mongoose.model("Student", studentSchema);
export default Student;