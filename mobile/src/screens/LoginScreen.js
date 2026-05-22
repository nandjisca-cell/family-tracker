import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  Animated, StatusBar, ActivityIndicator
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../hooks/useAuth';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      shake();
      Alert.alert('Error', 'Please enter phone and password');
      return;
    }

    setLoading(true);
    try {
      const user = await login(phone.trim(), password);
      // Navigation happens automatically via auth state
    } catch (err) {
      shake();
      const msg = err.response?.data?.error || 'Login failed. Check credentials.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3e', '#0d2137']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoIcon}>📡</Text>
              <View style={styles.pingRing} />
            </View>
            <Text style={styles.appName}>FamilyTracker</Text>
            <Text style={styles.tagline}>Always Connected. Always Safe.</Text>
          </View>

          {/* Login Card */}
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>Admin & User login</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>📱 Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor="#4a5568"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>🔒 Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter password"
                  placeholderTextColor="#4a5568"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPass(!showPass)}
                >
                  <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={loading ? ['#2d3748', '#4a5568'] : ['#3b82f6', '#1d4ed8']}
                style={styles.loginGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.loginBtnText}>LOGIN →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.registerBtnText}>Create New Account</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Info */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>🛡️</Text>
              <Text style={styles.infoText}>Admin Panel</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>👨‍👩‍👧</Text>
              <Text style={styles.infoText}>Family Member</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText}>Live Tracking</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },

  header: { alignItems: 'center', marginBottom: 32 },
  logoContainer: { position: 'relative', marginBottom: 12 },
  logoIcon: { fontSize: 56 },
  pingRing: {
    position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 50, borderWidth: 2, borderColor: '#3b82f6', opacity: 0.4,
  },
  appName: {
    fontSize: 32, fontWeight: '900', color: '#fff',
    letterSpacing: 2, textShadowColor: '#3b82f6', textShadowRadius: 20,
  },
  tagline: { fontSize: 13, color: '#64748b', marginTop: 6, letterSpacing: 1 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
    marginBottom: 24,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 24 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  passwordContainer: { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  eyeIcon: { fontSize: 18 },

  loginBtn: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  loginBtnDisabled: { opacity: 0.7 },
  loginGradient: { paddingVertical: 16, alignItems: 'center', borderRadius: 14 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 2 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: '#4a5568', marginHorizontal: 12, fontSize: 13 },

  registerBtn: {
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  registerBtnText: { color: '#3b82f6', fontSize: 15, fontWeight: '700' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-around' },
  infoItem: { alignItems: 'center' },
  infoIcon: { fontSize: 24, marginBottom: 4 },
  infoText: { fontSize: 11, color: '#4a5568', fontWeight: '600' },
});

export default LoginScreen;
