const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Encryption Helper Functions
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // 32-byte key
const IV_LENGTH = 16; // AES block size

function encrypt(text) {
  if (!text) return '';
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return '';
  let parts = text.split(':');
  let iv = Buffer.from(parts[0], 'hex');
  let encryptedText = Buffer.from(parts[1], 'hex');
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Define Schema
const studentGuardianSchema = new mongoose.Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
    immutable: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required']
  },
  name: {
    type: String,
    required: [true, 'Guardian name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  relationship: {
    type: String,
    enum: ['father', 'mother', 'guardian'],
    required: true
  },
  occupation: {
    type: String,
    trim: true,
    maxlength: [100, 'Occupation cannot exceed 100 characters']
  },
  qualification: {
    type: String,
    trim: true,
    maxlength: [100, 'Qualification cannot exceed 100 characters']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    set: encrypt, // Encrypt before saving
    get: decrypt  // Decrypt when retrieving
  },
  email: {
    type: String,
    set: encrypt, // Encrypt before saving
    get: decrypt, // Decrypt when retrieving
    validate: {
      validator: function (v) {
        if (!v) return true;
        let decryptedEmail = decrypt(v);
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decryptedEmail);
      },
      message: 'Invalid email format'
    }
  }
}, { 
  timestamps: true, 
  toJSON: { getters: true } // Ensure decrypted values are returned in JSON
});

// Indexing for `studentId` and `relationship`
studentGuardianSchema.index({ student: 1 });
studentGuardianSchema.index({ relationship: 1 });

// Static method to find guardians for a student
studentGuardianSchema.statics.findByStudent = function(studentId) {
  return this.find({ student: studentId }).populate('student', 'name');
};

// Method to update guardian's details
studentGuardianSchema.methods.updateGuardianDetails = function(updateData) {
  Object.assign(this, updateData);
  return this.save();
};

const StudentGuardian = mongoose.model('StudentGuardian', studentGuardianSchema);

module.exports = StudentGuardian;
