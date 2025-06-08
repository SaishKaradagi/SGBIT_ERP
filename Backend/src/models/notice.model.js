import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

/**
 * Notice Schema - For college announcements, circulars and important information
 * Customized for Indian educational institutions with department and audience filtering
 */
const noticeSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      immutable: true,
      index: true, // Add index for improved lookup performance
    },
    title: {
      type: String,
      required: [true, "Notice title is required"],
      trim: true,
      maxlength: [255, "Title cannot be more than 255 characters"],
      index: "text", // Enable text search on titles
    },
    content: {
      type: String,
      required: [true, "Notice content is required"],
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null, // null means all departments
      index: true,
    },
    noticeType: {
      type: String,
      enum: [
        "GENERAL", // General notices
        "ACADEMIC", // Academic related notices
        "EXAMINATION", // Exam schedules, results etc.
        "EVENT", // College events
        "ADMISSION", // Admission related
        "PLACEMENT", // Training and placement notices
        "SCHOLARSHIP", // Scholarship information
        "HOLIDAY", // Holiday announcements
        "ADMINISTRATIVE", // Administrative notices
        "URGENT", // Important and urgent notices
      ],
      default: "GENERAL",
      index: true,
    },
    isImportant: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      default: "PUBLISHED",
      index: true,
    },
    attachments: [
      {
        name: {
          type: String,
          required: true,
        },
        fileUrl: {
          type: String,
          required: true,
        },
        fileSize: {
          type: Number, // Size in bytes
          required: true,
        },
        mimeType: {
          type: String,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    publishDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true, // For efficient date-based filtering
    },
    expiryDate: {
      type: Date,
      validate: {
        validator: function (v) {
          // Expiry date must be greater than publish date
          return !v || v > this.publishDate;
        },
        message: "Expiry date must be after publish date",
      },
      index: true, // For efficient expiry-based filtering
    },
    targetAudience: [
      {
        type: String,
        enum: [
          "ALL", // All users
          "STUDENTS", // All students
          "FACULTY", // All faculty members
          "ADMIN", // Administrative staff
          "FIRST_YEAR", // First year students
          "SECOND_YEAR", // Second year students
          "THIRD_YEAR", // Third year students
          "FOURTH_YEAR", // Final year students
          "ALUMNI", // College alumni
          "PARENTS", // Student parents
        ],
        default: ["ALL"],
      },
    ],
    semester: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Semester", // Target specific semesters
      },
    ],
    batch: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Batch", // Target specific batches
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Create compound indexes for common query patterns
noticeSchema.index({ noticeType: 1, status: 1, publishDate: -1 });
noticeSchema.index({ status: 1, department: 1, publishDate: -1 });
noticeSchema.index({ status: 1, targetAudience: 1, publishDate: -1 });
noticeSchema.index({ isImportant: 1, status: 1, publishDate: -1 });
// Automatic deletion of expired notices
noticeSchema.index(
  { expiryDate: 1 },
  {
    expireAfterSeconds: 0, // Delete immediately after expiry
    partialFilterExpression: {
      expiryDate: { $exists: true },
    },
  },
);

// Text index for full text search capabilities
noticeSchema.index(
  {
    title: "text",
    content: "text",
  },
  {
    weights: {
      title: 5,
      content: 3,
    },
    name: "notice_text_index",
  },
);

// Virtual for formatted creation date in Indian format (DD-MM-YYYY)
noticeSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Virtual for short title
noticeSchema.virtual("shortTitle").get(function () {
  return this.title.length > 50
    ? `${this.title.substring(0, 50)}...`
    : this.title;
});

// Virtual for age of notice
noticeSchema.virtual("age").get(function () {
  const now = new Date();
  const diff = now - this.createdAt;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    }
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else if (days < 30) {
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  } else {
    const months = Math.floor(days / 30);
    return `${months} month${months !== 1 ? "s" : ""} ago`;
  }
});

// Virtual to check if notice is expired
noticeSchema.virtual("isExpired").get(function () {
  if (!this.expiryDate) return false;
  return new Date() > this.expiryDate;
});

