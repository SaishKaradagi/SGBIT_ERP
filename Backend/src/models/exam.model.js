import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const examSchema = new mongoose.Schema({
  uuid: {
    type: String,
    unique: true,
    default: uuidv4,
    immutable: true,
    index: true // Added index for frequent UUID lookups
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course ID is required'],
    index: true
  },
  semesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Semester',
    required: [true, 'Semester ID is required'],
    index: true
  },
  examTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamType',
    required: [true, 'Exam Type ID is required'],
    index: true
  },
  examName: {
    type: String,
    required: [true, 'Exam name is required'],
    trim: true,
    maxlength: [100, 'Exam name cannot exceed 100 characters']
  },
  examDate: {
    type: Date,
    required: [true, 'Exam date is required'],
    validate: {
      validator: function(date) {
        // Allow setting exams in the past for historical data entry
        if (this.isNew) {
          return date >= new Date(Date.now() - 24 * 60 * 60 * 1000); // Allow 1 day buffer for timezone issues
        }
        return true;
      },
      message: 'For new exams, exam date must not be in the past'
    }
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    validate: {
      validator: function(v) {
        // 24-hour format time validation (HH:MM)
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: 'Start time must be in 24-hour format (HH:MM)'
    }
  },
  duration: {
    type: Number, // Duration in minutes
    required: [true, 'Exam duration is required'],
    min: [15, 'Exam duration must be at least 15 minutes'],
    max: [480, 'Exam duration cannot exceed 8 hours (480 minutes)']
  },
  venue: {
    type: String,
    required: [true, 'Exam venue is required'],
    trim: true
  },
  totalMarks: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Total marks is required'],
    validate: {
      validator: (v) => parseFloat(v) > 0,
      message: 'Total marks must be greater than 0'
    }
  },
  passingMarks: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Passing marks is required'],
    validate: {
      validator: function(v) {
        return parseFloat(v) > 0 && parseFloat(v) <= parseFloat(this.totalMarks);
      },
      message: 'Passing marks must be greater than 0 and less than or equal to total marks'
    }
  },
  weightage: {
    type: mongoose.Schema.Types.Decimal128,
    required: [true, 'Weightage is required'],
    validate: {
      validator: (v) => parseFloat(v) >= 0 && parseFloat(v) <= 100,
      message: 'Weightage must be between 0 and 100'
    }
  },
  instructions: {
    type: String,
    trim: true,
    maxlength: [2000, 'Instructions cannot exceed 2000 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['scheduled', 'ongoing', 'completed', 'cancelled', 'postponed'],
      message: '{VALUE} is not a valid exam status'
    },
    default: 'scheduled'
  },
  isResultPublished: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator information is required']
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  gradeScaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GradeScale'
  }
}, { 
  timestamps: true,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// Virtual for exam end time
examSchema.virtual('endTime').get(function() {
  if (!this.startTime || !this.duration) return null;
  
  const [hours, minutes] = this.startTime.split(':').map(Number);
  const startTimeMinutes = hours * 60 + minutes;
  const endTimeMinutes = startTimeMinutes + this.duration;
  
  const endHours = Math.floor(endTimeMinutes / 60) % 24;
  const endMinutes = endTimeMinutes % 60;
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
});

// Virtual for exam status display
examSchema.virtual('displayStatus').get(function() {
  const now = new Date();
  const examDate = new Date(this.examDate);
  
  // Set the exam start and end time based on the date and time strings
  const [startHours, startMinutes] = this.startTime.split(':').map(Number);
  const examStartTime = new Date(examDate);
  examStartTime.setHours(startHours, startMinutes, 0);
  
  const examEndTime = new Date(examStartTime);
  examEndTime.setMinutes(examStartTime.getMinutes() + this.duration);
  
  if (this.status === 'cancelled') return 'Cancelled';
  if (this.status === 'postponed') return 'Postponed';
  if (this.isResultPublished) return 'Results Published';
  if (now > examEndTime) return 'Completed';
  if (now >= examStartTime && now <= examEndTime) return 'Ongoing';
  return 'Scheduled';
});

// Compound index for getting exams by course and semester
examSchema.index({ courseId: 1, semesterId: 1 });

// Compound index for getting exams by date range
examSchema.index({ examDate: 1, startTime: 1 });

// Index for checking exam conflicts
examSchema.index({ venue: 1, examDate: 1 });

// Get upcoming exams
examSchema.statics.getUpcomingExams = function(limit = 10) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return this.find({ 
    examDate: { $gte: today },
    status: { $nin: ['cancelled', 'postponed'] }
  })
    .populate('courseId', 'code name')
    .populate('examTypeId', 'name')
    .populate('semesterId', 'name')
    .sort({ examDate: 1, startTime: 1 })
    .limit(limit);
};

