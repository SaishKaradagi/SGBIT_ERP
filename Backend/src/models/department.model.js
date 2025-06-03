import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const departmentSchema = new mongoose.Schema(
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
      required: [true, "Department code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [10, "Department code cannot be more than 10 characters"],
      match: [
        /^[A-Z0-9-]+$/,
        "Department code must contain only uppercase letters, numbers, and hyphens",
      ],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
      maxlength: [100, "Department name cannot be more than 100 characters"],
      index: true,
    },
    // Academic Information
    hod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      default: null,
      index: true,
    },
    faculty: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Faculty",
      },
    ],
    establishedYear: {
      type: Number,
      required: true,
      validate: {
        validator: function (year) {
          return (
            Number.isInteger(year) &&
            year > 1900 &&
            year <= new Date().getFullYear()
          );
        },
        message: (props) => `${props.value} is not a valid year!`,
      },
    },
    // Department Details
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot be more than 2000 characters"],
    },
    vision: {
      type: String,
      trim: true,
      maxlength: [1000, "Vision cannot be more than 1000 characters"],
    },
    mission: {
      type: String,
      trim: true,
      maxlength: [1000, "Mission cannot be more than 1000 characters"],
    },
    // Contact details - reference to User model that stores departmental contact
    contactUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Physical Location - reference to Address model
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Address",
      default: null,
    },
    // Additional location info specific to department
    building: {
      type: String,
      trim: true,
    },
    floor: {
      type: String,
      trim: true,
    },
    roomNumbers: [
      {
        type: String,
        trim: true,
      },
    ],
    // Affiliation and Recognition
    affiliatedTo: {
      type: String,
      trim: true,
      maxlength: [100, "Affiliation cannot be more than 100 characters"],
    },
    accreditations: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        grantedBy: {
          type: String,
          required: true,
          trim: true,
        },
        issuedDate: {
          type: Date,
          required: true,
        },
        validUntil: {
          type: Date,
          required: true,
          validate: {
            validator: function (v) {
              return v > this.issuedDate;
            },
            message: "Valid until date must be after issued date",
          },
        },
        grade: {
          type: String,
          trim: true,
        },
        documentUrl: {
          type: String,
          trim: true,
        },
      },
    ],
    
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    // Department Resources
    facilities: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        location: {
          type: String,
          trim: true,
        },
      },
    ],
    laboratories: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        capacity: {
          type: Number,
          min: [0, "Capacity cannot be negative"],
        },
        equipment: [
          {
            name: {
              type: String,
              required: true,
              trim: true,
            },
            count: {
              type: Number,
              default: 1,
              min: [0, "Equipment count cannot be negative"],
            },
            description: {
              type: String,
              trim: true,
            },
          },
        ],
      },
    ],
    // Administrative Information
    budget: {
      allocated: {
        type: Number,
        default: 0,
        min: [0, "Budget cannot be negative"],
      },
      utilized: {
        type: Number,
        default: 0,
        min: [0, "Utilized budget cannot be negative"],
        validate: {
          validator: function (v) {
            return v <= this.budget.allocated;
          },
          message: "Utilized budget cannot exceed allocated budget",
        },
      },
      fiscalYear: {
        type: String,
        default: () => {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth();
          // Indian fiscal year runs from April to March
          return month < 3 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
        },
      },
    },
    // Status and Meta Information
    status: {
      type: String,
      enum: {
        values: ["active", "inactive", "merged", "closed"],
        message: "{VALUE} is not a valid status",
      },
      default: "active",
      required: true,
      index: true,
    },
    statusReason: {
      type: String,
      trim: true,
      maxlength: [200, "Status reason cannot exceed 200 characters"],
    },
    mergedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Create indexes for commonly queried fields
departmentSchema.index({ code: 1 }, { unique: true });
departmentSchema.index({ name: 1 });
departmentSchema.index({ status: 1 });
departmentSchema.index({ hod: 1 });
departmentSchema.index({ establishedYear: 1 });

// Virtual to get the department age
departmentSchema.virtual("age").get(function () {
  return new Date().getFullYear() - this.establishedYear;
});

// Virtual to get faculty count
departmentSchema.virtual("facultyCount").get(function () {
  return this.faculty ? this.faculty.length : 0;
});

// Virtual to get budget balance
departmentSchema.virtual("budgetBalance").get(function () {
  if (!this.budget) return 0;
  return this.budget.allocated - this.budget.utilized;
});

