const mongoose = require('mongoose');

const noticeAudienceSchema = new mongoose.Schema({
  noticeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notice',
    required: true
  },
  targetType: {
    type: String,
    enum: ['role', 'department', 'batch', 'individual'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
}, { 
  timestamps: true 
});

// ✅ Indexes for faster lookups
noticeAudienceSchema.index({ noticeId: 1 });
noticeAudienceSchema.index({ targetType: 1, targetId: 1 });

// ✅ Static Method: Fetch Notices for a Target
noticeAudienceSchema.statics.findNoticesForTarget = async function (targetType, targetId) {
  return this.find({ targetType, targetId }).populate('noticeId');
};

// ✅ Static Method: Add Notice Audience
noticeAudienceSchema.statics.addNoticeAudience = async function (noticeId, targetType, targetId) {
  return this.create({ noticeId, targetType, targetId });
};

// ✅ Method: Remove Notice Audience Entry
noticeAudienceSchema.methods.removeAudience = function () {
  return this.deleteOne();
};

const NoticeAudience = mongoose.model('NoticeAudience', noticeAudienceSchema);
module.exports = NoticeAudience;
