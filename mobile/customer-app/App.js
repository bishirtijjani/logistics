import "react-native-gesture-handler";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity, LogBox } from "react-native";
import { StatusBar } from "expo-status-bar";
import "./global.css";
// Phase 9 — initialize i18n before any screen mounts so the device locale (or
// previously persisted user choice) is the language seen on first paint.
import "./src/i18n";
import { Provider } from "react-redux";
import { store } from "./src/store";
import AppNavigator from "./src/navigation/AppNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { ErrorBoundary } from "react-error-boundary";
import { registerForceLogout } from "./src/services/api";
import { forceLogout as forceLogoutAction } from "./src/store/slices/authSlice";
import { ThemeProvider, useTheme } from "./src/theme";
import BackgroundPattern from "./src/components/BackgroundPattern";

// Phase 5 — register the silent-refresh fallback so the api.js interceptor
// can flip the auth state out from anywhere in the tree when the refresh
// token is permanently invalid.
registerForceLogout(() => store.dispatch(forceLogoutAction()));

// Ignore specific warnings
LogBox.ignoreLogs(["ViewPropTypes will be removed"]);
LogBox.ignoreAllLogs();

// Themed toast — built inside ThemeProvider so the pill bg flips with mode.
// Built once per scheme change via useMemo so each row in the toast queue isn't
// rebuilt on every render.
function ThemedToast() {
  const { tokens } = useTheme();
  const toastConfig = useMemo(() => {
    const baseContainer = {
      paddingHorizontal: 20,
      paddingVertical: 14,
      marginHorizontal: 12,
      borderRadius: 12,
    };
    const textBase = {
      fontSize: 16,
      fontWeight: "600",
      color: "#FFFFFF",
    };
    const subTextBase = {
      fontSize: 14,
      color: "#FFFFFF",
      marginTop: 4,
      opacity: 0.95,
    };
    const make = (bg) => (props) => (
      <View style={[baseContainer, { backgroundColor: bg }]}>
        <Text style={textBase}>{props.text1}</Text>
        {props.text2 ? <Text style={subTextBase}>{props.text2}</Text> : null}
      </View>
    );
    return {
      success: make(tokens.status.success),
      error: make(tokens.status.error),
      info: make(tokens.status.info),
    };
  }, [tokens]);
  return <Toast config={toastConfig} />;
}

// Reactive status-bar style. In light mode the OS bar shows dark icons on the
// app's near-white canvas; in dark mode it flips to light icons.
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
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
      <SafeAreaProvider>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <ThemeProvider>
            <Provider store={store}>
              <AppNavigator />
            </Provider>
            <BackgroundPattern />
            <ThemedToast />
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
  errorButton: { backgroundColor: "#2563eb", padding: 16, borderRadius: 8 },
  errorButtonText: { color: "#fff", fontWeight: "bold" },
});
