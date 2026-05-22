require('dotenv').config();
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const locationRoutes = require('./routes/location');
const geofenceRoutes = require('./routes/geofence');
const adminRoutes = require('./routes/admin');
const { authenticateToken } = require('./middleware/auth');
const { cleanOldLocations } = require('./utils/cleanup');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Make io accessible in routes
app.set('io', io);

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/family-tracker';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/location', authenticateToken, locationRoutes);
app.use('/api/geofence', authenticateToken, geofenceRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Socket.IO for real-time location
const connectedUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('📱 Client connected:', socket.id);

  socket.on('register', (data) => {
    const { userId, role } = data;
    connectedUsers.set(userId, { socketId: socket.id, role });
    socket.userId = userId;
    socket.role = role;
    console.log(`✅ Registered: ${userId} as ${role}`);
  });

  // User sends live location
  socket.on('location_update', async (data) => {
    const { userId, latitude, longitude, timestamp, accuracy } = data;
    
    try {
      const Location = require('./models/Location');
      const Geofence = require('./models/Geofence');
      const geolib = require('geolib');

      // Save location to DB
      const loc = new Location({
        userId,
        latitude,
        longitude,
        accuracy,
        timestamp: new Date(timestamp)
      });
      await loc.save();

      // Broadcast to all admin sockets
      for (const [uid, info] of connectedUsers.entries()) {
        if (info.role === 'admin') {
          io.to(info.socketId).emit('user_location', {
            userId,
            latitude,
            longitude,
            timestamp,
            accuracy
          });
        }
      }

      // Check geofence violations
      const geofences = await Geofence.find({ targetUserId: userId, isActive: true });
      for (const fence of geofences) {
        const distance = geolib.getDistance(
          { latitude, longitude },
          { latitude: fence.centerLat, longitude: fence.centerLng }
        );
        
        const wasInside = fence.userIsInside;
        const isInside = distance <= fence.radiusMeters;
        
        if (wasInside && !isInside) {
          // User left geofence - alert admin
          const adminInfo = connectedUsers.get(fence.adminId.toString());
          if (adminInfo) {
            io.to(adminInfo.socketId).emit('geofence_alert', {
              userId,
              fenceId: fence._id,
              message: `⚠️ User left geofence zone!`,
              latitude,
              longitude,
              distance,
              timestamp: new Date()
            });
          }
          // Update fence status
          fence.userIsInside = false;
          await fence.save();
        } else if (!wasInside && isInside) {
          fence.userIsInside = true;
          await fence.save();
        }
      }
    } catch (err) {
      console.error('Location update error:', err);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }
    console.log('📴 Client disconnected:', socket.id);
  });
});

// Cron: Delete location records older than 12 hours
cron.schedule('*/30 * * * *', async () => {
  await cleanOldLocations();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Family Tracker Server running on port ${PORT}`);
});

module.exports = { io, connectedUsers };
