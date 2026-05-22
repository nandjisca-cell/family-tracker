const Geofence = require('../models/Geofence');
const User = require('../models/User');
const Alert = require('../models/Alert');
const geolib = require('geolib');

const checkGeofenceAlerts = async ({ userId, latitude, longitude, accuracy, timestamp, io, connectedUsers }) => {
  const [user, geofences] = await Promise.all([
    User.findById(userId).select('name'),
    Geofence.find({ targetUserId: userId, isActive: true }),
  ]);

  const userName = user?.name || 'User';

  for (const fence of geofences) {
    const distance = geolib.getDistance(
      { latitude, longitude },
      { latitude: fence.centerLat, longitude: fence.centerLng }
    );

    const wasInside = fence.userIsInside;
    const isInside = distance <= fence.radiusMeters;

    if (wasInside && !isInside) {
      const message = `${userName} left ${fence.name}. Distance from center: ${(distance / 1000).toFixed(2)} km.`;
      const adminInfo = connectedUsers?.get(fence.adminId.toString());

      if (adminInfo && io) {
        const payload = {
          type: 'range_exit',
          userId,
          userName,
          fenceId: fence._id,
          fenceName: fence.name,
          message,
          latitude,
          longitude,
          accuracy,
          distance,
          radiusMeters: fence.radiusMeters,
          timestamp: new Date(timestamp || Date.now()),
        };
        io.to(adminInfo.socketId).emit('geofence_alert', payload);
      }

      await Alert.create({
        type: 'range_exit',
        userId,
        userName,
        fenceId: fence._id,
        fenceName: fence.name,
        message,
        latitude,
        longitude,
        distance,
        radiusMeters: fence.radiusMeters,
      });

      fence.userIsInside = false;
      fence.lastAlertAt = new Date();
      await fence.save();
    } else if (!wasInside && isInside) {
      fence.userIsInside = true;
      await fence.save();
    }
  }
};

module.exports = { checkGeofenceAlerts };