// Get exams by course
examSchema.statics.getExamsByCourse = function(courseId) {
  return this.find({ courseId })
    .populate('semesterId', 'name')
    .populate('examTypeId', 'name')
    .sort({ examDate: -1, startTime: -1 });
};

// Get exams by semester
examSchema.statics.getExamsBySemester = function(semesterId) {
  return this.find({ semesterId })
    .populate('courseId', 'code name')
    .populate('examTypeId', 'name')
    .sort({ examDate: 1, startTime: 1 });
};

// Get exams by date range
examSchema.statics.getExamsByDateRange = function(startDate, endDate) {
  return this.find({
    examDate: { $gte: startDate, $lte: endDate }
  })
    .populate('courseId', 'code name')
    .populate('semesterId', 'name')
    .populate('examTypeId', 'name')
    .sort({ examDate: 1, startTime: 1 });
};

  // Check for venue conflicts
examSchema.statics.checkVenueConflicts = async function(venue, examDate, startTime, duration, excludeExamId = null) {
  const examStartTime = startTime;
  const [startHours, startMinutes] = examStartTime.split(':').map(Number);
  const examStartMinutes = startHours * 60 + startMinutes;
  const examEndMinutes = examStartMinutes + duration;
  
  const examsOnSameDay = await this.find({
    _id: { $ne: excludeExamId },
    venue: venue,
    examDate: examDate,
    status: { $nin: ['cancelled', 'postponed'] }
  });
  
  for (const exam of examsOnSameDay) {
    const [existingStartHours, existingStartMinutes] = exam.startTime.split(':').map(Number);
    const existingStartTotalMinutes = existingStartHours * 60 + existingStartMinutes;
    const existingEndMinutes = existingStartTotalMinutes + exam.duration;
    
    // Check for time overlap
    if (!(examEndMinutes <= existingStartTotalMinutes || examStartMinutes >= existingEndMinutes)) {
      return {
        hasConflict: true,
        conflictingExam: exam
      };
    }
  }
  
  return { hasConflict: false };
};

// Update exam details
examSchema.methods.updateExamDetails = function(updates, userId) {
  Object.keys(updates).forEach((key) => {
    if (key !== '_id' && key !== 'uuid' && key !== 'createdBy') {
      this[key] = updates[key];
    }
  });
  
  // Update the last modified by field
  this.lastModifiedBy = userId;
  
  return this.save();
};

// Calculate passing percentage
examSchema.methods.calculatePassingPercentage = function() {
  return (parseFloat(this.passingMarks) / parseFloat(this.totalMarks)) * 100;
};

// Notify students about exam - Integration point for notification system
examSchema.methods.notifyStudents = async function() {
  // This method would integrate with your notification system
  // Implementation depends on your notification strategy
  // Could send emails, SMS, or internal notifications
  return {
    success: true,
    message: `Notification sent for exam: ${this.examName}`
  };
};

// Pre-save hook: Ensure passing marks ≤ total marks
examSchema.pre('save', function(next) {
  if (parseFloat(this.passingMarks) > parseFloat(this.totalMarks)) {
    return next(new Error('Passing marks cannot exceed total marks'));
  }
  
  // Auto-update status based on current date and exam date
  const now = new Date();
  const examDate = new Date(this.examDate);
  examDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Only auto-update status if not manually set to cancelled or postponed
  if (this.status !== 'cancelled' && this.status !== 'postponed') {
    if (examDate < today) {
      this.status = 'completed';
    } else if (examDate.getTime() === today.getTime()) {
      // Check if exam is ongoing or completed based on time
      const [startHours, startMinutes] = this.startTime.split(':').map(Number);
      const examStartTime = new Date(examDate);
      examStartTime.setHours(startHours, startMinutes, 0);
      
      const examEndTime = new Date(examStartTime);
      examEndTime.setMinutes(examStartTime.getMinutes() + this.duration);
      
      if (now > examEndTime) {
        this.status = 'completed';
      } else if (now >= examStartTime) {
        this.status = 'ongoing';
      }
    }
  }
  
  next();
});

// Prevent deletion of exams with published results
examSchema.pre('remove', async function(next) {
  if (this.isResultPublished) {
    return next(new Error('Cannot delete an exam with published results'));
  }
  
  // Here you could also check if there are any related exam results
  // And prevent deletion if they exist
  
  next();
});

const Exam = mongoose.model('Exam', examSchema);
export default Exam;
