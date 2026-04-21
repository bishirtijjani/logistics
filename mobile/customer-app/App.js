import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, LogBox } from "react-native";
import "./global.css";
import { Provider } from "react-redux";
import { store } from "./src/store";
import AppNavigator from "./src/navigation/AppNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { ErrorBoundary } from "react-error-boundary";
import socketService from "./src/services/socket";

// Ignore specific warnings
LogBox.ignoreLogs(["ViewPropTypes will be removed"]);
LogBox.ignoreAllLogs();

// Toast configuration for larger, readable text
const toastConfig = {
  success: (props) => (
    <View style={styles.toastContainer}>
      <Text style={styles.toastText}>{props.text1}</Text>
      {props.text2 && <Text style={styles.toastSubText}>{props.text2}</Text>}
    </View>
  ),
  error: (props) => (
    <View style={[styles.toastContainer, styles.toastErrorContainer]}>
      <Text style={styles.toastText}>{props.text1}</Text>
      {props.text2 && <Text style={styles.toastSubText}>{props.text2}</Text>}
    </View>
  ),
  info: (props) => (
    <View style={[styles.toastContainer, styles.toastInfoContainer]}>
      <Text style={styles.toastText}>{props.text1}</Text>
      {props.text2 && <Text style={styles.toastSubText}>{props.text2}</Text>}
    </View>
  ),
};

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
  useEffect(() => {
    // Initialize socket connection
    socketService.connect();

    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Provider store={store}>
            <AppNavigator />
          </Provider>
        </ErrorBoundary>
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a2e",
    marginBottom: 12,
  },
  errorDetail: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  errorButton: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8 },
  errorButtonText: { color: "#fff", fontWeight: "bold" },
  toastContainer: {
    backgroundColor: "#10B981",
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 12,
    borderRadius: 12,
  },
  toastErrorContainer: {
    backgroundColor: "#EF4444",
  },
  toastInfoContainer: {
    backgroundColor: "#3B82F6",
  },
  toastText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  toastSubText: {
    fontSize: 14,
    color: "#fff",
    marginTop: 4,
    opacity: 0.95,
  },
});
