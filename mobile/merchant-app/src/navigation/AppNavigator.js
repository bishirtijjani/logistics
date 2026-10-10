import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme, buildNavigationTheme } from "../theme";
import { useT } from "../i18n/useT";
import { hydrateAuth } from "../store/slices/authSlice";
import { fetchPublicSettings } from "../store/slices/settingsSlice";
import { fetchUnreadCount, notificationReceived } from "../store/slices/notificationsSlice";
import {
  orderReceived,
  orderStatusPatched,
  acceptOrder,
  rejectOrder,
  fetchOrders,
} from "../store/slices/ordersSlice";
import socketService from "../services/socket";
import { setUser as setSentryUser } from "../services/sentry";
import {
  ACTION_ACCEPT,
  ACTION_REJECT,
  configureNotificationCategories,
} from "../services/notifications";
import { isBiometricEnabled, isBiometricAvailable } from "../services/biometric";

import MainTabNavigator from "./MainTabNavigator";
import LoginScreen from "../features/auth/LoginScreen";
import RegisterScreen from "../features/auth/RegisterScreen";
import OtpVerificationScreen from "../features/auth/OtpVerificationScreen";
import ForgotPasswordScreen from "../features/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "../features/auth/ResetPasswordScreen";
import OrderDetailScreen from "../features/orders/OrderDetailScreen";
import LockScreen from "../features/auth/LockScreen";

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

const NAV_LINKING = {
  prefixes: ["iprime://", "https://merchant.iprime.ng"],
};

function navigateToOrder(requestId) {
  if (!requestId) return;
  if (navigationRef.isReady()) {
    navigationRef.navigate("OrderDetail", { requestId });
  }
}

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { tokens, isDark } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();

  const { isAuthenticated, isHydrating, user } = useSelector((s) => s.auth);
  const merchantId = user?.merchantId;

  // Biometric gate: pending -> required -> passed. Only enforced when the user
  // has enabled biometrics and the device supports it.
  const [bioGate, setBioGate] = useState("pending");

  // Boot: restore session + public settings.
  useEffect(() => {
    dispatch(hydrateAuth());
    dispatch(fetchPublicSettings());
    configureNotificationCategories();
  }, [dispatch]);

  // Decide the biometric gate once hydration settles.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated) {
        if (!cancelled) setBioGate("passed");
        return;
      }
      const enabled = await isBiometricEnabled();
      const available = enabled ? await isBiometricAvailable() : false;
      if (!cancelled) setBioGate(enabled && available ? "required" : "passed");
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Sentry user tagging.
  useEffect(() => {
    setSentryUser(isAuthenticated ? user : null);
  }, [isAuthenticated, user]);

  // Socket lifecycle: connect once authenticated (after biometric gate).
  useEffect(() => {
    if (isAuthenticated && merchantId && bioGate === "passed") {
      socketService.connect(merchantId);
    } else if (!isAuthenticated) {
      socketService.disconnect();
    }
  }, [isAuthenticated, merchantId, bioGate]);

  // Socket → store bridge.
  useEffect(() => {
    const unsubs = [
      socketService.onRequestCreated((data) => {
        dispatch(orderReceived(data));
        dispatch(fetchOrders({ page: 1 }));
      }),
      socketService.onRequestStatusChanged((data) => dispatch(orderStatusPatched(data))),
      socketService.onNotificationNew((data) => {
        dispatch(notificationReceived(data));
        dispatch(fetchUnreadCount());
      }),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [dispatch]);

  // Push notification taps + inline actions.
  const handleResponse = useCallback(
    (response) => {
      const action = response?.actionIdentifier;
      const data = response?.notification?.request?.content?.data || {};
      const requestId = data.requestId || data.data?.requestId;
      if (action === ACTION_ACCEPT && requestId) {
        dispatch(acceptOrder(requestId));
        navigateToOrder(requestId);
        return;
      }
      if (action === ACTION_REJECT && requestId) {
        dispatch(rejectOrder({ requestId, reason: "Rejected from notification" }));
        return;
      }
      // Default tap
      navigateToOrder(requestId);
    },
    [dispatch],
  );

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) handleResponse(resp);
    });
    return () => sub.remove();
  }, [handleResponse]);

  // ── Gate screens ─────────────────────────────────────────────
  if (isHydrating || bioGate === "pending") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: tokens.bg.canvas }}>
        <ActivityIndicator size="large" color={tokens.brand.default} />
      </View>
    );
  }

  if (isAuthenticated && bioGate === "required") {
    return (
      <LockScreen
        onUnlock={() => setBioGate("passed")}
        onSignOut={() => setBioGate("passed")}
      />
    );
  }

  // Authenticated but no merchant profile yet → route to registration/enroll.
  const needsProfile = isAuthenticated && !merchantId;

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={buildNavigationTheme(tokens, isDark)}
      linking={NAV_LINKING}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bg.canvas } }}>
        {!isAuthenticated || needsProfile ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
