const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

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

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;