import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity,
  StatusBar, Platform, Linking, AppState, ActivityIndicator
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import LeafletMap from '../components/LeafletMap';
import {
  requestLocationPermission,
  checkLocationEnabled,
  startTracking,
  stopTracking,
  getCurrentLocation,
  reportLocationStatus,
} from '../services/locationService';
import { LocationAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const UserHomeScreen = () => {
  const { user, logout } = useAuth();
  const [location, setLocation] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [permGranted, setPermGranted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    checkAndRequestLocation();
    const sub = AppState.addEventListener('change', handleAppState);
    return () => {
      sub.remove();
      stopTracking();
    };
  }, []);

  const handleAppState = useCallback((state) => {
    if (state === 'active') {
      checkAndRequestLocation();
    }
  }, []);

  const checkAndRequestLocation = async () => {
    setChecking(true);
    
    // 1. Check permissions
    const granted = await requestLocationPermission();
    setPermGranted(granted);
    
    if (!granted) {
      await reportLocationStatus('permission_denied');
      setChecking(false);
      return;
    }

    // 2. Check if GPS is on
    const enabled = await checkLocationEnabled();
    setLocationEnabled(enabled);
    
    if (!enabled) {
      await reportLocationStatus('gps_off');
      setChecking(false);
      return;
    }

    // 3. Start tracking
    try {
      const coords = await getCurrentLocation();
      setLocation(coords);
      await reportLocationStatus('active', coords);
      setTracking(true);
      
      startTracking(user._id, (loc) => {
        setLocation({ latitude: loc.latitude, longitude: loc.longitude });
      });
    } catch (err) {
      console.error('Location error:', err);
    }
    
    setChecking(false);
  };

  const openSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    } else {
      Linking.openURL('app-settings:');
    }
  };

  const openLocationSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
    }
  };

  const sendSos = () => {
    Alert.alert('Send SOS Alert', 'Your admin will receive an emergency alert with your latest location.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send SOS',
        style: 'destructive',
        onPress: async () => {
          try {
            const coords = location || await getCurrentLocation();
            await LocationAPI.sos(coords);
            Alert.alert('SOS Sent', 'Your emergency alert has been sent to the admin.');
          } catch (err) {
            Alert.alert('SOS Failed', 'Could not send SOS. Please check your internet connection.');
          }
        },
      },
    ]);
  };

  // ============ FORCE LOCATION GATE ============
  if (checking) {
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3e']} style={styles.gateContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.gateText}>Checking location access...</Text>
      </LinearGradient>
    );
  }

  if (!permGranted) {
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3e']} style={styles.gateContainer}>
        <Text style={styles.gateIcon}>🚫</Text>
        <Text style={styles.gateTitle}>Location Required</Text>
        <Text style={styles.gateSubtitle}>
          Family Tracker requires location access to function.{'\n'}
          This app cannot be used without location permission.
        </Text>
        <TouchableOpacity style={styles.gateBtn} onPress={openSettings}>
          <Text style={styles.gateBtnText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gateBtnOutline} onPress={checkAndRequestLocation}>
          <Text style={styles.gateBtnOutlineText}>Retry</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  if (!locationEnabled) {
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3e']} style={styles.gateContainer}>
        <Text style={styles.gateIcon}>📍</Text>
        <Text style={styles.gateTitle}>Turn On Location</Text>
        <Text style={styles.gateSubtitle}>
          Your GPS is disabled.{'\n'}
          Please turn on location to use Family Tracker.
        </Text>
        <TouchableOpacity style={styles.gateBtn} onPress={openLocationSettings}>
          <Text style={styles.gateBtnText}>Enable GPS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gateBtnOutline} onPress={checkAndRequestLocation}>
          <Text style={styles.gateBtnOutlineText}>I've Enabled It</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // ============ MAIN USER VIEW ============
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />
      
      {/* Header */}
      <LinearGradient colors={['#0a0a1a', '#1a1a3e']} style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user.name} 👋</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, tracking ? styles.dotGreen : styles.dotRed]} />
            <Text style={styles.statusText}>
              {tracking ? 'Location Active' : 'Connecting...'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Map */}
      {location ? (
        <LeafletMap
          style={styles.map}
          center={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          zoom={17}
          markers={[{
            latitude: location.latitude,
            longitude: location.longitude,
            title: user.name,
            color: '#3b82f6',
          }]}
          circles={[{
            latitude: location.latitude,
            longitude: location.longitude,
            radius: 30,
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            strokeColor: '#3b82f6',
            strokeWidth: 1,
          }]}
        />
      ) : (
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.mapPlaceholderText}>Getting your location...</Text>
        </View>
      )}

      {/* Bottom Info */}
      <View style={styles.bottomCard}>
        <View style={styles.coordRow}>
          <View style={styles.coordItem}>
            <Text style={styles.coordLabel}>Latitude</Text>
            <Text style={styles.coordValue}>
              {location ? location.latitude.toFixed(6) : '--'}
            </Text>
          </View>
          <View style={styles.coordDivider} />
          <View style={styles.coordItem}>
            <Text style={styles.coordLabel}>Longitude</Text>
            <Text style={styles.coordValue}>
              {location ? location.longitude.toFixed(6) : '--'}
            </Text>
          </View>
        </View>
        <Text style={styles.trackingNote}>
          🔒 Your location is being shared with your family admin
        </Text>
        <TouchableOpacity style={styles.sosBtn} onPress={sendSos}>
          <Text style={styles.sosBtnText}>SOS Emergency</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },

  gateContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  gateIcon: { fontSize: 72, marginBottom: 16 },
  gateTitle: {
    fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 12,
  },
  gateSubtitle: {
    fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },
  gateText: { color: '#64748b', marginTop: 16, fontSize: 15 },
  gateBtn: {
    backgroundColor: '#3b82f6', borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 40, marginBottom: 12, width: '100%', alignItems: 'center',
  },
  gateBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  gateBtnOutline: {
    borderWidth: 1, borderColor: '#3b82f6', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center',
  },
  gateBtnOutlineText: { color: '#3b82f6', fontWeight: '700', fontSize: 16 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 52 : 20, paddingBottom: 16,
  },
  greeting: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  dotGreen: { backgroundColor: '#22c55e' },
  dotRed: { backgroundColor: '#ef4444' },
  statusText: { fontSize: 13, color: '#94a3b8' },
  logoutBtn: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },

  map: { flex: 1 },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
  mapPlaceholderText: { color: '#64748b', marginTop: 12, fontSize: 15 },

  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  markerPulse: {
    position: 'absolute', width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(59,130,246,0.3)', borderWidth: 2, borderColor: '#3b82f6',
  },
  marker: {
    backgroundColor: '#fff', borderRadius: 20, width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  markerText: { fontSize: 18 },

  bottomCard: {
    backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, borderTopWidth: 1, borderTopColor: 'rgba(59,130,246,0.2)',
  },
  coordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  coordItem: { flex: 1, alignItems: 'center' },
  coordLabel: { fontSize: 11, color: '#4a5568', fontWeight: '600', marginBottom: 4 },
  coordValue: { fontSize: 16, color: '#e2e8f0', fontWeight: '700', fontFamily: 'monospace' },
  coordDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },
  trackingNote: { textAlign: 'center', color: '#475569', fontSize: 12 },
  sosBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  sosBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});

export default UserHomeScreen;
