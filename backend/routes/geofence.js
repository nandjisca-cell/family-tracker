const express = require('express');
const router = express.Router();
const Geofence = require('../models/Geofence');
const User = require('../models/User');

// Admin: create geofence for a user
router.post('/create', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { targetUserId, centerLat, centerLng, radiusMeters, name } = req.body;

    if (!targetUserId || !centerLat || !centerLng || !radiusMeters) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Deactivate existing fences for this user-admin pair
    await Geofence.updateMany(
      { adminId: req.user._id, targetUserId },
      { isActive: false }
    );

    const fence = new Geofence({
      adminId: req.user._id,
      targetUserId,
      centerLat, centerLng, radiusMeters,
      name: name || 'Safe Zone',
      isActive: true,
      userIsInside: true
    });
    await fence.save();

    res.status(201).json({ geofence: fence });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: get all geofences
router.get('/list', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const fences = await Geofence.find({ adminId: req.user._id, isActive: true })
      .populate('targetUserId', 'name phone');
    res.json({ geofences: fences });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete geofence
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    await Geofence.findOneAndDelete({ _id: req.params.id, adminId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update radius
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { radiusMeters, name } = req.body;
    const fence = await Geofence.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      { radiusMeters, name },
      { new: true }
    );
    res.json({ geofence: fence });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
