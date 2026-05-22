import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { AuthAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedUser] = await AsyncStorage.multiGet(['token', 'user']);
      if (storedToken[1] && storedUser[1]) {
        setToken(storedToken[1]);
        const parsedUser = JSON.parse(storedUser[1]);
        setUser(parsedUser);
        // Re-connect socket
        await connectSocket(parsedUser._id, parsedUser.role);
      }
    } catch (err) {
      console.error('Load auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (phone, password, fcmToken = null) => {
    const deviceId = await DeviceInfo.getUniqueId();
    const response = await AuthAPI.login(phone, password, deviceId, fcmToken);
    const { token: newToken, user: newUser } = response.data;

    await AsyncStorage.multiSet([
      ['token', newToken],
      ['user', JSON.stringify(newUser)],
    ]);

    setToken(newToken);
    setUser(newUser);

    await connectSocket(newUser._id, newUser.role);
    return newUser;
  };

  const logout = async () => {
    try {
      await AuthAPI.logout();
    } catch {}
    
    disconnectSocket();
    await AsyncStorage.multiRemove(['token', 'user']);
    setToken(null);
    setUser(null);
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    AsyncStorage.setItem('user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
