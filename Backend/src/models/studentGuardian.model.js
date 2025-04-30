// studentGuardian.model.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// Encryption Helper Functions
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "12345678901234567890123456789012"; // 32-byte key
const IV_LENGTH = 16; // AES block size

function encrypt(text) {
  if (!text) return "";
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  if (!text) return "";
  let parts = text.split(":");
  let iv = Buffer.from(parts[0], "hex");
  let encryptedText = Buffer.from(parts[1], "hex");
  let decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv,
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Define Schema
const studentGuardianSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      immutable: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student ID is required"],
      index: true,
    },
    // Guardian information
    name: {
      type: String,
      required: [true, "Guardian name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    relationship: {
      type: String,
      enum: {
        values: ["father", "mother", "guardian", "other"],
        message: "{VALUE} is not a valid relationship type",
      },
      required: true,
      index: true,
    },
    occupation: {
      type: String,
      trim: true,
      maxlength: [100, "Occupation cannot exceed 100 characters"],
    },
    qualification: {
      type: String,
      trim: true,
      maxlength: [100, "Qualification cannot exceed 100 characters"],
    },
    income: {
      type: Number,
      min: [0, "Income cannot be negative"],
    },
    // Contact information (encrypted)
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      set: encrypt, // Encrypt before saving
      get: decrypt, // Decrypt when retrieving
      validate: {
        validator: function (v) {
          if (!v) return true;
          const decryptedPhone = decrypt(v);
          // Indian phone number validation
          return /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/.test(decryptedPhone);
        },
        message: (props) =>
          `${decrypt(props.value)} is not a valid Indian phone number!`,
      },
    },
    alternatePhone: {
      type: String,
      set: encrypt, // Encrypt before saving
      get: decrypt, // Decrypt when retrieving
      validate: {
        validator: function (v) {
          if (!v) return true;
          const decryptedPhone = decrypt(v);
          // Indian phone number validation
          return /^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/.test(decryptedPhone);
        },
        message: (props) =>
          `${decrypt(props.value)} is not a valid Indian phone number!`,
      },
    },
    email: {
      type: String,
      set: encrypt, // Encrypt before saving
      get: decrypt, // Decrypt when retrieving
      validate: {
        validator: function (v) {
          if (!v) return true;
          let decryptedEmail = decrypt(v);
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decryptedEmail);
        },
        message: "Invalid email format",
      },
    },
    // Address information
    address: {
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
          message: (props) => `${props.value} is not a valid Indian PIN code!`,
        },
      },
      country: {
        type: String,
        default: "India",
      },
    },
    // User account reference (if guardian also has an account)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true }, // Ensure decrypted values are returned in JSON
    toObject: { getters: true },
  },
);

// Indexing for performance
studentGuardianSchema.index({ student: 1, relationship: 1 });
studentGuardianSchema.index({ user: 1 });
studentGuardianSchema.index({ "address.pincode": 1 });

// Static method to find guardians for a student
studentGuardianSchema.statics.findByStudent = function (studentId) {
  return this.find({ student: studentId });
};

// Method to update guardian's details
studentGuardianSchema.methods.updateGuardianDetails = function (updateData) {
  Object.assign(this, updateData);
  return this.save();
};

// Create a compound index for student and relationship to ensure uniqueness of primary guardians
studentGuardianSchema.index(
  { student: 1, relationship: 1 },
  {
    unique: true,
    partialFilterExpression: {
      relationship: { $in: ["father", "mother"] },
    },
  },
);

const StudentGuardian = mongoose.model(
  "StudentGuardian",
  studentGuardianSchema,
);
export default StudentGuardian;
