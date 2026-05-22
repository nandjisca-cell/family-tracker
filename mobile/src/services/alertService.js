import { Vibration, Platform, Alert } from 'react-native';
import PushNotification from 'react-native-push-notification';

// Configure PushNotification
PushNotification.configure({
  onRegister: (token) => {
    console.log('FCM Token:', token);
  },
  onNotification: (notification) => {
    console.log('Notification received:', notification);
  },
  permissions: { alert: true, badge: true, sound: true },
  popInitialNotification: true,
  requestPermissions: true,
});

// Create notification channel (Android)
PushNotification.createChannel({
  channelId: 'geofence-alerts',
  channelName: 'Geofence Alerts',
  channelDescription: 'Alerts when family member leaves safe zone',
  soundName: 'default',
  importance: 5,
  vibrate: true,
});

const VIBRATION_PATTERN = [500, 500, 500, 500, 500, 500, 500, 500, 500, 500];

export const triggerGeofenceAlert = (data) => {
  const { userName, message } = data;

  // Vibrate intensely
  Vibration.vibrate(VIBRATION_PATTERN, true);

  // Local notification
  PushNotification.localNotification({
    channelId: 'geofence-alerts',
    title: 'Range Alert',
    message: message || `${userName || 'A family member'} has left the allowed range.`,
    importance: 'high',
    priority: 'high',
    playSound: true,
    soundName: 'default',
    vibrate: true,
    vibration: 1000,
    ongoing: false,
    autoCancel: true,
    largeIcon: 'ic_launcher',
    smallIcon: 'ic_notification',
    actions: ['View Location', 'Dismiss'],
  });

  // Show alert dialog
  Alert.alert(
    'Range Alert',
    message || `${userName || 'A family member'} has left the allowed range.`,
    [
      { text: 'Dismiss', style: 'cancel', onPress: () => Vibration.cancel() },
      { text: 'View Map', onPress: () => Vibration.cancel() },
    ],
    { cancelable: false }
  );
};

export const stopAlert = () => {
  Vibration.cancel();
};

export const sendLocalNotification = (title, message) => {
  PushNotification.localNotification({
    channelId: 'geofence-alerts',
    title,
    message,
    importance: 'default',
    priority: 'default',
    playSound: false,
  });
};
