// src/models/courseAllocation.model.js
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const courseAllocationSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      immutable: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course is required"],
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: [true, "Faculty is required"],
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: [true, "Semester is required"],
    },
    section: {
      type: String,
      required: [true, "Section is required"],
      trim: true,
      uppercase: true,
      maxlength: [10, "Section name cannot exceed 10 characters"],
      validate: {
        validator: function (v) {
          // Common format for Indian college sections (A, B, C, or A1, B2, etc.)
          return /^[A-Z][0-9]?$/.test(v);
        },
        message: (props) => `${props.value} is not a valid section format!`,
      },
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: [true, "Batch is required"],
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      validate: {
        validator: function (v) {
          // Format: YYYY-YYYY (e.g., 2024-2025)
          return /^\d{4}-\d{4}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid academic year format. Use YYYY-YYYY format.`,
      },
    },
    timeSlots: [
      {
        day: {
          type: String,
          enum: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ],
          required: true,
        },
        startTime: {
          type: String,
          required: true,
          validate: {
            validator: function (v) {
              return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
            },
            message: (props) =>
              `${props.value} is not a valid time format. Use HH:MM (24-hour format).`,
          },
        },
        endTime: {
          type: String,
          required: true,
          validate: {
            validator: function (v) {
              return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
            },
            message: (props) =>
              `${props.value} is not a valid time format. Use HH:MM (24-hour format).`,
          },
        },
        room: {
          type: String,
          required: true,
          trim: true,
        },
        type: {
          type: String,
          enum: ["Lecture", "Tutorial", "Practical", "Workshop"],
          default: "Lecture",
        },
      },
    ],
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
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

// Unique constraint on (course, faculty, semester, section, batch)
courseAllocationSchema.index(
  {
    course: 1,
    faculty: 1,
    semester: 1,
    section: 1,
    batch: 1,
  },
  { unique: true },
);

// Indexes for efficient queries
courseAllocationSchema.index({ course: 1 });
courseAllocationSchema.index({ faculty: 1 });
courseAllocationSchema.index({ semester: 1 });
courseAllocationSchema.index({ batch: 1 });
courseAllocationSchema.index({ status: 1 });

// Static Method to Find Course Allocations by Faculty
courseAllocationSchema.statics.findByFaculty = function (facultyId) {
  return this.find({ faculty: facultyId, status: "active" })
    .populate("course", "name code")
    .populate("semester", "academicYear term")
    .populate("batch", "name");
};

// Static Method to Find Course Allocations by Course
courseAllocationSchema.statics.findByCourse = function (courseId) {
  return this.find({ course: courseId, status: "active" })
    .populate("faculty", "name employeeId")
    .populate("semester", "academicYear term")
    .populate("batch", "name");
};

// Static Method to Find Course Allocations by Batch
courseAllocationSchema.statics.findByBatch = function (batchId) {
  return this.find({ batch: batchId, status: "active" })
    .populate("course", "name code")
    .populate("faculty", "name employeeId")
    .populate("semester", "academicYear term");
};

// Method to check for time slot conflicts
courseAllocationSchema.methods.hasTimeConflict = async function (newTimeSlot) {
  const { faculty, batch, section } = this;

  // Check faculty conflicts
  const facultyAllocations = await this.constructor.find({
    faculty,
    status: "active",
    _id: { $ne: this._id },
  });

  // Check batch conflicts
  const batchAllocations = await this.constructor.find({
    batch,
    section,
    status: "active",
    _id: { $ne: this._id },
  });

  const allAllocations = [...facultyAllocations, ...batchAllocations];

  for (const allocation of allAllocations) {
    for (const timeSlot of allocation.timeSlots) {
      if (timeSlot.day === newTimeSlot.day) {
        const existingStart = convertTimeToMinutes(timeSlot.startTime);
        const existingEnd = convertTimeToMinutes(timeSlot.endTime);
        const newStart = convertTimeToMinutes(newTimeSlot.startTime);
        const newEnd = convertTimeToMinutes(newTimeSlot.endTime);

        // Check for overlap
        if (
          (newStart >= existingStart && newStart < existingEnd) ||
          (newEnd > existingStart && newEnd <= existingEnd) ||
          (newStart <= existingStart && newEnd >= existingEnd)
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

// Helper function for time conflict check
function convertTimeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

// Pre-save Hook to Ensure Unique Allocation and Valid Time Slots
courseAllocationSchema.pre("save", async function (next) {
  // Check if the document is new
  if (this.isNew) {
    const existingAllocation = await this.constructor.findOne({
      course: this.course,
      faculty: this.faculty,
      semester: this.semester,
      section: this.section,
      batch: this.batch,
    });

    if (existingAllocation) {
      return next(new Error("This course allocation already exists!"));
    }
  }

  // Validate time slots
  if (this.timeSlots && this.timeSlots.length > 0) {
    for (const slot of this.timeSlots) {
      if (
        convertTimeToMinutes(slot.endTime) <=
        convertTimeToMinutes(slot.startTime)
      ) {
        return next(new Error("End time must be after start time"));
      }

      // Check for time conflicts
      if (await this.hasTimeConflict(slot)) {
        return next(
          new Error(
            `Time conflict detected for ${slot.day} ${slot.startTime}-${slot.endTime}`,
          ),
        );
      }
    }
  }

  next();
});

const CourseAllocation = mongoose.model(
  "CourseAllocation",
  courseAllocationSchema,
);

export default CourseAllocation;
