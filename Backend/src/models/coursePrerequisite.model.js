// src/models/coursePrerequisite.model.js
import mongoose from "mongoose";

const coursePrerequisiteSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course is required"],
    },
    prerequisiteCourse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Prerequisite course is required"],
      validate: {
        validator: function (value) {
          return this.course.toString() !== value.toString();
        },
        message: "A course cannot be its own prerequisite",
      },
    },
    isRequired: {
      type: Boolean,
      default: true,
      required: true,
    },
    minGrade: {
      type: String,
      trim: true,
      uppercase: true,
      default: "D", // Common minimum passing grade in Indian universities
      validate: {
        validator: function (v) {
          // Common grades in Indian universities
          return [
            "A+",
            "A",
            "B+",
            "B",
            "C+",
            "C",
            "D+",
            "D",
            "E",
            "F",
          ].includes(v);
        },
        message: (props) => `${props.value} is not a valid grade`,
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
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

// Unique constraint on (course, prerequisiteCourse)
coursePrerequisiteSchema.index(
  { course: 1, prerequisiteCourse: 1 },
  { unique: true },
);

// Indexes for efficient queries
coursePrerequisiteSchema.index({ course: 1 });
coursePrerequisiteSchema.index({ prerequisiteCourse: 1 });

// Static Method to Get Prerequisites for a Course
coursePrerequisiteSchema.statics.getPrerequisites = function (courseId) {
  return this.find({ course: courseId })
    .populate("prerequisiteCourse", "name code")
    .populate("course", "name code");
};

// Static Method to Get Courses That Require a Specific Prerequisite
coursePrerequisiteSchema.statics.getDependentCourses = function (
  prerequisiteCourseId,
) {
  return this.find({ prerequisiteCourse: prerequisiteCourseId })
    .populate("course", "name code")
    .populate("prerequisiteCourse", "name code");
};

// Static Method to Check If Student Has Completed Prerequisites
coursePrerequisiteSchema.statics.checkCompletedPrerequisites = async function (
  courseId,
  studentId,
) {
  const prerequisites = await this.find({
    course: courseId,
    isRequired: true,
  }).populate("prerequisiteCourse", "name code");

  if (prerequisites.length === 0) {
    return { eligible: true, missingPrerequisites: [] };
  }

  const CourseRegistration = mongoose.model("CourseRegistration");

  const missingPrerequisites = [];
  for (const prereq of prerequisites) {
    const registration = await CourseRegistration.findOne({
      student: studentId,
      course: prereq.prerequisiteCourse._id,
      status: "completed",
    });

    if (!registration) {
      missingPrerequisites.push({
        course: prereq.prerequisiteCourse.name,
        code: prereq.prerequisiteCourse.code,
      });
    }
  }

  return {
    eligible: missingPrerequisites.length === 0,
    missingPrerequisites,
  };
};

// Method to check for circular dependencies
coursePrerequisiteSchema.methods.checkCircularDependency = async function () {
  const visited = new Set();
  const path = [];

  async function detectCycle(courseId) {
    if (path.includes(courseId.toString())) {
      return true;
    }

    if (visited.has(courseId.toString())) {
      return false;
    }

    visited.add(courseId.toString());
    path.push(courseId.toString());

    const prerequisites = await mongoose.model("CoursePrerequisite").find({
      course: courseId,
    });

    for (const prereq of prerequisites) {
      if (await detectCycle(prereq.prerequisiteCourse)) {
        return true;
      }
    }

    path.pop();
    return false;
  }

  return detectCycle(this.course);
};

// Pre-save Hook to Ensure No Circular Dependency
coursePrerequisiteSchema.pre("save", async function (next) {
  // Check if the document is new or prerequisiteCourse is modified
  if (this.isNew || this.isModified("prerequisiteCourse")) {
    // Basic check - course cannot be its own prerequisite
    if (this.course.equals(this.prerequisiteCourse)) {
      return next(new Error("A course cannot be its own prerequisite"));
    }

    // Check for circular dependency
    if (await this.checkCircularDependency()) {
      return next(
        new Error(
          "Adding this prerequisite would create a circular dependency",
        ),
      );
    }
  }

  next();
});

const CoursePrerequisite = mongoose.model(
  "CoursePrerequisite",
  coursePrerequisiteSchema,
);

export default CoursePrerequisite;
