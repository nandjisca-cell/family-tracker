const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Location = require('../models/Location');
const Geofence = require('../models/Geofence');
const Alert = require('../models/Alert');
const RangeTemplate = require('../models/RangeTemplate');

// Admin: list all family users
router.get('/users', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const users = await User.find({ role: 'user', isActive: true })
      .select('name phone lastSeen isActive lastBatteryLevel locationStatus lastStatusAt')
      .sort({ lastSeen: -1, createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: deactivate user
router.put('/users/:id/deactivate', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: permanently delete a family user and related tracking data
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const user = await User.findOne({ _id: req.params.id, role: 'user' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await Promise.all([
      Location.deleteMany({ userId: user._id }),
      Geofence.deleteMany({ targetUserId: user._id }),
      User.updateMany({}, { $pull: { managedUsers: user._id } }),
      User.deleteOne({ _id: user._id }),
    ]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: alert history
router.get('/alerts', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const alerts = await Alert.find({})
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/alerts/:id/ack', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true },
      { new: true }
    );
    res.json({ alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: reusable range templates
router.get('/range-templates', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const templates = await RangeTemplate.find({ adminId: req.user._id }).sort({ createdAt: -1 });
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/range-templates', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { name, centerLat, centerLng, radiusMeters } = req.body;
    if (!name || centerLat === undefined || centerLng === undefined || !radiusMeters) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const template = await RangeTemplate.create({
      adminId: req.user._id,
      name,
      centerLat,
      centerLng,
      radiusMeters,
    });
    res.status(201).json({ template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/range-templates/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    await RangeTemplate.findOneAndDelete({ _id: req.params.id, adminId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: reset own device lock (e.g., if phone changed)
router.post('/reset-device', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { resetCode } = req.body;
    const RESET_CODE = process.env.DEVICE_RESET_CODE || 'RESET2024';
    if (resetCode !== RESET_CODE) {
      return res.status(403).json({ error: 'Invalid reset code' });
    }
    await User.findByIdAndUpdate(req.user._id, { deviceId: null });
    res.json({ success: true, message: 'Device lock cleared. Login from new device.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
