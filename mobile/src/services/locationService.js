import Geolocation from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { emitLocation } from './socket';
import { LocationAPI } from './api';

let watchId = null;
let locationInterval = null;
let statusInterval = null;

const getBatteryLevel = async () => {
  try {
    const level = await DeviceInfo.getBatteryLevel();
    return Math.round(level * 100);
  } catch (err) {
    return null;
  }
};

export const reportLocationStatus = async (status, coords = null) => {
  try {
    const batteryLevel = await getBatteryLevel();
    await LocationAPI.status({
      status,
      batteryLevel,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    });
  } catch (err) {
    // Best-effort health update; tracking must continue even if this fails.
  }
};

export const requestLocationPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const fineGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Family Centre - Location Access',
          message: 'Family Centre needs your location to keep your family safe. Location access is REQUIRED to use this app.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );

      const bgGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title: 'Background Location Required',
          message: 'Allow Family Centre to track location in the background for continuous safety monitoring.',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow Always',
        }
      );

      const allowed = (
        fineGranted === PermissionsAndroid.RESULTS.GRANTED &&
        bgGranted === PermissionsAndroid.RESULTS.GRANTED
      );
      if (!allowed) {
        await reportLocationStatus('permission_denied');
      }
      return allowed;
    } catch (err) {
      console.warn(err);
      await reportLocationStatus('permission_denied');
      return false;
    }
  }
  return true; // iOS handles via Info.plist
};

export const checkLocationEnabled = () => {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      () => resolve(true),
      (error) => {
        if (error.code === 2) resolve(false); // Location disabled
        else resolve(true);
      },
      { timeout: 5000 }
    );
  });
};

export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) => reject(error),
      {
        accuracy: { android: 'high', ios: 'best' },
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
        forceRequestLocation: true,
      }
    );
  });
};

export const startTracking = (userId, onUpdate) => {
  if (watchId !== null) stopTracking();

  watchId = Geolocation.watchPosition(
    async (position) => {
      const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;
      const locationData = {
        userId,
        latitude,
        longitude,
        accuracy,
        speed: speed || 0,
        heading: heading || 0,
        altitude: altitude || 0,
        timestamp: position.timestamp,
      };

      // Emit via socket (real-time)
      emitLocation(locationData);

      // Also save to server via HTTP
      try {
        await LocationAPI.update({ latitude, longitude, accuracy, speed, heading, altitude });
        await reportLocationStatus('active', { latitude, longitude });
      } catch (e) {
        // Ignore - socket handles real-time
      }

      if (onUpdate) onUpdate(locationData);
    },
    (error) => {
      console.error('Watch position error:', error);
    },
    {
      accuracy: { android: 'high', ios: 'best' },
      enableHighAccuracy: true,
      distanceFilter: 10, // Update every 10 meters
      interval: 15000,    // Android: every 15 seconds
      fastestInterval: 10000,
      forceRequestLocation: true,
      showLocationDialog: true,
    }
  );

  console.log('Location tracking started, watchId:', watchId);
  statusInterval = setInterval(async () => {
    try {
      const coords = await getCurrentLocation();
      await reportLocationStatus('active', coords);
    } catch (error) {
      if (error?.code === 2) {
        await reportLocationStatus('gps_off');
      } else if (error?.code === 1) {
        await reportLocationStatus('permission_denied');
      } else {
        await reportLocationStatus('unknown');
      }
    }
  }, 60000);

  return watchId;
};

export const stopTracking = () => {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
    console.log('Location tracking stopped');
  }
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
};

