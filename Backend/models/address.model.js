const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  addressType: {
    type: String,
    enum: ['permanent', 'current', 'office'],
    required: true
  },
  addressLine1: {
    type: String,
    required: [true, 'Address Line 1 is required'],
    trim: true,
    maxlength: [255, 'Address Line 1 cannot exceed 255 characters']
  },
  addressLine2: {
    type: String,
    trim: true,
    maxlength: [255, 'Address Line 2 cannot exceed 255 characters']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [100, 'City name cannot exceed 100 characters']
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    maxlength: [100, 'State name cannot exceed 100 characters']
  },
  country: {
    type: String,
    default: 'India',
    trim: true,
    maxlength: [100, 'Country name cannot exceed 100 characters']
  },
  postalCode: {
    type: String,
    required: [true, 'Postal Code is required'],
    trim: true,
    match: [/^\d{5,10}$/, 'Postal Code must be 5 to 10 digits']
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

// Compound Unique Index for (userId, addressType, isDefault)
addressSchema.index({ user: 1, addressType: 1, isDefault: 1 }, { unique: true });

// Middleware to Ensure Only One Default Address per User
addressSchema.pre('save', async function (next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Static method to get default address of a user
addressSchema.statics.getDefaultAddress = function (userId) {
  return this.findOne({ user: userId, isDefault: true });
};

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;
