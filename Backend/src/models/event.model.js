import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const eventSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  title: {
    type: String,
    required: [true, 'Event title is always required'],
    trim: true,
    maxlength: [255, 'Title cannot be more than 255 characters']
  },
  description: {
    type: String,
    trim: true
  },
  eventDate: {
    type: Date,
    required: [true, 'Event date is required']
  },
  venue: {
    type: String,
    trim: true,
    maxlength: [255, 'Venue cannot be more than 255 characters']
  },
  organizer: {
    type: String,
    required: [true, 'Organizer is required'],
    trim: true,
    maxlength: [255, 'Organizer cannot be more than 255 characters']
  }
}, {
  timestamps: true
});

// Create index for sorting by event date
eventSchema.index({ eventDate: 1 });

// Virtual for status (upcoming, ongoing, or past)
eventSchema.virtual('status').get(function() {
  const now = new Date();
  const eventDate = new Date(this.eventDate);
  
  // Assuming events last for 24 hours
  const eventEndDate = new Date(eventDate);
  eventEndDate.setHours(eventEndDate.getHours() + 24);
  
  if (eventDate > now) {
    return 'upcoming';
  } else if (now >= eventDate && now <= eventEndDate) {
    return 'ongoing';
  } else {
    return 'past';
  }
});

// Virtual for formatted date
eventSchema.virtual('formattedDate').get(function() {
  return this.eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Static method to find upcoming events
eventSchema.statics.findUpcoming = function(limit = 10) {
  return this.find({ eventDate: { $gt: new Date() } })
    .sort({ eventDate: 1 })
    .limit(limit);
};

// Static method to find events by date range
eventSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    eventDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ eventDate: 1 });
};

// Static method to find events by status
eventSchema.statics.findByStatus = function(status) {
  const now = new Date();
  let query = {};
  
  switch (status) {
    case 'upcoming':
      query = { eventDate: { $gt: now } };
      break;
    case 'ongoing':
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      query = { 
        eventDate: { 
          $gte: twentyFourHoursAgo,
          $lte: now 
        }
      };
      break;
    case 'past':
      const pastCutoff = new Date(now.getTime() - (24 * 60 * 60 * 1000));
      query = { eventDate: { $lt: pastCutoff } };
      break;
  }
  
  return this.find(query).sort({ eventDate: status === 'past' ? -1 : 1 });
};

// Instance method to check if event is active
eventSchema.methods.isActive = function() {
  return this.status === 'upcoming' || this.status === 'ongoing';
};

// Pre-save middleware to validate event date
eventSchema.pre('save', function(next) {
  if (this.isNew && this.eventDate < new Date()) {
    return next(new Error('Event date cannot be in the past'));
  }
  next();
});

// Create the model
const Event = mongoose.model('Event', eventSchema);

// Export as default
export default Event;