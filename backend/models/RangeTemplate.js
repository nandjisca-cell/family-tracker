const mongoose = require('mongoose');

const rangeTemplateSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  centerLat: { type: Number, required: true },
  centerLng: { type: Number, required: true },
  radiusMeters: { type: Number, required: true, min: 50, max: 50000 },
}, { timestamps: true });

module.exports = mongoose.model('RangeTemplate', rangeTemplateSchema);
