import mongoose from "mongoose";

const gradeScaleSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => crypto.randomUUID(),
      unique: true,
      immutable: true,
    },
    gradeLetter: {
      type: String,
      required: true,
      enum: ["O", "A+", "A", "B+", "B", "C", "D", "F"],
      uppercase: true,
    },
    gradePoint: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    minPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    maxPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    description: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// VTU Standard Grade Scale
gradeScaleSchema.statics.getVTUGradeScale = function () {
  return [
    {
      gradeLetter: "O",
      gradePoint: 10,
      minPercentage: 90,
      maxPercentage: 100,
      description: "Outstanding",
    },
    {
      gradeLetter: "A+",
      gradePoint: 9,
      minPercentage: 80,
      maxPercentage: 89,
      description: "Excellent",
    },
    {
      gradeLetter: "A",
      gradePoint: 8,
      minPercentage: 70,
      maxPercentage: 79,
      description: "Very Good",
    },
    {
      gradeLetter: "B+",
      gradePoint: 7,
      minPercentage: 60,
      maxPercentage: 69,
      description: "Good",
    },
    {
      gradeLetter: "B",
      gradePoint: 6,
      minPercentage: 55,
      maxPercentage: 59,
      description: "Above Average",
    },
    {
      gradeLetter: "C",
      gradePoint: 5,
      minPercentage: 50,
      maxPercentage: 54,
      description: "Average",
    },
    {
      gradeLetter: "D",
      gradePoint: 4,
      minPercentage: 40,
      maxPercentage: 49,
      description: "Satisfactory",
    },
    {
      gradeLetter: "F",
      gradePoint: 0,
      minPercentage: 0,
      maxPercentage: 39,
      description: "Fail",
    },
  ];
};

// Calculate grade from percentage
gradeScaleSchema.statics.calculateGrade = function (percentage) {
  const grades = this.getVTUGradeScale();
  return (
    grades.find(
      (grade) =>
        percentage >= grade.minPercentage && percentage <= grade.maxPercentage,
    ) || { gradeLetter: "F", gradePoint: 0 }
  );
};

export const GradeScale = mongoose.model("GradeScale", gradeScaleSchema);

export default GradeScale;
