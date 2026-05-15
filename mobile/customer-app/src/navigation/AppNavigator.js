import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, Text, TouchableOpacity, AppState, Linking } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { hydrateAuth, logout } from "../store/slices/authSlice";
import socketService from "../services/socket";
import { subscribeToWalletSocket } from "../store/slices/walletSlice";
import { fetchPublicSettings } from "../store/slices/settingsSlice";
import { hydrateCartFromStorage } from "../store/slices/cartSlice";
import {
  fetchUnreadCount,
  notificationReceived,
} from "../store/slices/notificationsSlice";
import { subscribeSocketToStore } from "../services/notificationsBus";
import { routeToScreen, parseDeepLink } from "../lib/notificationRoute";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  authenticateWithBiometric,
} from "../services/biometric";
import { useTheme, buildNavigationTheme } from "../theme";

// Auth Screens
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import OtpVerificationScreen from "../screens/auth/OtpVerificationScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/auth/ResetPasswordScreen";

// Main
import MainTabNavigator from "./MainTabNavigator";

// Profile Screens (Profile is now a stack screen reachable via the home
// header's avatar, not a bottom tab — that slot is the cart now.)
import ProfileScreen from "../screens/profile/ProfileScreen";
import EditProfileScreen from "../screens/profile/EditProfileScreen";
import ProfilePhotoScreen from "../screens/profile/ProfilePhotoScreen";
import BvnVerificationScreen from "../screens/profile/BvnVerificationScreen";
import SetPinScreen from "../screens/profile/SetPinScreen";
import ChangePinScreen from "../screens/profile/ChangePinScreen";
import SecuritySettingsScreen from "../screens/profile/SecuritySettingsScreen";
import NotificationSettingsScreen from "../screens/profile/NotificationSettingsScreen";
import SavedAddressesScreen from "../screens/profile/SavedAddressesScreen";
import HelpSupportScreen from "../screens/profile/HelpSupportScreen";
import LegalScreen from "../screens/profile/LegalScreen";
import AboutScreen from "../screens/profile/AboutScreen";

// Location
import LocationPickerScreen from "../screens/location/LocationPickerScreen";

// Merchant Screens
import MerchantBrowseScreen from "../screens/merchant/MerchantBrowseScreen";
import MerchantMenuScreen from "../screens/merchant/MerchantMenuScreen";
import ProductDetailScreen from "../screens/merchant/ProductDetailScreen";

// Request Screens (unified)
import CheckoutScreen from "../screens/request/CheckoutScreen";
import RequestTrackingScreen from "../screens/request/RequestTrackingScreen";
import CreateRequestScreen from "../screens/request/CreateRequestScreen";
import RateRequestScreen from "../screens/request/RateRequestScreen";

// Wallet Screens
import FundWalletScreen from "../screens/wallet/FundWalletScreen";
import TransactionHistoryScreen from "../screens/wallet/TransactionHistoryScreen";
import SendMoneyScreen from "../screens/wallet/SendMoneyScreen";
import WithdrawScreen from "../screens/wallet/WithdrawScreen";
import SavedBeneficiariesScreen from "../screens/wallet/SavedBeneficiariesScreen";
import ReceiptScreen from "../screens/wallet/ReceiptScreen";

// Security / Sessions
import SessionsScreen from "../screens/profile/SessionsScreen";
import PhoneChangeScreen from "../screens/profile/PhoneChangeScreen";

// Utility Screens
import AirtimeScreen from "../screens/utility/AirtimeScreen";
import DataScreen from "../screens/utility/DataScreen";
import CableScreen from "../screens/utility/CableScreen";
import ElectricityScreen from "../screens/utility/ElectricityScreen";
import ElectricityResultScreen from "../screens/utility/ElectricityResultScreen";
import UtilityHistoryScreen from "../screens/utility/UtilityHistoryScreen";

// Notification Center
import NotificationCenterScreen from "../screens/main/NotificationCenterScreen";

// Support
import MyTicketsScreen from "../screens/support/MyTicketsScreen";
import CreateTicketScreen from "../screens/support/CreateTicketScreen";
import TicketDetailScreen from "../screens/support/TicketDetailScreen";
import CreateDisputeScreen from "../screens/support/CreateDisputeScreen";
import DisputeDetailScreen from "../screens/support/DisputeDetailScreen";

