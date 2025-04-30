import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const examResultSchema = new mongoose.Schema({
  uuid: {
    type: String,
    unique: true,
    default: uuidv4,
    immutable: true,
    index: true // Added indexing for direct UUID lookups
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required'],
    index: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: [true, 'Exam ID is required'],
    index: true
  },
  marksObtained: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Marks obtained is required'],
    validate: {
      validator: function(v) {
        // Marks must be non-negative
        if (parseFloat(v) < 0) return false;
        
        // Check if marks obtained don't exceed total marks (if exam is available)
        // This will be verified in the pre-save hook more thoroughly
        return true;
      },
      message: props => `Marks obtained must be non-negative and cannot exceed total marks`
    }
  },
  outOfMarks: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Total marks is required'],
    validate: {
      validator: (v) => parseFloat(v) > 0,
      message: 'Total marks must be greater than 0'
    }
  },
  percentage: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    default: 0
  },
  gradeScaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GradeScale',
    required: [true, 'Grade scale ID is required']
  },
  resultStatus: {
    type: String,
    enum: {
      values: ['pass', 'fail', 'absent', 'malpractice', 'withheld', 'incomplete'],
      message: '{VALUE} is not a valid result status'
    },
    required: [true, 'Result status is required']
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: [500, 'Remarks cannot exceed 500 characters']
  },
  evaluatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: [true, 'Evaluator information is required']
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  gradeLetter: {
    type: String,
    trim: true
  },
  gradePoints: {
    type: Number
  },
  revaluationRequested: {
    type: Boolean,
    default: false
  },
  revaluationStatus: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'completed', 'not-applicable'],
      message: '{VALUE} is not a valid revaluation status'
    },
    default: 'not-applicable'
  },
  previousMarks: {
    type: mongoose.Schema.Types.Decimal128,
    default: null
  },
  marksChangeReason: {
    type: String,
    trim: true,
    maxlength: [200, 'Marks change reason cannot exceed 200 characters']
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// Virtual field for performance indicator
examResultSchema.virtual('performanceIndicator').get(function() {
  const percentage = parseFloat(this.percentage);
  
  if (percentage >= 90) return 'excellent';
  if (percentage >= 75) return 'veryGood';
  if (percentage >= 60) return 'good';
  if (percentage >= 50) return 'average';
  if (percentage >= parseFloat(this.passingPercentage)) return 'satisfactory';
  return 'needsImprovement';
});

// Virtual field for passing percentage (calculated from exam model)
examResultSchema.virtual('passingPercentage').get(function() {
  // This will be populated during queries that compute this value
  return this._passingPercentage || 40; // Default fallback
});

// Unique constraint to prevent duplicate exam results
examResultSchema.index({ studentId: 1, examId: 1 }, { unique: true });

// Index for fast lookups of results by evaluation status
examResultSchema.index({ isVerified: 1 });

// Index for publication status queries
examResultSchema.index({ isPublished: 1 });

// Index for revaluation status queries
examResultSchema.index({ revaluationRequested: 1, revaluationStatus: 1 });

// Auto-calculate result status (pass/fail)
examResultSchema.methods.calculateResultStatus = async function() {
  const exam = await mongoose.model('Exam').findById(this.examId);
  if (!exam) throw new Error('Exam not found');

  // Store the passing percentage for the virtual field
  this._passingPercentage = (parseFloat(exam.passingMarks) / parseFloat(exam.totalMarks)) * 100;

  // Update outOfMarks to match exam's total marks
  this.outOfMarks = exam.totalMarks;
  
  // Calculate percentage
  this.percentage = (parseFloat(this.marksObtained) / parseFloat(this.outOfMarks)) * 100;
  
  // Set result status
  if (parseFloat(this.marksObtained) >= parseFloat(exam.passingMarks)) {
    this.resultStatus = 'pass';
  } else {
    this.resultStatus = 'fail';
  }
  
  return this.save();
};

// Update grade scale based on marks
examResultSchema.methods.updateGradeScale = async function() {
  const percentage = parseFloat(this.percentage);
  
  const gradeScale = await mongoose.model('GradeScale').findOne({
    lowerLimit: { $lte: percentage },
    upperLimit: { $gte: percentage }
  }).sort({ upperLimit: -1 });  // Sort to get the highest matching grade if multiple ranges match

  if (!gradeScale) throw new Error('No matching grade scale found for the calculated percentage');
  
  this.gradeScaleId = gradeScale._id;
  this.gradeLetter = gradeScale.gradeName;
  this.gradePoints = gradeScale.gradePoints;
  
  return this.save();
};

// Complete result processing - calculates status, grade, etc.
examResultSchema.methods.processResult = async function() {
  await this.calculateResultStatus();
  await this.updateGradeScale();
  return this;
};

// Request revaluation
examResultSchema.methods.requestRevaluation = function(reason) {
  if (this.revaluationRequested) {
    throw new Error('Revaluation already requested for this result');
  }
  
  if (this.resultStatus === 'absent' || this.resultStatus === 'malpractice') {
    throw new Error(`Cannot request revaluation for result with status: ${this.resultStatus}`);
  }
  
  // Store current marks as previous marks
  this.previousMarks = this.marksObtained;
  this.revaluationRequested = true;
  this.revaluationStatus = 'pending';
  this.marksChangeReason = reason || 'Revaluation requested';
  
  return this.save();
};

// Complete revaluation process
examResultSchema.methods.completeRevaluation = async function(newMarks, remarks, evaluatedBy) {
  if (!this.revaluationRequested || this.revaluationStatus !== 'approved') {
    throw new Error('Cannot complete revaluation - either not requested or not approved');
  }
  
  // Store new marks and update status
  this.marksObtained = newMarks;
  this.remarks = remarks || this.remarks;
  this.evaluatedBy = evaluatedBy || this.evaluatedBy;
  this.revaluationStatus = 'completed';
  
  // Re-process the result with new marks
  await this.processResult();
  
  return this;
};

// Verify result
examResultSchema.methods.verifyResult = function(facultyId) {
  if (this.isVerified) {
    throw new Error('Result already verified');
  }
  
  this.isVerified = true;
  this.verifiedBy = facultyId;
  
  return this.save();
};

// Publish result
examResultSchema.methods.publishResult = function(userId) {
  if (this.isPublished) {
    throw new Error('Result already published');
  }
  
  // Ensure result is verified before publishing
  if (!this.isVerified) {
    throw new Error('Result must be verified before publishing');
  }
  
  this.isPublished = true;
  this.publishedAt = new Date();
  this.publishedBy = userId;
  
  return this.save();
};

// Fetch all results for a student
examResultSchema.statics.getResultsByStudent = async function(studentId, options = {}) {
  const query = this.find({ studentId });
  
  // Apply optional filters
  if (options.published !== undefined) {
    query.where('isPublished').equals(options.published);
  }
  
  if (options.semesterId) {
    // Join with Exam to filter by semester
    query.populate({
      path: 'examId',
      match: { semesterId: options.semesterId },
    });
  }
  
  return query
    .populate({
      path: 'examId',
      select: 'examDate totalMarks passingMarks examName courseId examTypeId',
      populate: [
        { path: 'courseId', select: 'code name credits' },
        { path: 'examTypeId', select: 'name weightage' }
      ]
    })
    .populate('gradeScaleId', 'code gradeName gradePoints')
    .sort({ 'examId.examDate': -1 });
};

// Fetch all results for an exam
examResultSchema.statics.getResultsByExam = function(examId, options = {}) {
  const query = this.find({ examId });
  
  // Apply optional filters
  if (options.published !== undefined) {
    query.where('isPublished').equals(options.published);
  }
  
  if (options.resultStatus) {
    query.where('resultStatus').equals(options.resultStatus);
  }
  
  if (options.batchId) {
    // Join with Student to filter by batch
    query.populate({
      path: 'studentId',
      match: { batchId: options.batchId },
    });
  }
  
  return query
    .populate('studentId', 'name rollNo registrationNo')
    .populate('gradeScaleId', 'code gradeName gradePoints')
    .sort({ 'studentId.rollNo': 1 });
};

// Get exam statistics
examResultSchema.statics.getExamStatistics = async function(examId) {
  const results = await this.find({ examId });
  
  if (!results.length) {
    return {
      totalStudents: 0,
      appeared: 0,
      passed: 0,
      failed: 0,
      absent: 0,
      malpractice: 0,
      witheld: 0,
      passPercentage: 0,
      highestMarks: 0,
      lowestMarks: 0,
      averageMarks: 0
    };
  }
  
  const stats = {
    totalStudents: results.length,
    appeared: results.filter(r => r.resultStatus !== 'absent').length,
    passed: results.filter(r => r.resultStatus === 'pass').length,
    failed: results.filter(r => r.resultStatus === 'fail').length,
    absent: results.filter(r => r.resultStatus === 'absent').length,
    malpractice: results.filter(r => r.resultStatus === 'malpractice').length,
    withheld: results.filter(r => r.resultStatus === 'withheld').length,
    incomplete: results.filter(r => r.resultStatus === 'incomplete').length
  };
  
  // Calculate pass percentage
  stats.passPercentage = stats.appeared > 0 ? (stats.passed / stats.appeared) * 100 : 0;
  
  // Calculate marks statistics for students who appeared
  const appearedStudents = results.filter(r => r.resultStatus !== 'absent');
  if (appearedStudents.length) {
    const marks = appearedStudents.map(r => parseFloat(r.marksObtained));
    stats.highestMarks = Math.max(...marks);
    stats.lowestMarks = Math.min(...marks);
    stats.averageMarks = marks.reduce((a, b) => a + b, 0) / marks.length;
  } else {
    stats.highestMarks = 0;
    stats.lowestMarks = 0;
    stats.averageMarks = 0;
  }
  
  // Generate grade distribution
  stats.gradeDistribution = {};
  for (const result of results) {
    if (result.gradeLetter) {
      stats.gradeDistribution[result.gradeLetter] = (stats.gradeDistribution[result.gradeLetter] || 0) + 1;
    }
  }
  
  return stats;
};

// Get semester-wise performance
examResultSchema.statics.getSemesterPerformance = async function(studentId, semesterId) {
  // Get all exams for the semester
  const exams = await mongoose.model('Exam').find({ semesterId });
  const examIds = exams.map(exam => exam._id);
  
  // Get all results for these exams
  const results = await this.find({
    studentId,
    examId: { $in: examIds },
    isPublished: true
  }).populate({
    path: 'examId',
    select: 'courseId examTypeId weightage totalMarks',
    populate: [
      { path: 'courseId', select: 'code name credits' },
      { path: 'examTypeId', select: 'name weightage' }
    ]
  });
  
  // Group results by course
  const courseResults = {};
  results.forEach(result => {
    const courseId = result.examId.courseId._id.toString();
    if (!courseResults[courseId]) {
      courseResults[courseId] = {
        course: result.examId.courseId,
        examResults: []
      };
    }
    courseResults[courseId].examResults.push(result);
  });
  
  // Calculate final grades for each course
  const finalGrades = [];
  for (const courseId in courseResults) {
    const data = courseResults[courseId];
    let weightedTotal = 0;
    let totalWeightage = 0;
    
    data.examResults.forEach(result => {
      const examWeight = parseFloat(result.examId.examTypeId.weightage);
      weightedTotal += (parseFloat(result.percentage) * examWeight);
      totalWeightage += examWeight;
    });
    
    const finalPercentage = totalWeightage > 0 ? weightedTotal / totalWeightage : 0;
    
    // Get corresponding grade for this percentage
    const gradeScale = await mongoose.model('GradeScale').findOne({
      lowerLimit: { $lte: finalPercentage },
      upperLimit: { $gte: finalPercentage }
    });
    
    finalGrades.push({
      course: data.course,
      percentage: finalPercentage,
      grade: gradeScale ? gradeScale.gradeName : null,
      gradePoints: gradeScale ? gradeScale.gradePoints : null,
      credits: data.course.credits,
      weightedGradePoints: gradeScale ? gradeScale.gradePoints * data.course.credits : 0
    });
  }
  
  // Calculate SGPA
  const totalCredits = finalGrades.reduce((sum, g) => sum + g.credits, 0);
  const totalWeightedGradePoints = finalGrades.reduce((sum, g) => sum + g.weightedGradePoints, 0);
  const sgpa = totalCredits > 0 ? totalWeightedGradePoints / totalCredits : 0;
  
  return {
    student: studentId,
    semester: semesterId,
    courseGrades: finalGrades,
    totalCredits,
    sgpa: parseFloat(sgpa.toFixed(2)),
    passedAll: finalGrades.every(g => g.gradePoints > 0)
  };
};

// Pre-save hook to validate and compute values
examResultSchema.pre('save', async function(next) {
  try {
    // Skip extensive validation for absent students
    if (this.resultStatus === 'absent') {
      next();
      return;
    }
    
    // Calculate percentage if marks and outOfMarks are available
    if (this.isModified('marksObtained') || this.isModified('outOfMarks')) {
      const marks = parseFloat(this.marksObtained);
      const total = parseFloat(this.outOfMarks);
      
      if (total > 0) {
        this.percentage = (marks / total) * 100;
      }
      
      // Validate marks against exam total
      if (this.isNew || this.isModified('marksObtained')) {
        const exam = await mongoose.model('Exam').findById(this.examId);
        if (exam && marks > parseFloat(exam.totalMarks)) {
          return next(new Error(`Marks obtained (${marks}) cannot exceed total marks (${parseFloat(exam.totalMarks)})`));
        }
      }
    }
    
    // Set publishedAt date when publishing results
    if (this.isModified('isPublished') && this.isPublished && !this.publishedAt) {
      this.publishedAt = new Date();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Ensure result can't be unpublished once published
examResultSchema.pre('save', function(next) {
  if (this.isModified('isPublished') && !this.isPublished && this.$__.previousValue('isPublished') === true) {
    return next(new Error('Cannot unpublish a result once it has been published'));
  }
  next();
});

// Handle deleted students by checking references before save
examResultSchema.pre('save', async function(next) {
  try {
    const student = await mongoose.model('Student').findById(this.studentId);
    if (!student) {
      return next(new Error('Referenced student not found or has been deleted'));
    }
    
    const exam = await mongoose.model('Exam').findById(this.examId);
    if (!exam) {
      return next(new Error('Referenced exam not found or has been deleted'));
    }
    
    const gradeScale = await mongoose.model('GradeScale').findById(this.gradeScaleId);
    if (!gradeScale) {
      return next(new Error('Referenced grade scale not found or has been deleted'));
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

const ExamResult = mongoose.model('ExamResult', examResultSchema);
export default ExamResult;