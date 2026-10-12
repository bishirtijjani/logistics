import "react-native-gesture-handler";
import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, LogBox } from "react-native";
import { StatusBar } from "expo-status-bar";
import "./global.css";
// Initialize i18n before any screen mounts so the device locale (or persisted
// user choice) is the language seen on first paint.
import "./src/i18n";
import { Provider } from "react-redux";
import { store } from "./src/store";
import AppNavigator from "./src/navigation/AppNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { ErrorBoundary } from "react-error-boundary";
import { registerForceLogout } from "./src/services/api";
import { forceLogout as forceLogoutAction } from "./src/store/slices/authSlice";
import { ThemeProvider, useTheme } from "./src/theme";
import { useToastConfig } from "./src/components/toastShared";
import AlertHost from "./src/components/AlertHost";
import { installWebAlert } from "./src/lib/safeAlert";
import { initSentry, captureError } from "./src/services/sentry";
import OfflineBanner from "./src/components/OfflineBanner";
import * as Sentry from '@sentry/react-native';

initSentry();

// Web only: route Alert.alert through a themed modal. No-op on native.
installWebAlert();

// Register the silent-refresh fallback so api.js can flip auth state out from
// anywhere in the tree when the refresh token is permanently invalid.
registerForceLogout(() => store.dispatch(forceLogoutAction()));

LogBox.ignoreLogs(["ViewPropTypes will be removed"]);
LogBox.ignoreAllLogs();

function ThemedToast() {
  const toastConfig = useToastConfig();
  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFillObject, { elevation: 10, zIndex: 10 }]}
    >
      <Toast config={toastConfig} />
    </View>
  );
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

function ThemedRoot({ children }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas, paddingTop: insets.top }}>
      <OfflineBanner />
      <View style={{ flex: 1, zIndex: 1, elevation: 1 }}>{children}</View>
    </View>
  );
}

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Oops, something went wrong</Text>
      <Text style={styles.errorDetail}>{error?.message || "Unknown error"}</Text>
      <TouchableOpacity style={styles.errorButton} onPress={resetErrorBoundary}>
        <Text style={styles.errorButtonText}>Restart App</Text>
      </TouchableOpacity>
    </View>
  );
}

function reportToSentry(error, info) {
  try {
    captureError(error, {
      screen: "App",
      feature: "root-error-boundary",
      componentStack: info?.componentStack,
    });
  } catch (_) {
    // Never let Sentry reporting itself crash the boundary.
  }
}

export default Sentry.wrap(function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary FallbackComponent={ErrorFallback} onError={reportToSentry}>
          <ThemeProvider>
            <Provider store={store}>
              <ThemedRoot>
                <AppNavigator />
              </ThemedRoot>
            </Provider>
            <ThemedToast />
            <AlertHost />
            <ThemedStatusBar />
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  errorTitle: { fontSize: 24, fontWeight: "bold", color: "#1a1a2e", marginBottom: 12 },
  errorDetail: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 24 },
  errorButton: { backgroundColor: "#EA580C", padding: 16, borderRadius: 8 },
  errorButtonText: { color: "#fff", fontWeight: "bold" },
});
