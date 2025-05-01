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
      index: true,
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
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
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
      max: [20, "Credits cannot exceed 20"],
      validate: {
        validator: function (v) {
          return v === Math.floor(v) || v === Math.floor(v) + 0.5;
        },
        message: (props) =>
          `${props.value} is not a valid credit value. Use whole or half credits.`,
      },
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
courseSchema.index({ code: 1 }, { unique: true });
courseSchema.index({ department: 1 });
courseSchema.index({ courseType: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ name: "text", description: "text" }); // Full-text search support

// Static method to find active courses by department
courseSchema.statics.findActiveByDepartment = function (departmentId) {
  return this.find({ department: departmentId, status: "active" })
    .populate("department", "name")
    .populate("courseType", "name");
};

// Method to change course status
courseSchema.methods.changeStatus = function (newStatus, userId) {
  if (!["active", "inactive", "archived"].includes(newStatus)) {
    throw new Error("Invalid status value");
  }
  this.status = newStatus;
  this.updatedBy = userId;
  return this.save();
};

// Virtual to get prerequisites
courseSchema.virtual("prerequisites", {
  ref: "CoursePrerequisite",
  localField: "_id",
  foreignField: "course",
  justOne: false,
});

const Course = mongoose.model("Course", courseSchema);

export default Course;