// Instance Methods
noticeSchema.methods = {
  // Get a snippet of content with configurable length
  getContentSnippet: function (length = 100) {
    if (!this.content || this.content.length <= length)
      return this.content || "";
    return this.content.substring(0, length) + "...";
  },

  // Check if notice is accessible to a specific user
  isAccessibleTo: function (user) {
    // If notice is not published, only author can access
    if (this.status !== "PUBLISHED") {
      return user._id.toString() === this.author.toString();
    }

    // If expired, nobody can access
    if (this.expiryDate && new Date() > this.expiryDate) {
      return false;
    }

    // Check department restriction
    if (
      this.department &&
      user.department &&
      this.department.toString() !== user.department.toString()
    ) {
      return false;
    }

    // Check user type against targetAudience
    if (this.targetAudience.includes("ALL")) {
      return true;
    }

    // Check specific audience types
    if (user.role === "STUDENT" && this.targetAudience.includes("STUDENTS")) {
      // Check year-specific restrictions for students
      if (user.year) {
        const yearMap = {
          1: "FIRST_YEAR",
          2: "SECOND_YEAR",
          3: "THIRD_YEAR",
          4: "FOURTH_YEAR",
        };

        if (this.targetAudience.includes(yearMap[user.year])) {
          return true;
        }
      } else {
        return true;
      }
    }

    if (user.role === "FACULTY" && this.targetAudience.includes("FACULTY")) {
      return true;
    }

    if (user.role === "ADMIN" && this.targetAudience.includes("ADMIN")) {
      return true;
    }

    if (user.isAlumni && this.targetAudience.includes("ALUMNI")) {
      return true;
    }

    if (user.isParent && this.targetAudience.includes("PARENTS")) {
      return true;
    }

    // Check programme, batch and semester
    if (user.programme && this.programme.length > 0) {
      if (
        !this.programme.some((p) => p.toString() === user.programme.toString())
      ) {
        return false;
      }
    }

    if (user.batch && this.batch.length > 0) {
      if (!this.batch.some((b) => b.toString() === user.batch.toString())) {
        return false;
      }
    }

    if (user.semester && this.semester.length > 0) {
      if (
        !this.semester.some((s) => s.toString() === user.semester.toString())
      ) {
        return false;
      }
    }

    return true;
  },

  // Archive this notice
  archive: async function () {
    this.status = "ARCHIVED";
    return this.save();
  },

  // Publish a draft notice
  publish: async function () {
    if (this.status === "DRAFT") {
      this.status = "PUBLISHED";
      this.publishDate = new Date();
      return this.save();
    }
    return this;
  },

  // Add attachment to notice
  addAttachment: async function (attachment) {
    this.attachments.push(attachment);
    return this.save();
  },

  // Remove attachment from notice
  removeAttachment: async function (attachmentId) {
    this.attachments = this.attachments.filter(
      (att) => att._id.toString() !== attachmentId.toString(),
    );
    return this.save();
  },
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
        .populate("author", "firstName lastName avatarUrl")
        .populate("department", "name code"),
      this.countDocuments({ author: authorId }),
    ]);

    return {
      notices,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  },

  // Find recent notices with filtering options
  async findRecent({
    limit = 10,
    page = 1,
    noticeType = null,
    department = null,
    audience = null,
    status = "PUBLISHED",
    isImportant = null,
    searchQuery = null,
  } = {}) {
    const skip = (page - 1) * limit;
    const query = { status };

    // Only show non-expired or notices without expiry date
    query.$or = [
      { expiryDate: { $exists: false } },
      { expiryDate: null },
      { expiryDate: { $gt: new Date() } },
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
        .sort(
          searchQuery ? { score: { $meta: "textScore" } } : { publishDate: -1 },
        )
        .skip(skip)
        .limit(limit)
        .populate("author", "firstName lastName avatarUrl")
        .populate("department", "name code")
        .populate("semester", "name")
        .populate("batch", "year name")
        .populate("programme", "name code"),
      this.countDocuments(query),
    ]);

    return {
      notices,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  },

  // Find notices targeted for a specific user
  async findForUser(user, options = {}) {
    const {
      limit = 10,
      page = 1,
      status = "PUBLISHED",
      noticeType = null,
      isImportant = null,
      searchQuery = null,
    } = options;

    const skip = (page - 1) * limit;

    // Base query for published and non-expired notices
    const query = {
      status,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gt: new Date() } },
      ],
    };

    if (noticeType) query.noticeType = noticeType;
    if (isImportant !== null) query.isImportant = isImportant;

    // Add text search if provided
    if (searchQuery) {
      query.$text = { $search: searchQuery };
    }

    // Build audience query based on user properties
    const audienceQuery = [{ targetAudience: "ALL" }];

    // Add user role to audience query
    if (user.role === "STUDENT") {
      audienceQuery.push({ targetAudience: "STUDENTS" });

      // Add year-specific audiences for students
      if (user.year) {
        const yearMap = {
          1: "FIRST_YEAR",
          2: "SECOND_YEAR",
          3: "THIRD_YEAR",
          4: "FOURTH_YEAR",
        };

        if (yearMap[user.year]) {
          audienceQuery.push({ targetAudience: yearMap[user.year] });
        }
      }
    } else if (user.role === "FACULTY") {
      audienceQuery.push({ targetAudience: "FACULTY" });
    } else if (user.role === "ADMIN") {
      audienceQuery.push({ targetAudience: "ADMIN" });
    }

    if (user.isAlumni) {
      audienceQuery.push({ targetAudience: "ALUMNI" });
    }

    if (user.isParent) {
      audienceQuery.push({ targetAudience: "PARENTS" });
    }

    query.$or = audienceQuery;

    // Department-specific notices
    if (user.department) {
      query.$or.push({ department: user.department }, { department: null });
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
        .sort(
          searchQuery
            ? { score: { $meta: "textScore" } }
            : { isImportant: -1, publishDate: -1 },
        )
        .skip(skip)
        .limit(limit)
        .populate("author", "firstName lastName avatarUrl")
        .populate("department", "name code")
        .populate("semester", "name")
        .populate("batch", "year name")
        .populate("programme", "name code"),
      this.countDocuments(query),
    ]);

    return {
      notices,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  },

  // Find important/featured notices
  async findImportantNotices(limit = 5) {
    return this.find({
      status: "PUBLISHED",
      isImportant: true,
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gt: new Date() } },
      ],
    })
      .sort({ publishDate: -1 })
      .limit(limit)
      .populate("author", "firstName lastName");
  },

  // Get notice statistics grouped by type
  async getStatistics() {
    return this.aggregate([
      {
        $match: {
          status: "PUBLISHED",
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: null },
            { expiryDate: { $gt: new Date() } },
          ],
        },
      },
      {
        $group: {
          _id: "$noticeType",
          count: { $sum: 1 },
          important: {
            $sum: {
              $cond: [{ $eq: ["$isImportant", true] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          noticeType: "$_id",
          count: 1,
          important: 1,
          _id: 0,
        },
      },
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
          status: "PUBLISHED",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$publishDate" },
            month: { $month: "$publishDate" },
            day: { $dayOfMonth: "$publishDate" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
            },
          },
          count: 1,
          _id: 0,
        },
      },
      { $sort: { date: 1 } },
    ]);
  },
};

// Create the model
const Notice = mongoose.model("Notice", noticeSchema);

export default Notice;
