const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  accuracy: { type: Number, default: 0 },
  altitude: { type: Number, default: null },
  speed: { type: Number, default: 0 },
  heading: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now, index: true },
  
  // Computed: time spent at this location
  dwellMinutes: { type: Number, default: 0 },
  isHighlighted: { type: Boolean, default: false }, // stopped 10+ min
}, { timestamps: true });

// Auto-expire after 12 hours
locationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 43200 });

// Static: get last 12 hours history for a user
locationSchema.statics.getLast12Hours = async function(userId) {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const locations = await this.find({
    userId,
    timestamp: { $gte: since }
  }).sort({ timestamp: 1 });

  // Compute dwell time and highlight stops > 10 min
  return computeDwellTime(locations);
};

function computeDwellTime(locations) {
  if (!locations.length) return [];
  
  const THRESHOLD_METERS = 50; // within 50m = same spot
  const HIGHLIGHT_MINUTES = 10;
  
  const result = locations.map(l => l.toObject());
  
  let groupStart = 0;
  
  for (let i = 1; i < result.length; i++) {
    const prev = result[groupStart];
    const curr = result[i];
    
    const dist = getDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    
    if (dist < THRESHOLD_METERS) {
      // Same spot - compute dwell
      const dwellMs = new Date(curr.timestamp) - new Date(result[groupStart].timestamp);
      const dwellMin = dwellMs / 60000;
      
      for (let j = groupStart; j <= i; j++) {
        result[j].dwellMinutes = dwellMin;
        result[j].isHighlighted = dwellMin >= HIGHLIGHT_MINUTES;
      }
    } else {
      groupStart = i;
    }
  }
  
  return result;
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = mongoose.model('Location', locationSchema);
