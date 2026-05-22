import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from '../config/server';

let socket = null;

export const connectSocket = async (userId, role) => {
  if (socket?.connected) return socket;

  socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
    socket.emit('register', { userId, role });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected');
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const emitLocation = (locationData) => {
  if (socket?.connected) {
    socket.emit('location_update', locationData);
  }
};

export const onUserLocation = (callback) => {
  socket?.on('user_location', callback);
};

export const onGeofenceAlert = (callback) => {
  socket?.on('geofence_alert', callback);
};

export const offUserLocation = () => {
  socket?.off('user_location');
};

export const offGeofenceAlert = () => {
  socket?.off('geofence_alert');
};
