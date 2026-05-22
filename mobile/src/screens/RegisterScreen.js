import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, StatusBar
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AuthAPI } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';

const RegisterScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [adminCode, setAdminCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !phone || !password) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (role === 'admin' && !adminCode) {
      Alert.alert('Error', 'Admin code required for admin registration');
      return;
    }

    setLoading(true);
    try {
      await AuthAPI.register(name, phone, password, role, adminCode);
      Alert.alert('✅ Account Created', 'Login with your credentials', [
        { text: 'Login', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      const message = err.response?.data?.error
        || (err.request ? 'Unable to connect to the server. Please check your internet connection and server URL.' : 'Please try again');
      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3e', '#0d2137']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Family Tracker</Text>

          <View style={styles.card}>
            {/* Role selector */}
            <Text style={styles.label}>Account Type</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'user' && styles.roleBtnActive]}
                onPress={() => setRole('user')}
              >
                <Text style={styles.roleIcon}>👤</Text>
                <Text style={[styles.roleText, role === 'user' && styles.roleTextActive]}>Family Member</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'admin' && styles.roleBtnActive]}
                onPress={() => setRole('admin')}
              >
                <Text style={styles.roleIcon}>🛡️</Text>
                <Text style={[styles.roleText, role === 'admin' && styles.roleTextActive]}>Admin</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter your name" placeholderTextColor="#4a5568" />

            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" placeholderTextColor="#4a5568" />

            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Create a strong password" secureTextEntry placeholderTextColor="#4a5568" />

            {role === 'admin' && (
              <>
                <Text style={styles.label}>Admin Code</Text>
                <TextInput
                  style={[styles.input, styles.adminInput]}
                  value={adminCode}
                  onChangeText={setAdminCode}
                  placeholder="Enter admin secret code"
                  secureTextEntry
                  placeholderTextColor="#4a5568"
                />
                <Text style={styles.hint}>Contact your system administrator for the admin code.</Text>
              </>
            )}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? ['#374151', '#4b5563'] : ['#3b82f6', '#1d4ed8']}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>{loading ? 'Creating...' : 'Create Account'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24 },

  backBtn: { marginTop: Platform.OS === 'ios' ? 48 : 16, marginBottom: 24 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '700' },

  title: { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#64748b', marginBottom: 28 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24,
    padding: 20, borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)',
  },

  label: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginBottom: 8, marginTop: 16 },

  roleRow: { flexDirection: 'row', gap: 12 },
  roleBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  roleBtnActive: { backgroundColor: 'rgba(59,130,246,0.2)', borderColor: '#3b82f6' },
  roleIcon: { fontSize: 28, marginBottom: 6 },
  roleText: { fontSize: 12, color: '#64748b', fontWeight: '700' },
  roleTextActive: { color: '#3b82f6' },

  input: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  adminInput: { borderColor: 'rgba(239,68,68,0.4)' },
  hint: { fontSize: 11, color: '#ef4444', marginTop: 6, opacity: 0.8 },

  btn: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.6 },
  btnGradient: { paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});

export default RegisterScreen;
