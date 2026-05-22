const mongoose = require('mongoose');

const geofenceSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  name: { type: String, default: 'Safe Zone' },
  centerLat: { type: Number, required: true },
  centerLng: { type: Number, required: true },
  radiusMeters: { type: Number, required: true, min: 50, max: 50000 },
  
  isActive: { type: Boolean, default: true },
  userIsInside: { type: Boolean, default: true },
  
  // Alert settings
  alertOnExit: { type: Boolean, default: true },
  alertOnEnter: { type: Boolean, default: false },
  
  lastAlertAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Geofence', geofenceSchema);
