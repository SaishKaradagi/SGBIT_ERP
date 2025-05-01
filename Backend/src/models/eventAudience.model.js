import mongoose from "mongoose";

const eventAudienceSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    targetType: {
      type: String,
      enum: ['role', 'department', 'batch', 'individual'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Indexes for faster lookups
eventAudienceSchema.index({ eventId: 1 });
eventAudienceSchema.index({ targetType: 1, targetId: 1 });

// ✅ Unique index to prevent duplicate audience assignments
eventAudienceSchema.index(
  { eventId: 1, targetType: 1, targetId: 1 },
  { unique: true }
);

// ✅ Static Method: Fetch All Audiences for an Event
eventAudienceSchema.statics.findAudiencesForEvent = async function (eventId) {
  return this.find({ eventId }).populate('eventId');
};

// ✅ Static Method: Fetch Events for a Target (role, department, batch, individual)
eventAudienceSchema.statics.findEventsForTarget = async function (
  targetType,
  targetId
) {
  return this.find({ targetType, targetId }).populate('eventId');
};

// ✅ Static Method: Add a Target Audience to an Event
eventAudienceSchema.statics.addEventAudience = async function (
  eventId,
  targetType,
  targetId
) {
  return this.create({ eventId, targetType, targetId });
};

// ✅ Static Method: Remove an Audience Entry
eventAudienceSchema.statics.removeAudienceEntry = async function (
  eventId,
  targetType,
  targetId
) {
  return this.deleteOne({ eventId, targetType, targetId });
};

// ✅ Static Method: Bulk Insert Audience for an Event
eventAudienceSchema.statics.addMultipleAudiences = async function (
  eventId,
  audiences
) {
  const audienceDocs = audiences.map(({ targetType, targetId }) => ({
    eventId,
    targetType,
    targetId,
  }));
  return this.insertMany(audienceDocs, { ordered: false }); // ordered: false skips duplicates if any
};

// ✅ Static Method: Remove All Audience Entries for an Event
eventAudienceSchema.statics.clearEventAudience = async function (eventId) {
  return this.deleteMany({ eventId });
};

const EventAudience = mongoose.model('EventAudience', eventAudienceSchema);
export default EventAudience;
