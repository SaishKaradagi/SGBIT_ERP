import mongoose from "mongoose";

/**
 * @description Constants for address types specific to college context
 * @enum {string}
 */
export const ADDRESS_TYPES = Object.freeze({
  PERMANENT: "permanent",
  CURRENT: "current",
  HOSTEL: "hostel",
  LOCAL_GUARDIAN: "localGuardian",
  CORRESPONDENCE: "correspondence",
});

/**
 * @description Validation helper for alphanumeric text with spaces and basic punctuation
 */
const alphaNumericWithSpaces = {
  validator: function (v) {
    return /^[a-zA-Z0-9\s\-\.,#/()&']+$/.test(v);
  },
  message: (props) => `${props.path} contains invalid characters`,
};

/**
 * @description Validation helper for proper names (cities, states)
 */
const properNameValidator = {
  validator: function (v) {
    return /^[a-zA-Z\s\-\.,']+$/.test(v);
  },
  message: (props) =>
    `${props.path} must contain only letters, spaces, and basic punctuation`,
};

/**
 * @description Schema for address documents
 */
const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    addressType: {
      type: String,
      enum: Object.values(ADDRESS_TYPES),
      default: ADDRESS_TYPES.CURRENT,
      required: true,
      index: true,
    },
    addressLine1: {
      type: String,
      required: [true, "Address Line 1 is required"],
      trim: true,
      maxlength: [255, "Address Line 1 cannot exceed 255 characters"],
      set: (value) => (value ? value.replace(/[<>]/g, "") : ""), // Basic sanitization
      validate: alphaNumericWithSpaces,
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [255, "Address Line 2 cannot exceed 255 characters"],
      set: (value) => (value ? value.replace(/[<>]/g, "") : ""), // Basic sanitization
      validate: alphaNumericWithSpaces,
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: [100, "Landmark cannot exceed 100 characters"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [100, "City name cannot exceed 100 characters"],
      set: (value) =>
        value ? value.charAt(0).toUpperCase() + value.slice(1) : "", // Capitalize first letter
      validate: properNameValidator,
    },
    district: {
      type: String,
      trim: true,
      maxlength: [100, "District name cannot exceed 100 characters"],
      validate: properNameValidator,
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      maxlength: [100, "State name cannot exceed 100 characters"],
      validate: properNameValidator,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
    pinCode: {
      type: String,
      required: [true, "PIN Code is required"],
      trim: true,
      validate: {
        validator: function (v) {
          // Indian PIN code format (6 digits)
          return /^[1-9][0-9]{5}$/.test(v);
        },
        message: "Please enter a valid 6-digit Indian PIN code",
      },
    },
    phoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field
          // Indian phone number validation (10 digits, optional +91 prefix)
          return /^(?:\+91)?[6-9][0-9]{9}$/.test(v.replace(/\s+/g, ""));
        },
        message: "Please enter a valid Indian phone number",
      },
    },
    alternatePhoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field
          // Indian phone number validation (10 digits, optional +91 prefix)
          return /^(?:\+91)?[6-9][0-9]{9}$/.test(v.replace(/\s+/g, ""));
        },
        message: "Please enter a valid Indian phone number",
      },
    },
    isDefaultForType: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationDate: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collation: { locale: "en", strength: 2 }, // Case-insensitive comparison
    id: false, // Don't generate duplicate _id as id
  },
);

// Text search index for address fields
addressSchema.index(
  {
    addressLine1: "text",
    addressLine2: "text",
    landmark: "text",
    city: "text",
    district: "text",
    state: "text",
  },
  {
    weights: {
      city: 10,
      district: 8,
      state: 5,
      landmark: 4,
      addressLine1: 3,
      addressLine2: 1,
    },
    name: "address_text_index",
  },
);

// Validation to ensure there's only one default address per type for a user
addressSchema.path("isDefaultForType").validate(async function (value) {
  if (!value) return true; // Only validate if setting to true

  try {
    const count = await this.constructor.countDocuments({
      user: this.user,
      addressType: this.addressType,
      isDefaultForType: true,
      _id: { $ne: this._id },
      isActive: true,
    });

    return count === 0;
  } catch (error) {
    console.error("Validation error:", error);
    return false;
  }
}, "User already has a default address for this address type");