// Virtual to get budget utilization percentage
departmentSchema.virtual("budgetUtilizationPercentage").get(function () {
  if (!this.budget || this.budget.allocated === 0) return 0;
  return Math.round((this.budget.utilized / this.budget.allocated) * 100);
});

// Virtual to get students in department (through programmes and batch)
departmentSchema.virtual("students", {
  ref: "Student",
  localField: "programmes",
  foreignField: "programme",
  count: true,
});

// Static method to find active departments
departmentSchema.statics.findActiveDepartments = function () {
  return this.find({ status: "active" }).sort({ name: 1 });
};


// Static method to get departments with HOD
departmentSchema.statics.findDepartmentsWithHOD = function () {
  return this.find({
    hod: { $ne: null },
    status: "active",
  }).populate({
    path: "hod",
    select: "user",
    populate: {
      path: "user",
      select: "firstName lastName email",
    },
  });
};

// Static method to get departments without HOD
departmentSchema.statics.findDepartmentsWithoutHOD = function () {
  return this.find({
    hod: null,
    status: "active",
  });
};

// Static method to get departments with budget utilization statistics
departmentSchema.statics.getBudgetUtilizationStats = async function (
  fiscalYear,
) {
  const currentFiscalYear = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Indian fiscal year runs from April to March
    return month < 3 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
  })();

  return this.aggregate([
    {
      $match: {
        status: "active",
        "budget.fiscalYear": fiscalYear || currentFiscalYear,
      },
    },
    {
      $project: {
        name: 1,
        code: 1,
        allocated: "$budget.allocated",
        utilized: "$budget.utilized",
        balance: { $subtract: ["$budget.allocated", "$budget.utilized"] },
        utilizationPercentage: {
          $cond: [
            { $eq: ["$budget.allocated", 0] },
            0,
            {
              $multiply: [
                { $divide: ["$budget.utilized", "$budget.allocated"] },
                100,
              ],
            },
          ],
        },
      },
    },
    { $sort: { name: 1 } },
  ]);
};

// Method to get contact details
departmentSchema.methods.getContactDetails = async function () {
  await this.populate("contactUser");
  return this.contactUser;
};

// Method to get address details
departmentSchema.methods.getAddressDetails = async function () {
  await this.populate("address");
  return this.address;
};

// Method to assign HOD
departmentSchema.methods.assignHOD = async function (facultyId) {
  if (this.hod && this.hod.toString() === facultyId.toString()) {
    throw new Error("Faculty is already HOD of this department");
  }

  const Faculty = mongoose.model("Faculty");
  const faculty = await Faculty.findById(facultyId);

  if (!faculty) {
    throw new Error("Faculty not found");
  }

  // Check if faculty belongs to this department
  if (faculty.department.toString() !== this._id.toString()) {
    throw new Error(
      "Faculty must belong to this department to be assigned as HOD",
    );
  }

  // Check if faculty is already HOD in another department
  const existingHOD = await mongoose.model("Department").findOne({
    hod: facultyId,
    _id: { $ne: this._id }, // Not this department
  });

  if (existingHOD) {
    throw new Error(`Faculty is already HOD of ${existingHOD.name} department`);
  }

  this.hod = facultyId;
  return this.save();
};

// Method to remove HOD
departmentSchema.methods.removeHOD = function () {
  this.hod = null;
  return this.save();
};

// Method to update budget
departmentSchema.methods.updateBudget = function (
  allocated,
  utilized,
  fiscalYear,
) {
  if (allocated !== undefined) {
    this.budget.allocated = allocated;
  }

  if (utilized !== undefined) {
    if (utilized > this.budget.allocated) {
      throw new Error("Utilized budget cannot exceed allocated budget");
    }
    this.budget.utilized = utilized;
  }

  if (fiscalYear) {
    this.budget.fiscalYear = fiscalYear;
  }

  return this.save();
};

// Method to add programme
departmentSchema.methods.addProgramme = function (programmeId) {
  if (!this.programmes.includes(programmeId)) {
    this.programmes.push(programmeId);
  }
  return this.save();
};

// Method to remove programme
departmentSchema.methods.removeProgramme = function (programmeId) {
  this.programmes = this.programmes.filter(
    (programme) => programme.toString() !== programmeId.toString(),
  );
  return this.save();
};

