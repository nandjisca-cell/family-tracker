const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Admin: list all managed users
router.get('/users', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const admin = await User.findById(req.user._id)
      .populate('managedUsers', 'name phone lastSeen isActive');
    res.json({ users: admin.managedUsers });
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
