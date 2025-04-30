// student.model.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

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
    // Student-specific personal information
    dob: {
      type: Date,
      required: [true, "Date of birth is required"],
      validate: {
        validator: function (date) {
          const now = new Date();
          const fiveYearsAgo = new Date(
            now.getFullYear() - 5,
            now.getMonth(),
            now.getDate(),
          );
          const hundredYearsAgo = new Date(
            now.getFullYear() - 100,
            now.getMonth(),
            now.getDate(),
          );
          return date <= fiveYearsAgo && date >= hundredYearsAgo;
        },
        message: "Date of birth must be within a valid range (5-100 years old)",
      },
    },
    gender: {
      type: String,
      enum: {
        values: ["male", "female", "other", "preferNotToSay"],
        message: "{VALUE} is not a valid gender",
      },
      required: [true, "Gender is required"],
    },
    bloodGroup: {
      type: String,
      trim: true,
      maxlength: [5, "Blood group cannot exceed 5 characters"],
    },
    category: {
      type: String,
      trim: true,
      maxlength: [50, "Category cannot exceed 50 characters"],
    },
    nationality: {
      type: String,
      default: "Indian",
      trim: true,
      maxlength: [50, "Nationality cannot exceed 50 characters"],
    },
    proctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      default: null,
    },
    // Address information
    address: {
      permanent: {
        street: String,
        city: String,
        state: String,
        pincode: {
          type: String,
          validate: {
            validator: function (v) {
              if (!v) return true; // Allow empty
              // Indian PIN code validation (6 digits)
              return /^\d{6}$/.test(v);
            },
            message: (props) =>
              `${props.value} is not a valid Indian PIN code!`,
          },
        },
        country: {
          type: String,
          default: "India",
        },
      },
      current: {
        street: String,
        city: String,
        state: String,
        pincode: {
          type: String,
          validate: {
            validator: function (v) {
              if (!v) return true; // Allow empty
              // Indian PIN code validation (6 digits)
              return /^\d{6}$/.test(v);
            },
            message: (props) =>
              `${props.value} is not a valid Indian PIN code!`,
          },
        },
        country: {
          type: String,
          default: "India",
        },
      },
    },
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
studentSchema.index({ "address.permanent.pincode": 1 });
studentSchema.index({ "address.current.pincode": 1 });
studentSchema.index({ "academics.currentSemester": 1 });
studentSchema.index({ "academics.cgpa": 1 });

// Virtual Property for Age Calculation
studentSchema.virtual("age").get(function () {
  if (!this.dob) return null;
  const diff = Date.now() - this.dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)); // Convert milliseconds to years
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

const Student = mongoose.model("Student", studentSchema);
export default Student;
