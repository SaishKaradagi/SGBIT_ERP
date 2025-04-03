const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const examResultSchema = new mongoose.Schema({
  uuid: {
    type: String,
    unique: true,
    default: uuidv4,
    immutable: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true
  },
  marksObtained: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    validate: {
      validator: (v) => parseFloat(v) >= 0,
      message: 'Marks obtained must be non-negative.'
    }
  },
  gradeScaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GradeScale',
    required: true
  },
  resultStatus: {
    type: String,
    enum: ['pass', 'fail', 'absent'],
    required: true
  }
}, { 
  timestamps: true 
});

// ✅ Unique Constraint to Prevent Duplicate Exam Results
examResultSchema.index({ studentId: 1, examId: 1 }, { unique: true });

// ✅ Auto-Calculate Result Status (Pass/Fail)
examResultSchema.methods.calculateResultStatus = async function () {
  const exam = await mongoose.model('Exam').findById(this.examId);
  if (!exam) throw new Error('Exam not found.');

  this.resultStatus = parseFloat(this.marksObtained) >= parseFloat(exam.passingMarks) ? 'pass' : 'fail';
  return this.save();
};

// ✅ Fetch All Results for a Student
examResultSchema.statics.getResultsByStudent = function (studentId) {
  return this.find({ studentId })
    .populate('examId', 'examDate totalMarks passingMarks')
    .populate('gradeScaleId', 'code gradeName gradePoints');
};

// ✅ Fetch All Results for an Exam
examResultSchema.statics.getResultsByExam = function (examId) {
  return this.find({ examId })
    .populate('studentId', 'name')
    .populate('gradeScaleId', 'code gradeName gradePoints');
};

// ✅ Update Grade Scale if Marks Change
examResultSchema.methods.updateGradeScale = async function () {
  const gradeScale = await mongoose.model('GradeScale').findOne({
    lowerLimit: { $lte: this.marksObtained },
    upperLimit: { $gte: this.marksObtained }
  });

  if (!gradeScale) throw new Error('No matching grade scale found.');
  this.gradeScaleId = gradeScale._id;
  return this.save();
};

const ExamResult = mongoose.model('ExamResult', examResultSchema);
module.exports = ExamResult;
