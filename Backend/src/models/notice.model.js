const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const noticeSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  title: {
    type: String,
    required: [true, 'Notice title is required'],
    trim: true,
    maxlength: [255, 'Title cannot be more than 255 characters']
  },
  content: {
    type: String,
    required: [true, 'Notice content is required'],
    trim: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Create index for author lookup
noticeSchema.index({ author: 1 });

// Improve performance by adding index on creation date for listing in reverse chronological order
noticeSchema.index({ createdAt: -1 });

// Virtual for formatted creation date
noticeSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Method to get a snippet of content
noticeSchema.methods.getContentSnippet = function(length = 100) {
  if (this.content.length <= length) return this.content;
  return this.content.substring(0, length) + '...';
};

// Static method to find notices by author
noticeSchema.statics.findByAuthor = function(authorId) {
  return this.find({ author: authorId })
    .sort({ createdAt: -1 })
    .populate('author', 'firstName lastName');
};

// Static method to find recent notices
noticeSchema.statics.findRecent = function(limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('author', 'firstName lastName');
};

const Notice = mongoose.model('Notice', noticeSchema);

module.exports = Notice;