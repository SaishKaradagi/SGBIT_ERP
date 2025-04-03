const mongoose = require('mongoose');

const examTypeSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: true,
    uppercase: true, // Ensures consistency (e.g., 'CIE1' instead of 'cie1')
    trim: true
  },
  name: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  }
}, { 
  timestamps: true
});

// ✅ Auto-Seeding Method
examTypeSchema.statics.seedExamTypes = async function () {
  const examTypes = [
    { code: 'CIE1', name: 'Continuous Internal Evaluation 1' },
    { code: 'CIE2', name: 'Continuous Internal Evaluation 2' },
    { code: 'CIE3', name: 'Continuous Internal Evaluation 3' },
    { code: 'LAB1', name: 'Laboratory Assessment 1' },
    { code: 'LAB2', name: 'Laboratory Assessment 2' },
    { code: 'AAT1', name: 'Alternative Assessment Test 1' },
    { code: 'AAT2', name: 'Alternative Assessment Test 2' },
    { code: 'SEE', name: 'Semester End Examination' }
  ];

  for (const examType of examTypes) {
    await this.updateOne({ code: examType.code }, examType, { upsert: true });
  }
};

// ✅ Find Exam Type by Code
examTypeSchema.statics.findByCode = async function (code) {
  return this.findOne({ code: code.toUpperCase() }).exec();
};

// ✅ List All Exam Types
examTypeSchema.statics.listAllExamTypes = function () {
  return this.find().sort({ name: 1 }).exec();
};

// ✅ Check if an Exam Type Exists
examTypeSchema.statics.exists = async function (code) {
  return (await this.countDocuments({ code: code.toUpperCase() })) > 0;
};

const ExamType = mongoose.model('ExamType', examTypeSchema);
module.exports = ExamType;
