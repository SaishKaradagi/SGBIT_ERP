// src/models/course.model.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const courseSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      immutable: true,
      index: true, // Added index for faster queries by UUID
    },
    code: {
      type: String,
      required: [true, "Course code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, "Course code cannot exceed 20 characters"],
      validate: {
        validator: function (v) {
          // Common format for Indian college course codes (alphanumeric with possible hyphens)
          return /^[A-Z0-9-]{2,20}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid course code format!`,
      },
    },
    name: {
      type: String,
      required: [true, "Course name is required"],
      trim: true,
      maxlength: [255, "Course name cannot exceed 255 characters"],
      minlength: [3, "Course name must be at least 3 characters"],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
      index: true,
    },
    credits: {
      type: Number,
      required: [true, "Credits are required"],
      min: [0, "Credits cannot be negative"],
      max: [20, "Credits cannot exceed 20"], // More realistic maximum for Indian college credits
      validate: {
        validator: function (v) {
          // Credits in India are typically whole numbers or half credits (e.g., 4, 3.5)
          return v === Math.floor(v) || v === Math.floor(v) + 0.5;
        },
        message: (props) =>
          `${props.value} is not a valid credit value. Use whole or half credits.`,
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    courseType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseType",
      required: [true, "Course type is required"],
      index: true,
    },
    syllabus: {
      type: String,
      trim: true,
      maxlength: [10000, "Syllabus cannot exceed 10000 characters"],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient queries
courseSchema.index({ code: 1 }, { unique: true });
courseSchema.index({ department: 1 });
courseSchema.index({ courseType: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ name: "text", description: "text" }); // Text search capabilities

// Static Method to Find Active Courses by Department
courseSchema.statics.findActiveByDepartment = function (departmentId) {
  return this.find({ department: departmentId, status: "active" })
    .populate("department", "name")
    .populate("courseType", "name");
};

// Method to Change Course Status
courseSchema.methods.changeStatus = function (newStatus, userId) {
  if (!["active", "inactive", "archived"].includes(newStatus)) {
    throw new Error("Invalid status value");
  }
  this.status = newStatus;
  this.updatedBy = userId;
  return this.save();
};

// Virtual to get prerequisites (using coursePrerequisite collection)
courseSchema.virtual("prerequisites", {
  ref: "CoursePrerequisite",
  localField: "_id",
  foreignField: "course",
  justOne: false,
});

const Course = mongoose.model("Course", courseSchema);

export default Course;
