const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const User = require('../models/User');
const Alert = require('../models/Alert');
const { checkGeofenceAlerts } = require('../utils/geofenceAlerts');

const emitAdminAlert = (req, payload) => {
  const io = req.app.get('io');
  const connectedUsers = req.app.get('connectedUsers');
  if (!io || !connectedUsers) return;
  for (const [, info] of connectedUsers.entries()) {
    if (info.role === 'admin') {
      io.to(info.socketId).emit('geofence_alert', payload);
    }
  }
};

// User: update own location
router.post('/update', async (req, res) => {
  try {
    const { latitude, longitude, accuracy, speed, heading, altitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    // Update user's last seen
    await User.findByIdAndUpdate(req.user._id, { lastSeen: new Date() });

    // Save to DB
    const loc = new Location({
      userId: req.user._id,
      latitude, longitude, accuracy, speed, heading, altitude,
      timestamp: new Date()
    });
    await loc.save();
    await checkGeofenceAlerts({
      userId: req.user._id,
      latitude,
      longitude,
      accuracy,
      timestamp: loc.timestamp,
      io: req.app.get('io'),
      connectedUsers: req.app.get('connectedUsers'),
    });

    // Also emit via socket if available
    const io = req.app.get('io');
    if (io) {
      io.emit('user_location', {
        userId: req.user._id,
        name: req.user.name,
        latitude, longitude, accuracy,
        timestamp: new Date()
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/status', async (req, res) => {
  try {
    const { status, batteryLevel, latitude, longitude } = req.body;
    const updates = {
      locationStatus: status || 'unknown',
      lastStatusAt: new Date(),
      lastSeen: new Date(),
    };
    if (typeof batteryLevel === 'number') updates.lastBatteryLevel = batteryLevel;
    await User.findByIdAndUpdate(req.user._id, updates);

    const alerts = [];
    if (status === 'gps_off' || status === 'permission_denied') {
      alerts.push({
        type: status,
        userId: req.user._id,
        userName: req.user.name,
        message: `${req.user.name} ${status === 'gps_off' ? 'turned off GPS' : 'disabled location permission'}.`,
        latitude,
        longitude,
      });
    }
    if (typeof batteryLevel === 'number' && batteryLevel <= 15) {
      alerts.push({
        type: 'battery_low',
        userId: req.user._id,
        userName: req.user.name,
        message: `${req.user.name}'s phone battery is low (${batteryLevel}%).`,
        latitude,
        longitude,
      });
    }

    for (const alert of alerts) {
      await Alert.create(alert);
      emitAdminAlert(req, { ...alert, timestamp: new Date() });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sos', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const alert = await Alert.create({
      type: 'sos',
      userId: req.user._id,
      userName: req.user.name,
      message: `${req.user.name} sent an SOS alert.`,
      latitude,
      longitude,
    });
    emitAdminAlert(req, {
      type: 'sos',
      userId: req.user._id,
      userName: req.user.name,
      message: alert.message,
      latitude,
      longitude,
      timestamp: alert.createdAt,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: get user's last 12h history
router.get('/history/:userId', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      // User can only get their own history
      if (req.params.userId !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    const locations = await Location.getLast12Hours(req.params.userId);
    res.json({ locations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: get all family users' latest locations
router.get('/all-latest', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const users = await User.find({ role: 'user', isActive: true })
      .select('name phone lastSeen lastBatteryLevel locationStatus lastStatusAt')
      .sort({ lastSeen: -1, createdAt: -1 });

    const latestLocations = await Promise.all(
      users.map(async (user) => {
        const loc = await Location.findOne({ userId: user._id }).sort({ timestamp: -1 });
        return { user, location: loc };
      })
    );

    res.json({ users: latestLocations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: get stop highlights for a user
router.get('/highlights/:userId', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const locations = await Location.getLast12Hours(req.params.userId);
    const highlights = locations.filter(l => l.isHighlighted);
    res.json({ highlights });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
