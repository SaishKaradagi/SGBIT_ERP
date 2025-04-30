import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

/**
 * Notice Schema - For college announcements, circulars and important information
 * Customized for Indian educational institutions with department and audience filtering
 */
const noticeSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true,
    index: true // Add index for improved lookup performance
  },
  title: {
    type: String,
    required: [true, 'Notice title is required'],
    trim: true,
    maxlength: [255, 'Title cannot be more than 255 characters'],
    index: 'text' // Enable text search on titles
  },
  content: {
    type: String,
    required: [true, 'Notice content is required'],
    trim: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  department: {
    type: Schema.Types.ObjectId,
    ref: 'Department',
    default: null, // null means all departments
    index: true // For faster department-specific queries
  },
  noticeType: {
    type: String,
    enum: [
      'GENERAL',          // General notices
      'ACADEMIC',         // Academic related notices
      'EXAMINATION',      // Exam schedules, results etc.
      'EVENT',            // College events
      'ADMISSION',        // Admission related
      'PLACEMENT',        // Training and placement notices
      'SCHOLARSHIP',      // Scholarship information
      'HOLIDAY',          // Holiday announcements
      'ADMINISTRATIVE',   // Administrative notices
      'URGENT'            // Important and urgent notices
    ],
    default: 'GENERAL',
    index: true
  },
  isImportant: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
    default: 'PUBLISHED',
    index: true
  },
  attachments: [{
    name: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number, // Size in bytes
      required: true
    },
    mimeType: {
      type: String
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  publishDate: {
    type: Date,
    default: Date.now,
    required: true,
    index: true // For efficient date-based filtering
  },
  expiryDate: {
    type: Date,
    validate: {
      validator: function(v) {
        // Expiry date must be greater than publish date
        return !v || v > this.publishDate;
      },
      message: 'Expiry date must be after publish date'
    },
    index: true // For efficient expiry-based filtering
  },
  targetAudience: [{
    type: String,
    enum: [
      'ALL',             // All users
      'STUDENTS',        // All students
      'FACULTY',         // All faculty members
      'ADMIN',           // Administrative staff
      'FIRST_YEAR',      // First year students
      'SECOND_YEAR',     // Second year students
      'THIRD_YEAR',      // Third year students
      'FOURTH_YEAR',     // Final year students
      'ALUMNI',          // College alumni
      'PARENTS'          // Student parents
    ],
    default: ['ALL']
  }],
  semester: [{
    type: Schema.Types.ObjectId,
    ref: 'Semester'  // Target specific semesters
  }],
  batch: [{
    type: Schema.Types.ObjectId,
    ref: 'Batch'     // Target specific batches
  }],
  programme: [{
    type: Schema.Types.ObjectId,
    ref: 'Programme'  // Target specific programmes
  }],
  readBy: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  acknowledgementRequired: {
    type: Boolean,
    default: false
  },
  acknowledgedBy: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    acknowledgedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  postedFor: {
    type: String,
    enum: ['COLLEGE', 'UNIVERSITY', 'GOVERNMENT'],
    default: 'COLLEGE'
  },
  referenceNumber: {  // For official notices, circulars etc.
    type: String,
    trim: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create compound indexes for common query patterns
noticeSchema.index({ noticeType: 1, status: 1, publishDate: -1 });
noticeSchema.index({ status: 1, department: 1, publishDate: -1 });
noticeSchema.index({ status: 1, targetAudience: 1, publishDate: -1 });
noticeSchema.index({ isImportant: 1, status: 1, publishDate: -1 });

// Text index for full text search capabilities
noticeSchema.index({ 
  title: 'text', 
  content: 'text', 
  tags: 'text', 
  referenceNumber: 'text' 
}, {
  weights: {
    title: 5,
    content: 3,
    tags: 2,
    referenceNumber: 4
  },
  name: 'notice_text_index'
});

// Virtual for formatted creation date in Indian format (DD-MM-YYYY)
noticeSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for short title
noticeSchema.virtual('shortTitle').get(function() {
  return this.title.length > 50 ? `${this.title.substring(0, 50)}...` : this.title;
});

// Virtual for age of notice
noticeSchema.virtual('age').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (days < 30) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else {
    const months = Math.floor(days / 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }
});

// Virtuals for audience counts
noticeSchema.virtual('readCount').get(function() {
  return this.readBy ? this.readBy.length : 0;
});

noticeSchema.virtual('acknowledgeCount').get(function() {
  return this.acknowledgedBy ? this.acknowledgedBy.length : 0;
});

// Virtual to check if notice is expired
noticeSchema.virtual('isExpired').get(function() {
  if (!this.expiryDate) return false;
  return new Date() > this.expiryDate;
});

// Instance Methods
noticeSchema.methods = {
  // Get a snippet of content with configurable length
  getContentSnippet: function(length = 100) {
    if (!this.content || this.content.length <= length) return this.content || '';
    return this.content.substring(0, length) + '...';
  },

  // Mark notice as read by a user
  markAsRead: async function(userId) {
    if (!this.readBy.some(item => item.user.toString() === userId.toString())) {
      this.readBy.push({
        user: userId,
        readAt: new Date()
      });
      await this.save();
    }
    return this;
  },

  // Acknowledge notice by a user
  acknowledgeNotice: async function(userId) {
    if (this.acknowledgementRequired && 
        !this.acknowledgedBy.some(item => item.user.toString() === userId.toString())) {
      this.acknowledgedBy.push({
        user: userId,
        acknowledgedAt: new Date()
      });
      await this.save();
    }
    return this;
  },

  // Check if notice is accessible to a specific user
  isAccessibleTo: function(user) {
    // If notice is not published, only author can access
    if (this.status !== 'PUBLISHED') {
      return user._id.toString() === this.author.toString();
    }

    // If expired, nobody can access
    if (this.expiryDate && new Date() > this.expiryDate) {
      return false;
    }

    // Check department restriction
    if (this.department && user.department && 
        this.department.toString() !== user.department.toString()) {
      return false;
    }

    // Check user type against targetAudience
    if (this.targetAudience.includes('ALL')) {
      return true;
    }

    // Check specific audience types
    if (user.role === 'STUDENT' && this.targetAudience.includes('STUDENTS')) {
      // Check year-specific restrictions for students
      if (user.year) {
        const yearMap = {
          1: 'FIRST_YEAR',
          2: 'SECOND_YEAR',
          3: 'THIRD_YEAR',
          4: 'FOURTH_YEAR'
        };
        
        if (this.targetAudience.includes(yearMap[user.year])) {
          return true;
        }
      } else {
        return true;
      }
    }

    if (user.role === 'FACULTY' && this.targetAudience.includes('FACULTY')) {
      return true;
    }

    if (user.role === 'ADMIN' && this.targetAudience.includes('ADMIN')) {
      return true;
    }

    if (user.isAlumni && this.targetAudience.includes('ALUMNI')) {
      return true;
    }

    if (user.isParent && this.targetAudience.includes('PARENTS')) {
      return true;
    }

    // Check programme, batch and semester
    if (user.programme && this.programme.length > 0) {
      if (!this.programme.some(p => p.toString() === user.programme.toString())) {
        return false;
      }
    }

    if (user.batch && this.batch.length > 0) {
      if (!this.batch.some(b => b.toString() === user.batch.toString())) {
        return false;
      }
    }

    if (user.semester && this.semester.length > 0) {
      if (!this.semester.some(s => s.toString() === user.semester.toString())) {
        return false;
      }
    }

    return true;
  },

  // Archive this notice
  archive: async function() {
    this.status = 'ARCHIVED';
    return this.save();
  },

  // Publish a draft notice
  publish: async function() {
    if (this.status === 'DRAFT') {
      this.status = 'PUBLISHED';
      this.publishDate = new Date();
      return this.save();
    }
    return this;
  },

  // Add attachment to notice
  addAttachment: async function(attachment) {
    this.attachments.push(attachment);
    return this.save();
  },

  // Remove attachment from notice
  removeAttachment: async function(attachmentId) {
    this.attachments = this.attachments.filter(
      att => att._id.toString() !== attachmentId.toString()
    );
    return this.save();
  }
};

// Static Methods
noticeSchema.statics = {
  // Find notices by author with pagination
  async findByAuthor(authorId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const [notices, totalCount] = await Promise.all([
      this.find({ author: authorId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'firstName lastName avatarUrl')
        .populate('department', 'name code'),
      this.countDocuments({ author: authorId })
    ]);

    return {
      notices,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  },

  // Find recent notices with filtering options
  async findRecent({
    limit = 10,
    page = 1,
    noticeType = null,
    department = null,
    audience = null,
    status = 'PUBLISHED',
    isImportant = null,
    searchQuery = null
  } = {}) {
    const skip = (page - 1) * limit;
    const query = { status };

    // Only show non-expired or notices without expiry date
    query.$or = [
      { expiryDate: { $exists: false } },
      { expiryDate: null },
      { expiryDate: { $gt: new Date() } }
    ];

    // Add filters
    if (noticeType) query.noticeType = noticeType;
    if (department) query.department = department;
    if (isImportant !== null) query.isImportant = isImportant;
    if (audience) query.targetAudience = audience;

    // Add text search if provided
    if (searchQuery) {
      query.$text = { $search: searchQuery };
    }

    const [notices, totalCount] = await Promise.all([
      this.find(query)
        .sort(searchQuery ? { score: { $meta: 'textScore' } } : { publishDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'firstName lastName avatarUrl')
        .populate('department', 'name code')
        .populate('semester', 'name')
        .populate('batch', 'year name')
        .populate('programme', 'name code'),
      this.countDocuments(query)
    ]);

    return {
      notices,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  },

  // Find notices targeted for a specific user
  async findForUser(user, options = {}) {
    const { 
      limit = 10, 
      page = 1,
      status = 'PUBLISHED',
      noticeType = null,
      isImportant = null,
      searchQuery = null
    } = options;
    
    const skip = (page - 1) * limit;
    
    // Base query for published and non-expired notices
    const query = { 
      status,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gt: new Date() } }
      ]
    };

    if (noticeType) query.noticeType = noticeType;
    if (isImportant !== null) query.isImportant = isImportant;
    
    // Add text search if provided
    if (searchQuery) {
      query.$text = { $search: searchQuery };
    }

    // Build audience query based on user properties
    const audienceQuery = [{ targetAudience: 'ALL' }];
    
    // Add user role to audience query
    if (user.role === 'STUDENT') {
      audienceQuery.push({ targetAudience: 'STUDENTS' });
      
      // Add year-specific audiences for students
      if (user.year) {
        const yearMap = {
          1: 'FIRST_YEAR',
          2: 'SECOND_YEAR',
          3: 'THIRD_YEAR',
          4: 'FOURTH_YEAR'
        };
        
        if (yearMap[user.year]) {
          audienceQuery.push({ targetAudience: yearMap[user.year] });
        }
      }
    } else if (user.role === 'FACULTY') {
      audienceQuery.push({ targetAudience: 'FACULTY' });
    } else if (user.role === 'ADMIN') {
      audienceQuery.push({ targetAudience: 'ADMIN' });
    }
    
    if (user.isAlumni) {
      audienceQuery.push({ targetAudience: 'ALUMNI' });
    }
    
    if (user.isParent) {
      audienceQuery.push({ targetAudience: 'PARENTS' });
    }
    
    query.$or = audienceQuery;
    
    // Department-specific notices
    if (user.department) {
      query.$or.push(
        { department: user.department },
        { department: null }
      );
    }
    
    // Programme, batch and semester specific notices
    if (user.programme) {
      query.$or.push({ programme: user.programme });
    }
    
    if (user.batch) {
      query.$or.push({ batch: user.batch });
    }
    
    if (user.semester) {
      query.$or.push({ semester: user.semester });
    }
    
    const [notices, totalCount] = await Promise.all([
      this.find(query)
        .sort(searchQuery ? { score: { $meta: 'textScore' } } : { isImportant: -1, publishDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'firstName lastName avatarUrl')
        .populate('department', 'name code')
        .populate('semester', 'name')
        .populate('batch', 'year name')
        .populate('programme', 'name code'),
      this.countDocuments(query)
    ]);
    
    return {
      notices,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  },
  
  // Find important/featured notices
  async findImportantNotices(limit = 5) {
    return this.find({
      status: 'PUBLISHED',
      isImportant: true,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gt: new Date() } }
      ]
    })
    .sort({ publishDate: -1 })
    .limit(limit)
    .populate('author', 'firstName lastName');
  },
  
  // Find notices by reference number (for official notices)
  async findByReferenceNumber(referenceNumber) {
    return this.findOne({ 
      referenceNumber,
      status: 'PUBLISHED'
    })
    .populate('author', 'firstName lastName')
    .populate('department', 'name code');
  },
  
  // Get notice statistics grouped by type
  async getStatistics() {
    return this.aggregate([
      {
        $match: { 
          status: 'PUBLISHED',
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: null },
            { expiryDate: { $gt: new Date() } }
          ]
        }
      },
      {
        $group: {
          _id: '$noticeType',
          count: { $sum: 1 },
          important: { 
            $sum: { 
              $cond: [{ $eq: ['$isImportant', true] }, 1, 0] 
            }
          }
        }
      },
      {
        $project: {
          noticeType: '$_id',
          count: 1,
          important: 1,
          _id: 0
        }
      }
    ]);
  },
  
  // Get notices published in the last N days
  async getRecentActivity(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
      {
        $match: {
          publishDate: { $gte: cutoffDate },
          status: 'PUBLISHED'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$publishDate' },
            month: { $month: '$publishDate' },
            day: { $dayOfMonth: '$publishDate' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day'
            }
          },
          count: 1,
          _id: 0
        }
      },
      { $sort: { date: 1 } }
    ]);
  },
  
  // Generate notice analytics
  async generateAnalytics(noticeId) {
    const notice = await this.findById(noticeId);
    if (!notice) return null;
    
    const readCount = notice.readBy.length;
    const acknowledgeCount = notice.acknowledgedBy.length;
    
    // Calculate read percentage if audience count can be determined
    let readPercentage = 0;
    let acknowledgePercentage = 0;
    
    // IMPLEMENT AUDIENCE COUNT LOGIC HERE based on department and target audience
    // This is a placeholder; you'd need to fetch actual audience counts from User model
    const estimatedAudienceCount = 100; // Placeholder
    
    if (estimatedAudienceCount > 0) {
      readPercentage = (readCount / estimatedAudienceCount) * 100;
      acknowledgePercentage = (acknowledgeCount / estimatedAudienceCount) * 100;
    }
    
    return {
      noticeId: notice._id,
      title: notice.title,
      publishDate: notice.publishDate,
      readCount,
      acknowledgeCount,
      readPercentage,
      acknowledgePercentage,
      audienceCount: estimatedAudienceCount
    };
  }
};

