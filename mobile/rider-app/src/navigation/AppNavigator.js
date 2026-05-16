import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  AppState,
  Linking,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSelector, useDispatch } from "react-redux";
import * as Notifications from "expo-notifications";

import { hydrateAuth, logout, forceLogout } from "../store/slices/authSlice";
import { fetchPublicSettings } from "../store/slices/settingsSlice";
import { fetchProfile } from "../store/slices/profileSlice";
import { fetchRiderProfile } from "../store/slices/riderSlice";
import { notificationReceived } from "../store/slices/notificationsSlice";
import socketService from "../services/socket";
import { registerForceLogout } from "../services/api";
import { subscribeSocketToStore } from "../services/notificationsBus";
import { routeToScreen } from "../lib/notificationRoute";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  authenticateWithBiometric,
} from "../services/biometric";
import { useTheme, buildNavigationTheme } from "../theme";
import { RIDER_STATUS } from "../lib/constants";

import LoginScreen from "../features/auth/LoginScreen";
import PendingApprovalScreen from "../features/onboarding/PendingApprovalScreen";
import MainTabNavigator from "./MainTabNavigator";
import OfferOverlayNavigator from "./OfferOverlayNavigator";

const Stack = createNativeStackNavigator();

const NAV_LINKING = {
  prefixes: ["riderapp://", "https://rider.vtulogistics.app"],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: "home",
          EarningsTab: "earnings",
          WalletTab: "wallet",
          MeTab: "me",
        },
      },
    },
  },
};

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isHydrating, user } = useSelector((state) => state.auth);
  const riderStatus = useSelector((s) => s.rider?.rider?.status);
  const { tokens, isDark } = useTheme();
  const navigationTheme = useMemo(
    () => buildNavigationTheme(tokens, isDark),
    [tokens, isDark]
  );

  const navigationRef = useRef(null);
  const pendingActionRef = useRef(null);

  // Biometric gate states:
  //   'pending'  — checking whether to prompt
  //   'required' — show locked screen + retry
  //   'passed'   — authenticated this session
  const [bioGate, setBioGate] = useState("pending");

  // Register the api.js silent-refresh force-logout hook on mount.
  useEffect(() => {
    registerForceLogout(() => dispatch(forceLogout()));
  }, [dispatch]);

  // Boot sequence: hydrate auth + fetch public settings.
  useEffect(() => {
    dispatch(hydrateAuth());
    dispatch(fetchPublicSettings());
  }, [dispatch]);

  // After auth hydration, decide biometric gate.
  useEffect(() => {
    if (isHydrating) return;
    if (!isAuthenticated) {
      setBioGate("passed");
      return;
    }
    (async () => {
      try {
        const enabled = await isBiometricEnabled();
        if (!enabled) {
          setBioGate("passed");
          return;
        }
        const available = await isBiometricAvailable();
        if (!available) {
          setBioGate("passed");
          return;
        }
        setBioGate("required");
        const ok = await authenticateWithBiometric("Unlock VTU Rider");
        setBioGate(ok ? "passed" : "required");
      } catch (_) {
        setBioGate("passed");
      }
    })();
  }, [isAuthenticated, isHydrating]);

  // Once authed + bio passed: load profile + rider profile + connect socket.
  useEffect(() => {
    if (!isAuthenticated || bioGate !== "passed") return;
    dispatch(fetchProfile());
    dispatch(fetchRiderProfile()).catch?.(() => {});
    socketService.connect();
    const unsub = subscribeSocketToStore(dispatch, { notificationReceived });
    return () => {
      unsub?.();
    };
  }, [isAuthenticated, bioGate, dispatch]);

  // Socket lifecycle on AppState background/foreground.
  useEffect(() => {
    let backgroundTimer = null;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundTimer = setTimeout(() => {
          socketService.disconnect();
        }, 60_000);
      } else if (next === "active") {
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }
        if (isAuthenticated && bioGate === "passed") {
          socketService.connect();
        }
      }
    });
    return () => {
      if (backgroundTimer) clearTimeout(backgroundTimer);
      sub.remove();
    };
  }, [isAuthenticated, bioGate]);

  // Push-tap routing (foreground + background).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      const action = routeToScreen({
        data,
        requestId: data.requestId,
        transactionId: data.transactionId,
      });
      if (!action) return;
      if (navigationRef.current?.isReady?.()) {
        navigationRef.current.navigate(action.name, action.params);
      } else {
        pendingActionRef.current = action;
      }
    });

    // Cold-start: opened from a tap?
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data = last?.notification?.request?.content?.data;
        if (data) {
          const action = routeToScreen({
            data,
            requestId: data.requestId,
            transactionId: data.transactionId,
          });
          if (action) pendingActionRef.current = action;
        }
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && !pendingActionRef.current) {
          // Linking parsing is handled by NavigationContainer's `linking` prop.
        }
      } catch (_) {}
    })();

    return () => sub.remove();
  }, []);

  // When navigation is ready, flush any pending tap action.
  const onNavReady = () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action && navigationRef.current?.isReady?.()) {
      navigationRef.current.navigate(action.name, action.params);
    }
  };

  if (isHydrating || bioGate === "pending") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.bg.canvas }}>
        <ActivityIndicator color={tokens.brand.default} />
      </View>
    );
  }

  if (isAuthenticated && bioGate === "required") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: tokens.bg.canvas }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: tokens.text.primary, marginBottom: 8 }}>
          Locked
        </Text>
        <Text style={{ color: tokens.text.muted, textAlign: "center", marginBottom: 24 }}>
          Unlock VTU Rider with biometrics to continue.
        </Text>
        <TouchableOpacity
          onPress={async () => {
            const ok = await authenticateWithBiometric("Unlock VTU Rider");
            if (ok) setBioGate("passed");
          }}
          style={{
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: tokens.brand.default,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: tokens.text.onBrand, fontWeight: "600" }}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => dispatch(logout())}>
          <Text style={{ color: tokens.text.muted }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Role + status gating decides which stack is shown when authed.
  const role = user?.role;
  const isRiderApproved =
    role === "RIDER" && (!riderStatus || riderStatus === RIDER_STATUS.APPROVED);
  const isRiderPending =
    role === "RIDER" && riderStatus && riderStatus !== RIDER_STATUS.APPROVED;
  const needsRiderApplication = isAuthenticated && role !== "RIDER";

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={NAV_LINKING}
      onReady={onNavReady}
      onStateChange={(state) => {
        // Track current route name so socket can suppress redundant toasts.
        const route = state?.routes?.[state.index];
        if (route?.name) socketService.setCurrentRouteName(route.name);
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        ) : isRiderApproved ? (
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        ) : isRiderPending || needsRiderApplication ? (
          <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
        ) : (
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
      <OfferOverlayNavigator />
    </NavigationContainer>
  );
}