// Virtual for user details
addressSchema.virtual("userDetails", {
  ref: "User",
  localField: "user",
  foreignField: "_id",
  justOne: true,
});

// Compound indexes for efficient queries
addressSchema.index({ user: 1, addressType: 1 }, { unique: false });
addressSchema.index(
  { user: 1, addressType: 1, isDefaultForType: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefaultForType: true, isActive: true },
  },
);
addressSchema.index({ user: 1, isActive: 1 });
addressSchema.index({ isVerified: 1 });

/**
 * Middleware to ensure only one default address per type per user
 */
addressSchema.pre("save", async function (next) {
  try {
    if (this.isDefaultForType && this.isModified("isDefaultForType")) {
      // Update all other addresses of same type to not be default
      await this.constructor.updateMany(
        {
          user: this.user,
          addressType: this.addressType,
          _id: { $ne: this._id },
          isActive: true,
        },
        { $set: { isDefaultForType: false } },
      );
    }

    // If this is the first address of this type for the user, make it default
    if (this.isNew) {
      const count = await this.constructor.countDocuments({
        user: this.user,
        addressType: this.addressType,
        isActive: true,
      });

      if (count === 0) {
        this.isDefaultForType = true;
      }
    }

    // Update lastUsed timestamp when saving address
    this.lastUsed = new Date();

    // Store verification date when address is verified
    if (this.isVerified && this.isModified("isVerified")) {
      this.verificationDate = new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Method to get formatted full address
 */
addressSchema.methods.getFormattedAddress = function () {
  let parts = [this.addressLine1];

  if (this.addressLine2) parts.push(this.addressLine2);
  if (this.landmark) parts.push(`Near ${this.landmark}`);

  let locationParts = [this.city];
  if (this.district && this.district !== this.city)
    locationParts.push(this.district);
  locationParts.push(`${this.state} - ${this.pinCode}`);

  parts.push(locationParts.join(", "));
  parts.push(this.country);

  return parts.join("\n");
};

/**
 * Static method to get default address of a user by type
 */
addressSchema.statics.getDefaultAddressByType = async function (
  userId,
  addressType,
) {
  return this.findOne({
    user: userId,
    addressType: addressType,
    isDefaultForType: true,
    isActive: true,
  });
};

/**
 * Static method to get all active addresses for a user
 */
addressSchema.statics.getUserAddresses = async function (userId) {
  return this.find({
    user: userId,
    isActive: true,
  }).sort({ isDefaultForType: -1, lastUsed: -1 });
};

/**
 * Static method for soft deletion
 */
addressSchema.statics.softDelete = async function (addressId, userId) {
  const address = await this.findOne({ _id: addressId, user: userId });

  if (!address) {
    throw new Error(
      "Address not found or you don't have permission to delete it",
    );
  }

  // If this was a default address, we need to potentially set a new default
  const wasDefault = address.isDefaultForType;
  const addressType = address.addressType;

  // Mark as inactive instead of deleting
  address.isActive = false;
  address.isDefaultForType = false;
  await address.save();

  // If this was a default address, set another address as default if available
  if (wasDefault) {
    const newDefaultCandidate = await this.findOne({
      user: userId,
      addressType: addressType,
      isActive: true,
    }).sort({ lastUsed: -1 });

    if (newDefaultCandidate) {
      newDefaultCandidate.isDefaultForType = true;
      await newDefaultCandidate.save();
    }
  }

  return address;
};

/**
 * Static method to verify an address
 */
addressSchema.statics.verifyAddress = async function (addressId, verifiedBy) {
  const address = await this.findById(addressId);

  if (!address) {
    throw new Error("Address not found");
  }

  address.isVerified = true;
  address.verificationDate = new Date();
  address.verifiedBy = verifiedBy;

  return address.save();
};

/**
 * Static method to get unverified addresses
 */
addressSchema.statics.getUnverifiedAddresses = async function () {
  return this.find({
    isActive: true,
    isVerified: false,
  }).populate("user", "name rollNumber email");
};

const Address = mongoose.model("Address", addressSchema);

// Export model and constants
export { Address, addressSchema, ADDRESS_TYPES };
