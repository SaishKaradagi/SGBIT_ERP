import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const semesterSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      immutable: true,
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      trim: true,
      maxlength: [20, "Academic year cannot exceed 20 characters"],
    },
    term: {
      type: String,
      enum: ["odd", "even"],
      required: [true, "Term is required"],
    },
    number: {
      type: Number,
      required: [true, "Semester number is required"],
      min: [1, "Semester number must be greater than 0"],
      validate: {
        validator: Number.isInteger,
        message: "Semester number must be an integer",
      },
    },

    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function (value) {
          return value > this.startDate;
        },
        message: "End date must be after start date",
      },
    },
    status: {
      type: String,
      enum: ["upcoming", "current", "completed"],
      required: [true, "Semester status is required"],
    },
  },
  {
    timestamps: true,
  },
);

// Indexing for Efficient Queries
semesterSchema.index({ academicYear: 1, term: 1 });
semesterSchema.index({ programme: 1 });
semesterSchema.index({ status: 1 });

// Static Method to Find Current Semesters
semesterSchema.statics.findCurrent = function () {
  return this.find({ status: "current" }).populate("programme", "code name");
};

// Virtual Property to Get Semester Name
semesterSchema.virtual("semesterName").get(function () {
  return `${this.academicYear} - ${this.term} (Semester ${this.number})`;
});

const Semester = mongoose.model("Semester", semesterSchema);

export default Semester;