// Shops aggregator (long-tail categories not surfaced as tiles on Home).
import ShopsScreen from "../screens/main/ShopsScreen";

const Stack = createNativeStackNavigator();

// react-navigation deep-link config — pairs with `customerapp` scheme in app.json.
// The route paths mirror the conventions in services/notify.service.js so the
// server can produce a `data.route` like "/request/abc" and either:
//   - in-app: notificationRoute.routeToScreen handles dispatch via navigation.navigate
//   - tray-tap: react-navigation's Linking handler parses the full URL on cold start
// Deep-link config. Tab screen names MUST match the MainTabNavigator's
// `HomeTab/OrdersTab/WalletTab/CartTab` exactly — react-navigation throws
// "screen not found" on a name mismatch, so `navigation.navigate('MainTabs',
// { screen: 'Wallet' })` would silently fail. notificationRoute.js builds
// the same screen names. Profile moved off the tab bar and into a top-level
// stack screen reachable from the home avatar.
const NAV_LINKING = {
  prefixes: ["customerapp://", "https://customer.vtulogistics.app"],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: "home",
          OrdersTab: "orders",
          WalletTab: "wallet",
          CartTab: "cart",
        },
      },
      Profile: "profile",
      NotificationCenter: "notifications",
      RequestTracking: "request/:requestId",
      MyTickets: "support",
      CreateSupportTicket: "support/new",
      SupportTicketDetail: "support/ticket/:ticketId",
      CreateDispute: "support/dispute/new/:requestId",
      SupportDisputeDetail: "support/dispute/:disputeId",
      TransactionHistory: "wallet/transactions",
      Airtime: "utility/airtime",
      Data: "utility/data",
      Cable: "utility/cable",
      Electricity: "utility/electricity",
      ElectricityResult: "utility/electricity/result/:paymentId",
      UtilityHistory: "utility/history",
    },
  },
};

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isHydrating } = useSelector((state) => state.auth);
  const currentRequestId = useSelector((s) => s.request.currentRequest?.id);
  const { tokens, isDark } = useTheme();
  const navigationTheme = useMemo(
    () => buildNavigationTheme(tokens, isDark),
    [tokens, isDark]
  );

  // navigationRef — used by the push-tap handler to navigate when there's
  // no useNavigation hook available (background → tray tap → cold start).
  const navigationRef = useRef(null);

  // Track the latest active-request id in a ref so the AppState listener's
  // captured closure can read it WITHOUT re-binding the effect every time the
  // request changes. Without this, opening a new request while backgrounded
  // would rejoin the OLD request's room on foreground.
  const currentRequestIdRef = useRef(currentRequestId);
  useEffect(() => { currentRequestIdRef.current = currentRequestId; }, [currentRequestId]);

  // Biometric gate states:
  //   'pending'  — checking whether to prompt
  //   'required' — user enabled biometrics; show locked screen + retry
  //   'passed'   — authenticated this session; main UI may render
  const [bioGate, setBioGate] = useState("pending");

  // Push-tap that arrived before NavigationContainer was ready. Replayed on
  // first render of the authenticated stack.
  const pendingActionRef = useRef(null);

  useEffect(() => {
    dispatch(hydrateAuth());
    dispatch(fetchPublicSettings());
    // Cart is user-scoped but the persisted blob is removed on forced logout
    // (see store/index.js), so it's safe to read on every cold start before
    // we know who's signed in — the worst case is an empty read.
    dispatch(hydrateCartFromStorage());
  }, [dispatch]);

  // Phase 5 — handle push tap (foreground + background) and cold-start deep links.
  useEffect(() => {
    // Tap on a delivered notification → navigate.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      const action = routeToScreen({ data, requestId: data.requestId, transactionId: data.transactionId });
      if (!action) return;
      if (navigationRef.current?.isReady?.()) {
        navigationRef.current.navigate(action.name, action.params);
      } else {
        pendingActionRef.current = action;
      }
    });

    // Cold-start: did the app open from a notification tap (and not yet
    // delivered to the listener)?
    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) {
        const data = last.notification?.request?.content?.data || {};
        const action = routeToScreen({ data, requestId: data.requestId, transactionId: data.transactionId });
        if (action) pendingActionRef.current = action;
      }
      // Or from a deep-link URL.
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        const action = parseDeepLink(initialUrl);
        if (action) pendingActionRef.current = action;
      }
    })();

    return () => sub.remove();
  }, []);

  // After hydration, decide whether the user must pass a biometric prompt
  // before seeing the main UI. Skipped entirely for unauthenticated users
  // (the auth flow is the gate in that case) and for devices without
  // enrolled biometrics.
  useEffect(() => {
    if (isHydrating) return;
    if (!isAuthenticated) {
      setBioGate("passed");
      return;
    }
    let cancelled = false;
    (async () => {
      const [enabled, available] = await Promise.all([
        isBiometricEnabled(),
        isBiometricAvailable(),
      ]);
      if (cancelled) return;
      if (!enabled || !available) {
        setBioGate("passed");
        return;
      }
      setBioGate("required");
      const ok = await authenticateWithBiometric("Unlock VTU Logistics");
      if (cancelled) return;
      setBioGate(ok ? "passed" : "required");
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrating, isAuthenticated]);

  const retryBiometric = async () => {
    const ok = await authenticateWithBiometric("Unlock VTU Logistics");
    if (ok) setBioGate("passed");
  };

  // Connect socket when authenticated AND past the biometric gate; otherwise
  // disconnect so we don't keep a privileged socket open behind a lock.
  // Also wires the notification:new bridge → store and prefetches the unread count.
  useEffect(() => {
    if (isAuthenticated && bioGate === "passed") {
      socketService.connect();
      const unsubWallet = dispatch(subscribeToWalletSocket());
      const unsubNotif = subscribeSocketToStore(dispatch, { notificationReceived });
      dispatch(fetchUnreadCount());
      return () => {
        if (typeof unsubWallet === 'function') unsubWallet();
        if (typeof unsubNotif === 'function') unsubNotif();
      };
    } else {
      socketService.disconnect();
    }
  }, [isAuthenticated, bioGate, dispatch]);

  // Phase 5 — AppState handling. Backgrounding the app for >60s disconnects
  // the socket (saves battery + server-side resources); foregrounding immediately
  // reconnects and re-joins the active request room so live tracking resumes
  // without manual refresh.
  useEffect(() => {
    if (!isAuthenticated || bioGate !== "passed") return undefined;

    let backgroundTimer = null;
    let prevState = AppState.currentState;
    let pendingRejoinUnsub = null;

    const rejoinOnConnect = (requestId) => {
      // If already connected, rejoin immediately.
      if (socketService.isConnected()) {
        socketService.rejoinRequestRoomIfActive(requestId);
        return;
      }
      // Otherwise wait for the next `connect` event. Cleared either by the
      // event firing or by the next backgrounding.
      if (typeof pendingRejoinUnsub === "function") pendingRejoinUnsub();
      pendingRejoinUnsub = socketService.onConnectionStateChange((isConnected) => {
        if (!isConnected) return;
        socketService.rejoinRequestRoomIfActive(requestId);
        if (typeof pendingRejoinUnsub === "function") {
          pendingRejoinUnsub();
          pendingRejoinUnsub = null;
        }
      });
    };

    const sub = AppState.addEventListener("change", (next) => {
      if (prevState !== "background" && next === "background") {
        backgroundTimer = setTimeout(() => {
          try { socketService.disconnect(); } catch (_) {}
        }, 60_000);
      } else if (prevState === "background" && (next === "active" || next === "inactive")) {
        if (backgroundTimer) { clearTimeout(backgroundTimer); backgroundTimer = null; }
        socketService.connect();
        // Use the ref so we always rejoin the *currently* active request,
        // not whatever was active when this effect was set up.
        const reqId = currentRequestIdRef.current;
        if (reqId) rejoinOnConnect(reqId);
        dispatch(fetchUnreadCount());
      }
      prevState = next;
    });

    return () => {
      sub.remove();
      if (backgroundTimer) clearTimeout(backgroundTimer);
      if (typeof pendingRejoinUnsub === "function") pendingRejoinUnsub();
    };
  }, [isAuthenticated, bioGate, dispatch]);

  if (isHydrating) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "transparent",
        }}
      >
        <ActivityIndicator size="large" color="#EA580C" />
      </View>
    );
  }

  if (isAuthenticated && bioGate !== "passed") {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "transparent",
          paddingHorizontal: 32,
        }}
      >
        <Ionicons name="finger-print" size={72} color="#EA580C" />
        <Text style={{ marginTop: 24, fontSize: 22, fontWeight: "800", color: "#111827" }}>
          Locked
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "#6B7280",
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          Authenticate with biometrics to continue.
        </Text>
        <TouchableOpacity
          onPress={retryBiometric}
          style={{
            marginTop: 28,
            backgroundColor: "#EA580C",
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
            Use biometrics
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => dispatch(logout())}
          style={{ marginTop: 16, paddingVertical: 10 }}
        >
          <Text style={{ color: "#6B7280", fontWeight: "600", fontSize: 14 }}>
            Sign out instead
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onNavReady = () => {
    // Surface the initial route to socket service so the notification:new
    // toast suppression can read it on the very first render too.
    try {
      const r = navigationRef.current?.getCurrentRoute?.();
      if (r?.name) socketService.setCurrentRouteName(r.name);
    } catch (_) {}

    if (pendingActionRef.current && navigationRef.current?.isReady?.()) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      try { navigationRef.current.navigate(action.name, action.params); } catch (_) {}
    }
  };

  const onNavStateChange = () => {
    try {
      const r = navigationRef.current?.getCurrentRoute?.();
      if (r?.name) socketService.setCurrentRouteName(r.name);
    } catch (_) {}
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={NAV_LINKING}
      onReady={onNavReady}
      onStateChange={onNavStateChange}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          // Main App
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ProfilePhoto" component={ProfilePhotoScreen} />
            <Stack.Screen
              name="BvnVerification"
              component={BvnVerificationScreen}
            />
            <Stack.Screen name="SetPin" component={SetPinScreen} />
            <Stack.Screen name="ChangePin" component={ChangePinScreen} />
            <Stack.Screen
              name="SecuritySettings"
              component={SecuritySettingsScreen}
            />
            <Stack.Screen
              name="NotificationSettings"
              component={NotificationSettingsScreen}
            />
            <Stack.Screen
              name="SavedAddresses"
              component={SavedAddressesScreen}
            />
            <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <Stack.Screen name="Legal" component={LegalScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen
              name="LocationPicker"
              component={LocationPickerScreen}
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />

            {/* Shops aggregator → MerchantBrowse for the chosen category */}
            <Stack.Screen name="Shops" component={ShopsScreen} />

            {/* Merchant Flow */}
            <Stack.Screen name="MerchantBrowse" component={MerchantBrowseScreen} />
            <Stack.Screen name="MerchantMenu" component={MerchantMenuScreen} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />

            {/* Request Flow (unified — supersedes the legacy delivery flow) */}
            <Stack.Screen name="CreateRequest" component={CreateRequestScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="RequestTracking" component={RequestTrackingScreen} />
            <Stack.Screen name="RateRequest" component={RateRequestScreen} />

            {/* Wallet Screens */}
            <Stack.Screen name="FundWallet" component={FundWalletScreen} />
            <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
            <Stack.Screen name="SendMoney" component={SendMoneyScreen} />
            <Stack.Screen name="Withdraw" component={WithdrawScreen} />
            <Stack.Screen name="SavedBeneficiaries" component={SavedBeneficiariesScreen} />
            <Stack.Screen name="Receipt" component={ReceiptScreen} />

            {/* Security */}
            <Stack.Screen name="Sessions" component={SessionsScreen} />
            <Stack.Screen name="PhoneChange" component={PhoneChangeScreen} />

            {/* Utility Screens */}
            <Stack.Screen name="Airtime" component={AirtimeScreen} />
            <Stack.Screen name="Data" component={DataScreen} />
            <Stack.Screen name="Cable" component={CableScreen} />
            <Stack.Screen name="Electricity" component={ElectricityScreen} />
            <Stack.Screen name="ElectricityResult" component={ElectricityResultScreen} />
            <Stack.Screen name="UtilityHistory" component={UtilityHistoryScreen} />

            {/* Notifications */}
            <Stack.Screen name="NotificationCenter" component={NotificationCenterScreen} />

            {/* Support — tickets and disputes */}
            <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
            <Stack.Screen name="CreateSupportTicket" component={CreateTicketScreen} />
            <Stack.Screen name="SupportTicketDetail" component={TicketDetailScreen} />
            <Stack.Screen name="CreateDispute" component={CreateDisputeScreen} />
            <Stack.Screen name="SupportDisputeDetail" component={DisputeDetailScreen} />
          </>
        ) : (
          // Auth Flow
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen
              name="OtpVerification"
              component={OtpVerificationScreen}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
