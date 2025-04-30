import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

/**
 * Admin Schema for ERP Portal (India College Context)
 * Only for users with admin-like roles.
 */
const adminSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      immutable: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      unique: true,
      index: true,
    },
    designation: {
      type: String,
      required: [true, "Designation is required"],
      trim: true,
      minlength: [2, "Designation must be at least 2 characters"],
      maxlength: [100, "Designation must be at most 100 characters"],
      match: [
        /^[A-Za-z\s.]+$/,
        "Designation must only contain letters, spaces, and periods",
      ],
    },
    // Optionally: add fields like department, officePhone, etc. if needed in future
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Index for fast lookup
adminSchema.index({ user: 1 });

/**
 * Virtual: adminInfo
 * Returns admin's name, email, and role if user is populated.
 */
adminSchema.virtual("adminInfo").get(function () {
  if (
    this.user &&
    typeof this.user === "object" &&
    this.user.fullName &&
    this.user.email &&
    this.user.role
  ) {
    return {
      name: this.user.fullName,
      email: this.user.email,
      role: this.user.role,
    };
  }
  return null;
});

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
