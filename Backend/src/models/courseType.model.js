// import mongoose from "mongoose";

// const courseTypeSchema = new mongoose.Schema(
//   {
//     code: {
//       type: String,
//       required: [true, "Course type code is required"],
//       unique: true,
//       trim: true,
//       uppercase: true,
//       maxlength: [10, "Course type code cannot be more than ten characters"],
//     },
//     name: {
//       type: String,
//       required: [true, "Course type name is required"],
//       trim: true,
//       maxlength: [100, "Course type name cannot be more than 100 characters"],
//     },
//     description: {
//       type: String,
//       trim: true,
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// // Create index for commonly queried field
// courseTypeSchema.index({ code: 1 });

// // Static method to initialize default course types if they don't exist
// courseTypeSchema.statics.initializeDefaults = async function () {
//   const defaultTypes = [
//     { code: "PCC", name: "Professional Core Course" },
//     { code: "PEC", name: "Professional Elective Course" },
//     { code: "OEC", name: "Open Elective Course" },
//     { code: "PRJ", name: "Project" },
//     { code: "NCMC", name: "Non-Credit Mandatory Course" },
//     { code: "BSC", name: "Basic Science Course" },
//     { code: "AEC", name: "Ability Enhancement Course" },
//   ];

//   for (const type of defaultTypes) {
//     await this.findOneAndUpdate(
//       { code: type.code },
//       { $setOnInsert: type },
//       { upsert: true, new: true },
//     );
//   }
//   console.log("Default course types initialized");
// };

// const CourseType = mongoose.model("CourseType", courseTypeSchema);

// module.exports = CourseType;