// Pre-save middleware to generate reference number for certain notice types
noticeSchema.pre('save', async function(next) {
  // Only generate reference numbers for official notices if not already set
  if (
    !this.referenceNumber && 
    ['EXAMINATION', 'ADMINISTRATIVE', 'ACADEMIC'].includes(this.noticeType) &&
    this.status !== 'DRAFT'
  ) {
    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    
    // Get count of notices of this type this year for sequential numbering
    const count = await this.constructor.countDocuments({
      noticeType: this.noticeType,
      createdAt: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`)
      }
    });
    
    // Format: TYPE/YEAR/MONTH/SEQUENCE 
    // Example: EXM/2023/04/001 for examination notice
    const typePrefix = {
      'EXAMINATION': 'EXM',
      'ADMINISTRATIVE': 'ADM',
      'ACADEMIC': 'ACD',
      'SCHOLARSHIP': 'SCH',
      'PLACEMENT': 'PLT',
      'ADMISSION': 'ADN'
    };
    
    const prefix = typePrefix[this.noticeType] || 'GEN';
    
    this.referenceNumber = `${prefix}/${currentYear}/${month.toString().padStart(2, '0')}/${(count + 1).toString().padStart(3, '0')}`;
  }
  
  next();
});

// Create the model
const Notice = mongoose.model('Notice', noticeSchema);

export default Notice;