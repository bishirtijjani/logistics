import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import './global.css';
import { Provider } from 'react-redux';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { ErrorBoundary } from 'react-error-boundary';

// Fatal Error UI Component
function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Oops, something went wrong</Text>
      <Text style={styles.errorDetail}>{error.message}</Text>
      <TouchableOpacity style={styles.errorButton} onPress={resetErrorBoundary}>
        <Text style={styles.errorButtonText}>Restart App</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Provider store={store}>
          <AppNavigator />
        </Provider>
      </ErrorBoundary>
      <Toast />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  errorTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 12 },
  errorDetail: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24 },
  errorButton: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8 },
  errorButtonText: { color: '#fff', fontWeight: 'bold' },
});
