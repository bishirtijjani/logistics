import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';

export default function HomeScreen() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back,</Text>
      <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wallet Balance</Text>
        <Text style={styles.balance}>₦0.00</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f4f4f7' },
  title: { fontSize: 18, color: '#6b7280', marginTop: 40 },
  name: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  email: { fontSize: 14, color: '#6b7280', marginBottom: 30 },
  card: { backgroundColor: '#2563eb', borderRadius: 16, padding: 24, marginBottom: 30 },
  cardTitle: { color: '#e0e7ff', fontSize: 14, marginBottom: 8 },
  balance: { color: '#ffffff', fontSize: 36, fontWeight: 'bold' },
  button: { backgroundColor: '#ef4444', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 'auto' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
