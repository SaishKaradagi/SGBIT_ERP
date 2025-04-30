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
 * @description Constants for user types in college context
 * @enum {string}
 */
export const USER_TYPES = Object.freeze({
  STUDENT: "student",
  FACULTY: "faculty",
  STAFF: "staff",
  ADMIN: "admin",
});

/**
 * @description Validation helper for alphanumeric text with spaces and basic punctuation
 */
const alphaNumericWithSpaces = {
  validator: function (v) {
    return /^[a-zA-Z0-9\s\-\.,#/()&']+$/.test(v);
  },
  message: (props) =>
    `${props.path} contains invalid characters. Only alphanumeric characters, spaces, and basic punctuation are allowed.`,
};

/**
 * @description Validation helper for proper names (cities, states)
 */
const properNameValidator = {
  validator: function (v) {
    return /^[a-zA-Z\s\-\.,']+$/.test(v);
  },
  message: (props) =>
    `${props.path} must contain only letters, spaces, and basic punctuation.`,
};

/**
 * @description Helper to sanitize text inputs against XSS attacks
 * @param {string} value - The input value to sanitize
 * @returns {string} - The sanitized string
 */
const sanitizeInput = function (value) {
  if (!value) return "";
  // Remove potentially dangerous HTML/script tags and normalize whitespace
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
};

/**
 * @description Schema for address documents
 */
const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    userType: {
      type: String,
      enum: Object.values(USER_TYPES),
      required: [true, "User type is required"],
      index: true,
    },
    addressType: {
      type: String,
      enum: Object.values(ADDRESS_TYPES),
      default: ADDRESS_TYPES.CURRENT,
      required: [true, "Address type is required"],
      index: true,
    },
    addressLine1: {
      type: String,
      required: [true, "Address Line 1 is required"],
      trim: true,
      maxlength: [255, "Address Line 1 cannot exceed 255 characters"],
      set: sanitizeInput,
      validate: alphaNumericWithSpaces,
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [255, "Address Line 2 cannot exceed 255 characters"],
      set: sanitizeInput,
      validate: alphaNumericWithSpaces,
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: [100, "Landmark cannot exceed 100 characters"],
      set: sanitizeInput,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [100, "City name cannot exceed 100 characters"],
      set: (value) => {
        if (!value) return "";
        // Sanitize and capitalize first letter of each word
        return sanitizeInput(value)
          .split(" ")
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(" ");
      },
      validate: properNameValidator,
    },
    district: {
      type: String,
      trim: true,
      maxlength: [100, "District name cannot exceed 100 characters"],
      set: sanitizeInput,
      validate: properNameValidator,
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      maxlength: [100, "State name cannot exceed 100 characters"],
      set: (value) => {
        if (!value) return "";
        // Sanitize and capitalize first letter of each word
        return sanitizeInput(value)
          .split(" ")
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(" ");
      },
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
          if (!v) return false;

          // Clean the input - remove any spaces or other characters
          const cleanPIN = v.replace(/\D/g, "");

          // Indian PIN code format validation (6 digits, starting with valid first digit)
          // India PIN codes generally start with digits 1-8
          return /^[1-8][0-9]{5}$/.test(cleanPIN);
        },
        message: "Please enter a valid 6-digit Indian PIN code (e.g., 560001)",
      },
      set: function (v) {
        // Always store PIN codes in standard 6-digit format without spaces
        if (!v) return "";
        return v.replace(/\D/g, "");
      },
    },
    phoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field

          // Clean the input - remove spaces, dashes, etc.
          const cleanPhone = v.replace(/\D/g, "");

          // Indian phone number validation (10 digits, optional +91 prefix)
          // Mobile numbers in India start with 6, 7, 8, or 9
          if (cleanPhone.length === 10) {
            return /^[6-9][0-9]{9}$/.test(cleanPhone);
          } else if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
            return /^91[6-9][0-9]{9}$/.test(cleanPhone);
          }
          return false;
        },
        message:
          "Please enter a valid Indian mobile number (10 digits starting with 6-9, with optional +91 prefix)",
      },
      set: function (v) {
        if (!v) return "";
        // Standardize format: store as 10 digits without country code
        const cleaned = v.replace(/\D/g, "");
        if (cleaned.length === 12 && cleaned.startsWith("91")) {
          return cleaned.substring(2);
        }
        return cleaned;
      },
    },
    alternatePhoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Optional field

          // Clean the input - remove spaces, dashes, etc.
          const cleanPhone = v.replace(/\D/g, "");

          // Indian phone number validation (10 digits, optional +91 prefix)
          // Mobile numbers in India start with 6, 7, 8, or 9
          if (cleanPhone.length === 10) {
            return /^[6-9][0-9]{9}$/.test(cleanPhone);
          } else if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
            return /^91[6-9][0-9]{9}$/.test(cleanPhone);
          }
          return false;
        },
        message:
          "Please enter a valid Indian mobile number (10 digits starting with 6-9, with optional +91 prefix)",
      },
      set: function (v) {
        if (!v) return "";
        // Standardize format: store as 10 digits without country code
        const cleaned = v.replace(/\D/g, "");
        if (cleaned.length === 12 && cleaned.startsWith("91")) {
          return cleaned.substring(2);
        }
        return cleaned;
      },
    },
    // Optional geocoding support for mapping/location services
    latitude: {
      type: Number,
      min: [-90, "Latitude must be between -90 and 90 degrees"],
      max: [90, "Latitude must be between -90 and 90 degrees"],
    },
    longitude: {
      type: Number,
      min: [-180, "Longitude must be between -180 and 180 degrees"],
      max: [180, "Longitude must be between -180 and 180 degrees"],
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
      index: true,
    },
    verificationDate: {
      type: Date,
    },
    verificationMethod: {
      type: String,
      enum: ["document", "physical", "OTP", "email", "other"],
    },
    verificationNotes: {
      type: String,
      maxlength: [500, "Verification notes cannot exceed 500 characters"],
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
    // Audit trail fields
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updateNotes: {
      type: String,
      maxlength: [500, "Update notes cannot exceed 500 characters"],
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
    pinCode: "text",
  },
  {
    weights: {
      pinCode: 15,
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
  if (!this.isActive) return false; // Cannot set inactive address as default

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

// Validation to ensure phone numbers are unique when present
addressSchema.path("phoneNumber").validate(async function (value) {
  if (!value) return true; // Skip validation if not provided

  try {
    // Check if this phone number is used by any other active address
    const count = await this.constructor.countDocuments({
      phoneNumber: value,
      user: { $ne: this.user }, // Exclude current user
      _id: { $ne: this._id }, // Exclude current address
      isActive: true,
    });

    if (count > 0) {
      return false; // Phone number is already in use
    }

    return true;
  } catch (error) {
    console.error("Phone validation error:", error);
    return false;
  }
}, "This phone number is already registered with another user");

// Virtual for user details
addressSchema.virtual("userDetails", {
  ref: "User",
  localField: "user",
  foreignField: "_id",
  justOne: true,
});

// Compound indexes for efficient queries
addressSchema.index({ user: 1, addressType: 1, isActive: 1 });
addressSchema.index(
  { user: 1, addressType: 1, isDefaultForType: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefaultForType: true, isActive: true },
  },
);
addressSchema.index({ userType: 1, isActive: 1 });
addressSchema.index({ pinCode: 1 });
addressSchema.index({ city: 1, state: 1 });

/**
 * Middleware to ensure only one default address per type per user
 */
addressSchema.pre("save", async function (next) {
  try {
    if (
      this.isDefaultForType &&
      this.isModified("isDefaultForType") &&
      this.isActive
    ) {
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
    if (this.isNew || (this.isModified("isActive") && this.isActive)) {
      const count = await this.constructor.countDocuments({
        user: this.user,
        addressType: this.addressType,
        isActive: true,
        _id: { $ne: this._id },
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

    // If setting an address to inactive and it's a default, we need to handle that
    if (
      this.isModified("isActive") &&
      !this.isActive &&
      this.isDefaultForType
    ) {
      this.isDefaultForType = false;
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
 * Method to get simplified address for display
 */
addressSchema.methods.getShortAddress = function () {
  let parts = [];

  if (this.addressLine1) {
    parts.push(
      this.addressLine1.length > 30
        ? this.addressLine1.substring(0, 27) + "..."
        : this.addressLine1,
    );
  }

  parts.push(`${this.city}, ${this.state} - ${this.pinCode}`);

  return parts.join(", ");
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
addressSchema.statics.softDelete = async function (
  addressId,
  userId,
  deletedBy = null,
) {
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

  // Record who made the deletion if provided
  if (deletedBy) {
    address.updatedBy = deletedBy;
    address.updateNotes = "Address marked as deleted";
  }

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
      return {
        deletedAddress: address,
        newDefaultAddress: newDefaultCandidate,
      };
    }
  }

  return { deletedAddress: address };
};

/**
 * Static method to verify an address
 */
addressSchema.statics.verifyAddress = async function (
  addressId,
  verifiedBy,
  method = "document",
  notes = "",
) {
  const address = await this.findById(addressId);

  if (!address) {
    throw new Error("Address not found");
  }

  address.isVerified = true;
  address.verificationDate = new Date();
  address.verifiedBy = verifiedBy;
  address.verificationMethod = method;
  address.verificationNotes = notes;

  return address.save();
};

/**
 * Static method to get unverified addresses
 */
addressSchema.statics.getUnverifiedAddresses = async function (options = {}) {
  const query = {
    isActive: true,
    isVerified: false,
  };

  // Add filters if provided
  if (options.userType) query.userType = options.userType;
  if (options.addressType) query.addressType = options.addressType;

  return this.find(query)
    .populate("user", "name rollNumber email")
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 100);
};

/**
 * Static method to find similar addresses (for duplicate detection)
 */
addressSchema.statics.findSimilarAddresses = async function (addressData) {
  // Extract key fields for comparison
  const { city, pinCode, addressLine1 } = addressData;

  if (!city || !pinCode) {
    throw new Error(
      "City and PIN code are required for finding similar addresses",
    );
  }

  // Build a query to find potentially similar addresses
  const query = {
    city: new RegExp(city, "i"), // Case-insensitive city match
    pinCode: pinCode,
    isActive: true,
  };

  if (addressLine1) {
    // Use MongoDB text search for address line
    query.$text = { $search: addressLine1 };
  }

  return this.find(query)
    .select(
      "user addressType addressLine1 addressLine2 city state pinCode isVerified",
    )
    .populate("user", "name email")
    .limit(5);
};

/**
 * Static method to get address statistics by region
 */
addressSchema.statics.getAddressStatsByRegion = async function () {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: { state: "$state", city: "$city" },
        count: { $sum: 1 },
        verifiedCount: {
          $sum: { $cond: [{ $eq: ["$isVerified", true] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        state: "$_id.state",
        city: "$_id.city",
        count: 1,
        verifiedCount: 1,
        verificationRate: {
          $multiply: [{ $divide: ["$verifiedCount", "$count"] }, 100],
        },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

const Address = mongoose.model("Address", addressSchema);

// Export model and constants
export { Address, addressSchema, ADDRESS_TYPES, USER_TYPES };
