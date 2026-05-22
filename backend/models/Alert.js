const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['range_exit', 'sos', 'gps_off', 'permission_denied', 'battery_low', 'offline'],
    required: true,
    index: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: { type: String, required: true },
  message: { type: String, required: true },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  distance: { type: Number, default: null },
  radiusMeters: { type: Number, default: null },
  fenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Geofence', default: null },
  fenceName: { type: String, default: null },
  acknowledged: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);
