const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const User = require('../models/User');

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

// Admin: get all managed users' latest locations
router.get('/all-latest', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const admin = await User.findById(req.user._id).populate('managedUsers', 'name phone lastSeen');
    const userIds = admin.managedUsers.map(u => u._id);

    const latestLocations = await Promise.all(
      userIds.map(async (uid) => {
        const loc = await Location.findOne({ userId: uid }).sort({ timestamp: -1 });
        const user = admin.managedUsers.find(u => u._id.toString() === uid.toString());
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
