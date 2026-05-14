import "react-native-gesture-handler";
import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  LogBox,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import "./global.css";
// Phase 9 — initialize i18n before any screen mounts so the device locale (or
// previously persisted user choice) is the language seen on first paint.
import "./src/i18n";
import { Provider } from "react-redux";
import { store } from "./src/store";
import AppNavigator from "./src/navigation/AppNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { ErrorBoundary } from "react-error-boundary";
import { registerForceLogout } from "./src/services/api";
import { forceLogout as forceLogoutAction } from "./src/store/slices/authSlice";
import { ThemeProvider, useTheme } from "./src/theme";
import BackgroundPattern from "./src/components/BackgroundPattern";
import { useToastConfig } from "./src/components/toastShared";

// Phase 5 — register the silent-refresh fallback so the api.js interceptor
// can flip the auth state out from anywhere in the tree when the refresh
// token is permanently invalid.
registerForceLogout(() => store.dispatch(forceLogoutAction()));

// Ignore specific warnings
LogBox.ignoreLogs(["ViewPropTypes will be removed"]);
LogBox.ignoreAllLogs();

// Themed toast — built inside ThemeProvider so the pill bg flips with mode.
// Wrapped in a position:absolute + elevation View so on Android the toast
// paints ABOVE the navigator (whose container in ThemedRoot uses elevation: 1
// to sit above BackgroundPattern). Without the higher elevation here the
// navigator's native layer would cover the toast.
// `pointerEvents="box-none"` lets taps on empty area fall through to the
// navigator underneath while the toast pill itself still receives swipes.
// Sheets that mount their own RN-<Modal> stack a sibling <InModalToast />
// inside themselves to stay covered while the sheet is open.
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

// Reactive status-bar style. In light mode the OS bar shows dark icons on the
// app's near-white canvas; in dark mode it flips to light icons.
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

// Root canvas: provides the app-wide background color and renders the
// BackgroundPattern BEHIND its children. Because the navigation theme and
// screen-level containers are transparent (see theme/index.js + navigationTheme.js),
// the pattern shows through every screen — cards/headers keep their own opaque
// fills and cover the pattern locally.
function ThemedRoot({ children }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      {/* <BackgroundPattern /> — temporarily omitted, component preserved. */}
      {/* Explicit zIndex/elevation keeps the navigator ABOVE the absolutely-
          positioned pattern. RN otherwise renders absolute siblings on top of
          relative ones regardless of source order. */}
      <View style={{ flex: 1, zIndex: 1, elevation: 1 }}>{children}</View>
    </View>
  );
}

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
  // Socket lifecycle is now managed by AppNavigator (gated on auth + biometric),
  // so the previous unconditional connect-on-mount here is no longer needed.
  //
  // ErrorBoundary sits OUTSIDE ThemeProvider so the fallback still renders if
  // ThemeProvider itself crashes (e.g. AsyncStorage failure). The fallback
  // intentionally uses static colors — it cannot consume useTheme.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <ThemeProvider>
              <Provider store={store}>
                <ThemedRoot>
                  <AppNavigator />
                </ThemedRoot>
              </Provider>
              <ThemedToast />
              <ThemedStatusBar />
            </ThemeProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </KeyboardProvider>
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
});
