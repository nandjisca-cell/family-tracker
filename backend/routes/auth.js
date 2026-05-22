const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, authenticateToken } = require('../middleware/auth');

// Register (Admin creates users, or first-time setup)
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, role, adminCode } = req.body;
    
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, phone, and password required' });
    }

    // Admin registration requires secret code
    if (role === 'admin') {
      const ADMIN_CODE = process.env.ADMIN_CODE || 'FAMILY2024';
      if (adminCode !== ADMIN_CODE) {
        return res.status(403).json({ error: 'Invalid admin code' });
      }
    }

    const existing = await User.findOne({ phone });
    if (existing) return res.status(409).json({ error: 'Phone number already registered' });

    const user = new User({ name, phone, password, role: role || 'user' });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ token, user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { phone, password, deviceId, fcmToken } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password required' });
    }

    const user = await User.findOne({ phone });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // Admin: enforce single device login
    if (user.role === 'admin' && deviceId) {
      if (user.deviceId && user.deviceId !== deviceId) {
        return res.status(403).json({ 
          error: 'Admin already logged in on another device. Contact support to reset.' 
        });
      }
      user.deviceId = deviceId;
    }

    // Save FCM token for push notifications
    if (fcmToken) user.deviceToken = fcmToken;
    user.lastSeen = new Date();
    await user.save();

    const token = generateToken(user._id);
    res.json({ token, user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Logout (clear device lock for admin)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      req.user.deviceId = null;
    }
    await req.user.save();
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Admin creates a new user
router.post('/create-user', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can create users' });
    }
    const { name, phone, password } = req.body;
    
    const existing = await User.findOne({ phone });
    if (existing) return res.status(409).json({ error: 'Phone already exists' });

    const user = new User({ 
      name, phone, password, role: 'user',
      adminId: req.user._id
    });
    await user.save();

    // Add to admin's managed list
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { managedUsers: user._id }
    });

    res.status(201).json({ user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