// Method to add course
departmentSchema.methods.addCourse = function (courseId) {
  if (!this.courses.includes(courseId)) {
    this.courses.push(courseId);
  }
  return this.save();
};

// Method to remove course
departmentSchema.methods.removeCourse = function (courseId) {
  this.courses = this.courses.filter(
    (course) => course.toString() !== courseId.toString(),
  );
  return this.save();
};

// Method to update status with reason
departmentSchema.methods.updateStatus = function (newStatus, reason = "") {
  if (!["active", "inactive", "merged", "closed"].includes(newStatus)) {
    throw new Error("Invalid status value");
  }

  this.status = newStatus;
  this.statusReason = reason;

  return this.save();
};

// Method to merge department
departmentSchema.methods.mergeWith = async function (
  targetDepartmentId,
  reason = "",
) {
  if (this._id.toString() === targetDepartmentId.toString()) {
    throw new Error("Cannot merge department with itself");
  }

  const targetDept = await mongoose
    .model("Department")
    .findById(targetDepartmentId);

  if (!targetDept) {
    throw new Error("Target department not found");
  }

  if (targetDept.status !== "active") {
    throw new Error("Cannot merge with an inactive department");
  }

  // Set this department as merged
  this.status = "merged";
  this.statusReason = reason || `Merged with ${targetDept.name} department`;
  this.mergedTo = targetDepartmentId;

  return this.save();
};

// Method to set contact information
departmentSchema.methods.setContactUser = async function (userId) {
  const User = mongoose.model("User");
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  this.contactUser = userId;
  return this.save();
};

// Method to set address
departmentSchema.methods.setAddress = async function (addressId) {
  const Address = mongoose.model("Address");
  const address = await Address.findById(addressId);

  if (!address) {
    throw new Error("Address not found");
  }

  this.address = addressId;
  return this.save();
};

// Pre middleware to ensure HOD is a faculty member from the same department
departmentSchema.pre("save", async function (next) {
  if (this.isModified("hod") && this.hod) {
    const Faculty = mongoose.model("Faculty");
    try {
      const faculty = await Faculty.findById(this.hod);

      if (!faculty) {
        return next(new Error("Assigned HOD does not exist in Faculty"));
      }

      if (faculty.department.toString() !== this._id.toString()) {
        return next(new Error("HOD must belong to this department"));
      }
    } catch (error) {
      return next(error);
    }
  }

  next();
});

// Middleware to handle "ON DELETE SET NULL" for HOD
departmentSchema.pre("save", async function (next) {
  if (this.isModified("hod") && !this.hod) {
    this.hod = null;
  }

  next();
});

// Auto-update faculty array when a new faculty is added to the department
departmentSchema.pre("save", function (next) {
  // Logic to update faculty array will be handled in Faculty model
  next();
});

// Define the model and export
const Department = mongoose.model("Department", departmentSchema);

// Faculty change stream to handle references
// Note: This should ideally be in a separate file that runs after all models are loaded
const setupFacultyChanges = async () => {
  try {
    const Faculty = mongoose.model("Faculty");

    const changeStream = Faculty.watch();

    changeStream.on("change", async (change) => {
      if (change.operationType === "delete") {
        // Handle faculty deletion - set HOD to null if matching
        await Department.updateMany(
          { hod: change.documentKey._id },
          { $set: { hod: null } },
        );

        // Remove from faculty array
        await Department.updateMany(
          { faculty: change.documentKey._id },
          { $pull: { faculty: change.documentKey._id } },
        );
      } else if (
        change.operationType === "update" &&
        change.updateDescription.updatedFields.department
      ) {
        // Handle faculty department change
        const oldDeptId = change.updateDescription.updatedFields.department.old;
        const newDeptId = change.updateDescription.updatedFields.department.new;

        if (oldDeptId) {
          // Remove from old department's faculty array
          await Department.updateOne(
            { _id: oldDeptId },
            { $pull: { faculty: change.documentKey._id } },
          );
        }

        if (newDeptId) {
          // Add to new department's faculty array
          await Department.updateOne(
            { _id: newDeptId },
            { $addToSet: { faculty: change.documentKey._id } },
          );
        }
      }
    });
  } catch (error) {
    console.error("Error setting up Faculty change stream:", error);
  }
};

// Run the setup function if we're in a production environment
// This is to prevent multiple change streams in development with nodemon restarts
if (process.env.NODE_ENV === "production") {
  setupFacultyChanges().catch(console.error);
}

export default Department;
