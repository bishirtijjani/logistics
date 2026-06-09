import "react-native-gesture-handler";
import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  LogBox,
} from "react-native";
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
import { initAnalytics, track, EVENTS } from "./src/lib/analytics";
import OfflineBanner from "./src/components/OfflineBanner";

// Initialize Sentry FIRST so any crash during module-load below is reported.
// `initSentry` is a safe no-op when EXPO_PUBLIC_SENTRY_DSN is empty or the
// SDK isn't installed (see services/sentry.js header).
initSentry();
initAnalytics();
track(EVENTS.AppOpened);

// Web only: route Alert.alert through a themed modal - RN-web's Alert.alert has
// dead multi-button callbacks. No-op on native (real OS Alert is used there).
installWebAlert();

// Register the silent-refresh fallback so the api.js interceptor can flip the
// auth state out from anywhere in the tree when the refresh token is
// permanently invalid.
registerForceLogout(() => store.dispatch(forceLogoutAction()));

LogBox.ignoreLogs(["ViewPropTypes will be removed"]);
LogBox.ignoreAllLogs();

// Themed toast - built inside ThemeProvider so the pill bg flips with mode.
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
  // Android `edgeToEdgeEnabled: true` lets content draw under the status bar;
  // none of the screens wrap in SafeAreaView, so we apply the top inset once
  // here. The OfflineBanner adds its own inset on top of this when shown.
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

/**
 * Fire-and-forget Sentry capture for root-level renders that crash. The
 * `react-error-boundary` library invokes this BEFORE rendering the fallback,
 * so the user sees the recovery UI while Sentry receives the exception.
 */
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

export default function App() {
  // Socket lifecycle is managed by AppNavigator (gated on auth + biometric).
  // ErrorBoundary sits OUTSIDE ThemeProvider so the fallback still renders if
  // ThemeProvider itself crashes. The fallback uses static colors - it cannot
  // consume useTheme.
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
  errorButton: { backgroundColor: "#EA580C", padding: 16, borderRadius: 8 },
  errorButtonText: { color: "#fff", fontWeight: "bold" },
});
