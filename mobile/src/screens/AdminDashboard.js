import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Platform, Alert, FlatList, Modal, TextInput
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import LeafletMap from '../components/LeafletMap';
import { AdminAPI, LocationAPI, GeofenceAPI } from '../services/api';
import { onUserLocation, onGeofenceAlert, offUserLocation, offGeofenceAlert } from '../services/socket';
import { triggerGeofenceAlert, stopAlert } from '../services/alertService';
import { useAuth } from '../hooks/useAuth';

const AdminDashboard = () => {
  const { user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [userLocations, setUserLocations] = useState({}); // userId -> {lat, lng, name}
  const [selectedUser, setSelectedUser] = useState(null);
  const [historyPath, setHistoryPath] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [rangeTemplates, setRangeTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState({ latitude: 23.0225, longitude: 72.5714 });

  const [tab, setTab] = useState('map');

  // Geofence modal
  const [showFenceModal, setShowFenceModal] = useState(false);
  const [fenceMode, setFenceMode] = useState('single');
  const [fenceUser, setFenceUser] = useState(null);
  const [fenceLat, setFenceLat] = useState('');
  const [fenceLng, setFenceLng] = useState('');
  const [fenceRadius, setFenceRadius] = useState('500');
  const [fenceName, setFenceName] = useState('Safe Zone');

  // Alert state
  const [activeAlert, setActiveAlert] = useState(null);

  useEffect(() => {
    loadData();
    setupSocketListeners();
    return () => {
      offUserLocation();
      offGeofenceAlert();
      stopAlert();
    };
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, fencesRes, alertsRes, templatesRes] = await Promise.all([
        AdminAPI.users(),
        GeofenceAPI.list(),
        AdminAPI.alerts(),
        AdminAPI.rangeTemplates(),
      ]);
      setUsers(usersRes.data.users || []);
      setGeofences(fencesRes.data.geofences || []);
      setAlerts(alertsRes.data.alerts || []);
      setRangeTemplates(templatesRes.data.templates || []);

      // Load latest locations
      const latestRes = await LocationAPI.allLatest();
      const locMap = {};
      for (const item of latestRes.data.users) {
        if (item.location) {
          locMap[item.user._id] = {
            latitude: item.location.latitude,
            longitude: item.location.longitude,
            name: item.user.name,
            lastSeen: item.user.lastSeen,
            lastBatteryLevel: item.user.lastBatteryLevel,
            locationStatus: item.user.locationStatus,
            lastStatusAt: item.user.lastStatusAt,
          };
        }
      }
      setUserLocations(locMap);
    } catch (err) {
      console.error('Load data error:', err);
    }
  };

  const setupSocketListeners = () => {
    onUserLocation((data) => {
      setUserLocations((prev) => ({
        ...prev,
        [data.userId]: {
          latitude: data.latitude,
          longitude: data.longitude,
          name: data.name || prev[data.userId]?.name,
          lastSeen: data.timestamp,
        },
      }));
    });

    onGeofenceAlert((data) => {
      setActiveAlert(data);
      triggerGeofenceAlert(data);
    });
  };

  const selectUser = async (usr) => {
    setSelectedUser(usr);
    setTab('map');
    try {
      const [histRes, hiRes] = await Promise.all([
        LocationAPI.history(usr._id),
        LocationAPI.highlights(usr._id),
      ]);
      const path = histRes.data.locations.map(l => ({
        latitude: l.latitude,
        longitude: l.longitude,
      }));
      setHistoryPath(path);
      setHighlights(histRes.data.locations.filter(l => l.isHighlighted));

      const loc = userLocations[usr._id];
      if (loc) {
        setMapCenter({
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      }
    } catch (err) {
      console.error('Select user error:', err);
    }
  };

  const openFenceModal = (usr) => {
    setFenceMode('single');
    setFenceUser(usr);
    const loc = userLocations[usr._id];
    if (loc) {
      setFenceLat(loc.latitude.toString());
      setFenceLng(loc.longitude.toString());
    }
    setShowFenceModal(true);
  };

  const openAllRangeModal = () => {
    setFenceMode('all');
    setFenceUser(null);
    setFenceName('Allowed Range');
    setFenceRadius('5000');
    setFenceLat(mapCenter.latitude.toString());
    setFenceLng(mapCenter.longitude.toString());
    setShowFenceModal(true);
  };

  const createGeofence = async () => {
    if ((fenceMode === 'single' && !fenceUser) || !fenceLat || !fenceLng || !fenceRadius) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    try {
      const payload = {
        centerLat: parseFloat(fenceLat),
        centerLng: parseFloat(fenceLng),
        radiusMeters: parseInt(fenceRadius),
        name: fenceName,
      };

      if (fenceMode === 'all') {
        const res = await GeofenceAPI.createAll(payload);
        await AdminAPI.createRangeTemplate(payload).catch(() => {});
        Alert.alert('Success', `Range applied to ${res.data.count} users.`);
      } else {
        await GeofenceAPI.create({
          ...payload,
          targetUserId: fenceUser._id,
        });
        Alert.alert('Success', `Range "${fenceName}" created for ${fenceUser.name}.`);
      }

      setShowFenceModal(false);
      await loadData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create range');
    }
  };

  const applyTemplate = (template) => {
    setFenceMode('all');
    setFenceUser(null);
    setFenceName(template.name);
    setFenceRadius(String(template.radiusMeters));
    setFenceLat(String(template.centerLat));
    setFenceLng(String(template.centerLng));
    setShowFenceModal(true);
  };

  const deleteTemplate = async (template) => {
    Alert.alert('Delete Template', `Delete "${template.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await AdminAPI.deleteRangeTemplate(template._id);
          await loadData();
        },
      },
    ]);
  };

  const acknowledgeAlert = async (alert) => {
    try {
      await AdminAPI.acknowledgeAlert(alert._id);
      setAlerts((prev) => prev.map((item) => item._id === alert._id ? { ...item, acknowledged: true } : item));
    } catch (err) {
      Alert.alert('Error', 'Failed to acknowledge alert');
    }
  };

  const deleteUser = (usr) => {
    Alert.alert('Delete User', `Delete ${usr.name} and all saved location data? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await AdminAPI.deleteUser(usr._id);
            if (selectedUser?._id === usr._id) {
              setSelectedUser(null);
              setHistoryPath([]);
              setHighlights([]);
            }
            await loadData();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to delete user');
          }
        },
      },
    ]);
  };


  const deleteGeofence = async (id) => {
    Alert.alert('Delete Geofence', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await GeofenceAPI.delete(id);
          loadData();
        }
      }
    ]);
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return u.name?.toLowerCase().includes(query) || u.phone?.includes(query);
  });

  const isUserOnline = (u) => (
    u.lastSeen && (Date.now() - new Date(u.lastSeen).getTime()) < 2 * 60 * 1000
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {['map', 'users', 'geofence', 'alerts', 'templates'].map((t) => (
        <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
          <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
            {t === 'map' ? 'Map' : t === 'users' ? 'Users' : t === 'geofence' ? 'Zones' : t === 'alerts' ? 'Alerts' : 'Templates'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

      {/* Alert Banner */}
      {activeAlert && (
        <TouchableOpacity style={styles.alertBanner} onPress={() => { setActiveAlert(null); stopAlert(); }}>
          <Text style={styles.alertBannerText}>Alert: {activeAlert.message} - Tap to dismiss</Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <LinearGradient colors={['#0a0a1a', '#1a1a3e']} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSub}>{users.length} members tracked</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </LinearGradient>

      {renderTabBar()}

      {/* MAP TAB */}
      {tab === 'map' && (
        <View style={styles.flex}>
          <LeafletMap
            style={styles.map}
            center={mapCenter}
            zoom={selectedUser ? 15 : 12}
            onMapPress={(coords) => {
              setMapCenter(coords);
              setFenceLat(coords.latitude.toString());
              setFenceLng(coords.longitude.toString());
            }}
            markers={[
              ...Object.entries(userLocations).map(([uid, loc]) => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
                title: loc.name?.split(' ')[0] || 'User',
                color: uid === selectedUser?._id ? '#22c55e' : '#2563eb',
              })),
              ...highlights.map((h) => ({
                latitude: h.latitude,
                longitude: h.longitude,
                title: `Stopped ${Math.round(h.dwellMinutes)}min`,
                color: '#eab308',
              })),
            ]}
            polylines={historyPath.length > 1 ? [{
              coordinates: historyPath,
              color: '#3b82f6',
              width: 3,
            }] : []}
            circles={[
              ...highlights.map((h) => ({
                latitude: h.latitude,
                longitude: h.longitude,
                radius: 20,
                fillColor: '#eab308',
                fillOpacity: 0.2,
                strokeColor: '#eab308',
                strokeWidth: 2,
              })),
              ...geofences.map((f) => ({
                latitude: f.centerLat,
                longitude: f.centerLng,
                radius: f.radiusMeters,
                fillColor: '#ef4444',
                fillOpacity: 0.08,
                strokeColor: '#ef4444',
                strokeWidth: 2,
              })),
            ]}
          />

          {/* User chips at bottom */}
          <ScrollView horizontal style={styles.chipScroll} showsHorizontalScrollIndicator={false}>
            {users.map((u) => (
              <TouchableOpacity
                key={u._id}
                style={[styles.chip, selectedUser?._id === u._id && styles.chipActive]}
                onPress={() => selectUser(u)}
              >
                <Text style={styles.chipText}>{u.name}</Text>
                <View style={[styles.chipDot, userLocations[u._id] ? styles.chipDotGreen : styles.chipDotRed]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* USERS TAB */}
      {tab === 'users' && (
        <FlatList
          data={filteredUsers}
          keyExtractor={(u) => u._id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search users by name or phone"
              placeholderTextColor="#64748b"
            />
          }
          renderItem={({ item: u }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{u.name}</Text>
                <Text style={styles.userPhone}>{u.phone}</Text>
                <Text style={styles.userStatus}>
                  {isUserOnline(u) ? 'Online now' : u.lastSeen ? `Offline - last seen ${new Date(u.lastSeen).toLocaleTimeString()}` : 'Never seen'}
                </Text>
                <Text style={styles.userStatus}>
                  Status: {u.locationStatus || userLocations[u._id]?.locationStatus || 'unknown'}
                  {typeof (u.lastBatteryLevel ?? userLocations[u._id]?.lastBatteryLevel) === 'number'
                    ? ` | Battery: ${u.lastBatteryLevel ?? userLocations[u._id]?.lastBatteryLevel}%`
                    : ''}
                </Text>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => selectUser(u)}>
                  <Text style={styles.actionBtnText}>Track</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.fenceBtn]} onPress={() => openFenceModal(u)}>
                  <Text style={styles.actionBtnText}>Range</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.deleteUserBtn]} onPress={() => deleteUser(u)}>
                  <Text style={styles.actionBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* GEOFENCE TAB */}
      {tab === 'geofence' && (
        <FlatList
          data={geofences}
          keyExtractor={(f) => f._id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <TouchableOpacity style={styles.rangeAllBtn} onPress={openAllRangeModal}>
              <Text style={styles.rangeAllBtnText}>Set Range for All Users</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No ranges created yet.{'\n'}Create a range for one user or all users.</Text>
          }
          renderItem={({ item: f }) => (
            <View style={styles.fenceCard}>
              <View style={styles.fenceIcon}><Text style={{ fontSize: 20, color: '#ef4444' }}>Zone</Text></View>
              <View style={styles.fenceInfo}>
                <Text style={styles.fenceName}>{f.name}</Text>
                <Text style={styles.fenceUser}>User: {f.targetUserId?.name || 'Unknown'}</Text>
                <Text style={styles.fenceRadius}>Radius: {f.radiusMeters}m</Text>
                <Text style={styles.fenceCoords}>
                  {f.centerLat.toFixed(4)}, {f.centerLng.toFixed(4)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deleteGeofence(f._id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* ALERTS TAB */}
      {tab === 'alerts' && (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No alerts yet.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.alertCard, item.acknowledged && styles.alertCardDone]}>
              <View style={styles.userInfo}>
                <Text style={styles.alertTitle}>{item.userName || 'User'} - {item.type?.replace(/_/g, ' ')}</Text>
                <Text style={styles.alertMessage}>{item.message}</Text>
                <Text style={styles.userStatus}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                </Text>
              </View>
              {!item.acknowledged && (
                <TouchableOpacity style={styles.ackBtn} onPress={() => acknowledgeAlert(item)}>
                  <Text style={styles.actionBtnText}>Ack</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* TEMPLATES TAB */}
      {tab === 'templates' && (
        <FlatList
          data={rangeTemplates}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <TouchableOpacity style={styles.rangeAllBtn} onPress={openAllRangeModal}>
              <Text style={styles.rangeAllBtnText}>Create Range Template</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No templates yet. Apply a range to all users to save one.</Text>}
          renderItem={({ item }) => (
            <View style={styles.fenceCard}>
              <View style={styles.fenceInfo}>
                <Text style={styles.fenceName}>{item.name}</Text>
                <Text style={styles.fenceRadius}>Radius: {item.radiusMeters}m</Text>
                <Text style={styles.fenceCoords}>
                  {item.centerLat.toFixed(4)}, {item.centerLng.toFixed(4)}
                </Text>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => applyTemplate(item)}>
                  <Text style={styles.actionBtnText}>Apply</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.deleteUserBtn]} onPress={() => deleteTemplate(item)}>
                  <Text style={styles.actionBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Geofence Create Modal */}
      <Modal visible={showFenceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Allowed Range</Text>
            <Text style={styles.modalSub}>{fenceMode === 'all' ? 'for all active users' : `for ${fenceUser?.name}`}</Text>

            <Text style={styles.modalLabel}>Range Name</Text>
            <TextInput style={styles.modalInput} value={fenceName} onChangeText={setFenceName} placeholder="e.g. Home, School, Office" placeholderTextColor="#4a5568" />

            <Text style={styles.modalLabel}>Center Latitude</Text>
            <TextInput style={styles.modalInput} value={fenceLat} onChangeText={setFenceLat} placeholder="e.g. 23.0225" keyboardType="decimal-pad" placeholderTextColor="#4a5568" />

            <Text style={styles.modalLabel}>Center Longitude</Text>
            <TextInput style={styles.modalInput} value={fenceLng} onChangeText={setFenceLng} placeholder="e.g. 72.5714" keyboardType="decimal-pad" placeholderTextColor="#4a5568" />

            <Text style={styles.modalLabel}>Radius (meters)</Text>
            <TextInput style={styles.modalInput} value={fenceRadius} onChangeText={setFenceRadius} placeholder="e.g. 500" keyboardType="number-pad" placeholderTextColor="#4a5568" />

            <View style={styles.radiusPresets}>
              {[
                ['5 km', '5000'],
                ['10 km', '10000'],
                ['25 km', '25000'],
              ].map(([label, value]) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.presetBtn, fenceRadius === value && styles.presetBtnActive]}
                  onPress={() => setFenceRadius(value)}
                >
                  <Text style={[styles.presetText, fenceRadius === value && styles.presetTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalHint}>
              The admin will receive an alert with the user's name when the user leaves this range.
            </Text>

            <TouchableOpacity style={styles.modalBtn} onPress={createGeofence}>
              <Text style={styles.modalBtnText}>{fenceMode === 'all' ? 'Apply to All Users' : 'Create Range'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowFenceModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  flex: { flex: 1 },

  alertBanner: {
    backgroundColor: '#dc2626', padding: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  alertBannerText: { color: '#fff', textAlign: 'center', fontWeight: '800', fontSize: 14 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 52 : 20, paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },

  tabBar: { flexDirection: 'row', backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(59,130,246,0.15)' },
  tabText: { fontSize: 13, color: '#4a5568', fontWeight: '600' },
  tabTextActive: { color: '#3b82f6' },

  map: { flex: 1 },
  chipScroll: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(10,10,26,0.9)', paddingVertical: 12, paddingHorizontal: 8,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)' },
  chipText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', marginRight: 6 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipDotGreen: { backgroundColor: '#22c55e' },
  chipDotRed: { backgroundColor: '#ef4444' },

  adminMarker: { alignItems: 'center' },
  adminMarkerText: { fontSize: 28 },
  adminMarkerName: {
    backgroundColor: '#1d4ed8', color: '#fff', fontSize: 10, fontWeight: '700',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 2,
  },
  stopMarker: {
    backgroundColor: '#eab308', borderRadius: 16, padding: 6,
    borderWidth: 2, borderColor: '#fff',
  },
  stopMarkerText: { fontSize: 16 },

  listContent: { padding: 16 },
  emptyText: { textAlign: 'center', color: '#4a5568', fontSize: 15, marginTop: 48, lineHeight: 24 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#fff',
    fontSize: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  userCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16,
    marginBottom: 12, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '800', color: '#fff' },
  userPhone: { fontSize: 13, color: '#64748b', marginTop: 2 },
  userStatus: { fontSize: 12, color: '#475569', marginTop: 4 },
  userActions: { gap: 8 },
  actionBtn: {
    backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
  },
  fenceBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)',
  },
  deleteUserBtn: {
    backgroundColor: 'rgba(220,38,38,0.18)', borderColor: 'rgba(220,38,38,0.4)',
  },
  actionBtnText: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  ackBtn: {
    backgroundColor: 'rgba(34,197,94,0.16)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },

  alertCard: {
    backgroundColor: 'rgba(239,68,68,0.09)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.26)',
  },
  alertCardDone: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  alertTitle: { fontSize: 15, fontWeight: '800', color: '#fff', textTransform: 'capitalize' },
  alertMessage: { fontSize: 13, color: '#cbd5e1', marginTop: 4, lineHeight: 18 },

  rangeAllBtn: {
    backgroundColor: 'rgba(59,130,246,0.16)', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.32)',
  },
  rangeAllBtnText: { color: '#93c5fd', fontSize: 15, fontWeight: '800' },

  fenceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16,
    marginBottom: 12, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  fenceIcon: { marginRight: 12 },
  fenceInfo: { flex: 1 },
  fenceName: { fontSize: 17, fontWeight: '800', color: '#fff' },
  fenceUser: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  fenceRadius: { fontSize: 12, color: '#64748b', marginTop: 2 },
  fenceCoords: { fontSize: 11, color: '#475569', marginTop: 2, fontFamily: 'monospace' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 22 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  modalLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginBottom: 6, marginTop: 12 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  radiusPresets: { flexDirection: 'row', gap: 8, marginTop: 10 },
  presetBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  presetBtnActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.18)' },
  presetText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  presetTextActive: { color: '#93c5fd' },
  modalHint: { fontSize: 12, color: '#4a5568', marginTop: 12, lineHeight: 18 },
  modalBtn: {
    backgroundColor: '#ef4444', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 20,
  },
  modalBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalCancelBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  modalCancelText: { color: '#64748b', fontSize: 15 },
});

export default AdminDashboard;

