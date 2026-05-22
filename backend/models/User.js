const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  
  // Admin-only device lock (one admin = one device)
  deviceId: { type: String, default: null },
  deviceToken: { type: String, default: null }, // FCM push token
  
  // Admin's managed users
  managedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // User's assigned admin
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  isActive: { type: Boolean, default: true },
  lastSeen: { type: Date, default: null },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
