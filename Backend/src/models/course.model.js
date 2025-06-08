import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

// VTU-specific Course Type Map
const VTU_COURSE_TYPES = {
  PCC: "Professional Core Course",
  PEC: "Professional Elective Course",
  OEC: "Open Elective Course",
  PRJ: "Project",
  NCMC: "Non-Credit Mandatory Course",
  BSC: "Basic Science Course",
  AEC: "Ability Enhancement Course",
  SEC: "Skill Enhancement Course",
  VAC: "Value Added Course",
  INT: "Internship",
};

const courseSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
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
        validator: (v) => /^[A-Z0-9-]{2,20}$/.test(v),
        message: (props) => `${props.value} is not a valid VTU course code!`,
      },
    },
    name: {
      type: String,
      required: [true, "Course name is required"],
      trim: true,
      maxlength: [255, "Course name cannot exceed 255 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
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
      max: [5, "VTU credits cannot exceed 5"],
      validate: {
        validator: (v) => [0, 1, 2, 3, 4, 5].includes(v),
        message: "Credits must be between 0 and 5 as per VTU norms",
      },
    },
    courseType: {
      type: String,
      required: [true, "Course type is required"],
      enum: {
        values: Object.keys(VTU_COURSE_TYPES),
        message: "Invalid VTU course type",
      },
      index: true,
    },
    semester: {
      type: Number,
      required: [true, "Semester is required"],
      min: [1, "Semester must be at least 1"],
      max: [8, "Semester cannot exceed 8"],
    },
    lectureHours: {
      type: Number,
      default: 0,
      min: [0, "Lecture hours cannot be negative"],
    },
    tutorialHours: {
      type: Number,
      default: 0,
      min: [0, "Tutorial hours cannot be negative"],
    },
    practicalHours: {
      type: Number,
      default: 0,
      min: [0, "Practical hours cannot be negative"],
    },
    isLabCourse: {
      type: Boolean,
      default: false,
    },
    scheme: {
      type: String,
      enum: ["CBGS", "CBCS", "OTHERS"],
      default: "CBCS",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },
    CreatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes (no duplicate text index)
courseSchema.index({ code: 1 }, { unique: true });
courseSchema.index({ department: 1 });
courseSchema.index({ courseType: 1 });
courseSchema.index({ semester: 1 });

// Ensure only one text index exists
// ⚠️ Drop the previous one in MongoDB if needed before uncommenting this line
courseSchema.index({ name: "text", description: "text", code: "text" });

// Virtuals
courseSchema.virtual("courseTypeName").get(function () {
  return VTU_COURSE_TYPES[this.courseType] || "Unknown";
});

courseSchema.virtual("totalHours").get(function () {
  return (
    (this.lectureHours || 0) +
    (this.tutorialHours || 0) +
    (this.practicalHours || 0)
  );
});

// Methods
courseSchema.methods.changeStatus = function (newStatus, userId) {
  if (!["active", "inactive", "archived"].includes(newStatus)) {
    throw new Error("Invalid status value");
  }
  this.status = newStatus;
  this.CreatedBy = userId;
  this.updatedBy = userId;
  return this.save();
};

// Statics
courseSchema.statics.findActiveByDepartment = function (departmentId) {
  return this.find({ department: departmentId, status: "active" })
    .populate("department", "name code")
    .sort({ semester: 1, code: 1 });
};

courseSchema.statics.getCourseTypes = function () {
  return Object.entries(VTU_COURSE_TYPES).map(([code, name]) => ({
    code,
    name,
  }));
};

// Pre-save validation
courseSchema.pre("save", function (next) {
  const totalHours = this.totalHours;

  if (this.isLabCourse && this.practicalHours < 2) {
    return next(new Error("Lab courses must have at least 2 practical hours"));
  }

  if (this.credits === 0 && totalHours > 0) {
    return next(new Error("Non-credit courses should not have teaching hours"));
  }

  next();
});

const Course = mongoose.model("Course", courseSchema);

export default Course;
