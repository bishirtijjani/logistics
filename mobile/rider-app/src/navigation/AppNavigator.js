import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  AppState,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSelector, useDispatch } from "react-redux";
import * as Notifications from "expo-notifications";

import { hydrateAuth, logout, forceLogout } from "../store/slices/authSlice";
import { fetchPublicSettings } from "../store/slices/settingsSlice";
import { fetchProfile } from "../store/slices/profileSlice";
import { fetchRiderProfile, reconcileFromServer, setLastFix, setStreaming } from "../store/slices/riderSlice";
import { fetchWallet } from "../store/slices/walletSlice";
import { hydrateOnboarding } from "../store/slices/onboardingSlice";
import { notificationReceived } from "../store/slices/notificationsSlice";
import { offersPruneStale } from "../store/slices/offersSlice";
import { activateFromAcceptedRequest, hydrateFromServer } from "../store/slices/tripSlice";
import socketService from "../services/socket";
import locationStream from "../services/locationStream";
import { registerForceLogout } from "../services/api";
import { subscribeSocketToStore } from "../services/notificationsBus";
import { setUser as sentrySetUser, addBreadcrumb as sentryBreadcrumb } from "../services/sentry";
import { setUser as analyticsSetUser, track, EVENTS } from "../lib/analytics";
import { routeToScreen } from "../lib/notificationRoute";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  authenticateWithBiometric,
} from "../services/biometric";
import { useTheme, buildNavigationTheme } from "../theme";
import { RIDER_STATUS } from "../lib/constants";

import LoginScreen from "../features/auth/LoginScreen";
import RegisterScreen from "../features/auth/RegisterScreen";
import OtpVerificationScreen from "../features/auth/OtpVerificationScreen";
import ForgotPasswordScreen from "../features/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "../features/auth/ResetPasswordScreen";

import PendingApprovalScreen from "../features/onboarding/PendingApprovalScreen";
import RejectedScreen from "../features/onboarding/RejectedScreen";
import SuspendedScreen from "../features/onboarding/SuspendedScreen";
import SetTransactionPinScreen from "../features/onboarding/SetTransactionPinScreen";
import EnableBiometricScreen from "../features/onboarding/EnableBiometricScreen";
import BecomeRiderPersonalStep from "../features/onboarding/BecomeRiderPersonalStep";
import BecomeRiderVehicleStep from "../features/onboarding/BecomeRiderVehicleStep";
import BecomeRiderDocumentsStep from "../features/onboarding/BecomeRiderDocumentsStep";
import BecomeRiderReviewSubmitStep from "../features/onboarding/BecomeRiderReviewSubmitStep";
import LocationPermissionRecoveryScreen from "../features/location/LocationPermissionRecoveryScreen";
import LocationPickerScreen from "../features/location/LocationPickerScreen";

import TripCockpitScreen from "../features/trip/TripCockpitScreen";

import EarningsBreakdownScreen from "../features/earnings/EarningsBreakdownScreen";
import WithdrawScreen from "../features/wallet/WithdrawScreen";
import BeneficiariesScreen from "../features/wallet/BeneficiariesScreen";
import TransactionsScreen from "../features/wallet/TransactionsScreen";
import TransactionDetailScreen from "../features/wallet/TransactionDetailScreen";

// Phase 7
import NotificationsCenterScreen from "../features/notifications/NotificationsCenterScreen";
import EditProfileScreen from "../features/profile/EditProfileScreen";
import ProfilePhotoScreen from "../features/profile/ProfilePhotoScreen";
import VehicleInfoScreen from "../features/profile/VehicleInfoScreen";
import KycStatusScreen from "../features/profile/KycStatusScreen";
import PerformanceScreen from "../features/profile/PerformanceScreen";
import SecuritySettingsScreen from "../features/settings/SecuritySettingsScreen";
import SessionsScreen from "../features/settings/SessionsScreen";
import ChangePinScreen from "../features/settings/ChangePinScreen";
import PhoneChangeScreen from "../features/settings/PhoneChangeScreen";
import BiometricSettingsScreen from "../features/settings/BiometricSettingsScreen";
import LanguageScreen from "../features/settings/LanguageScreen";
import ThemeScreen from "../features/settings/ThemeScreen";
import LegalScreen from "../features/settings/LegalScreen";
import SupportHomeScreen from "../features/support/SupportHomeScreen";
import CreateTicketScreen from "../features/support/CreateTicketScreen";
import TicketDetailScreen from "../features/support/TicketDetailScreen";
import CreateDisputeScreen from "../features/support/CreateDisputeScreen";
import DisputeDetailScreen from "../features/support/DisputeDetailScreen";

import MainTabNavigator from "./MainTabNavigator";
import OfferOverlayNavigator from "./OfferOverlayNavigator";

const Stack = createNativeStackNavigator();

/** Walk navigation state and return the set of every screen name registered. */
function collectScreenNames(state) {
  const out = new Set();
  if (!state?.routes) return out;
  for (const route of state.routes) {
    if (route?.name) out.add(route.name);
    if (route?.state) {
      for (const inner of collectScreenNames(route.state)) out.add(inner);
    }
  }
  return out;
}

// Deep-link prefixes — paired with the `iprime` scheme in app.json. The
// scheme is shared with the customer app (each binary registers its own
// handler on-device); we keep them apart on universal links via separate
// hostnames (rider.iprime.ng here, customer.iprime.ng in the customer app).
//
// `riderapp://` is kept as a legacy prefix so notifications minted before
// Phase 8's iprime:// rebrand still parse correctly. parseDeepLink() in
// lib/notificationRoute.js strips any scheme:// prefix before matching.
const NAV_LINKING = {
  prefixes: [
    "iprime://",
    "https://rider.iprime.ng",
    "riderapp://", // legacy — keep for back-compat
  ],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: "home",
          TripTab: "trip-tab",
          EarningsTab: "earnings",
          WalletTab: "wallet",
          MeTab: "me",
        },
      },
      TripCockpit: "trip/:requestId",
      // Wallet sub-tree
      Withdraw: "wallet/withdraw",
      Beneficiaries: "wallet/beneficiaries",
      Transactions: "wallet/transactions",
      TransactionDetail: "wallet/transactions/:transactionId",
      // Earnings
      EarningsBreakdown: "earnings/breakdown",
      // Notifications & profile
      NotificationsCenter: "notifications",
      KycStatus: "kyc",
      Performance: "performance",
      VehicleInfo: "vehicle",
      EditProfile: "profile/edit",
      ProfilePhoto: "profile/photo",
      // Security & settings
      SecuritySettings: "security",
      Sessions: "security/sessions",
      ChangePin: "security/pin",
      PhoneChange: "security/phone",
      BiometricSettings: "security/biometric",
      Language: "settings/language",
      Theme: "settings/theme",
      Legal: "settings/legal",
      // Support
      SupportHome: "support",
      CreateTicket: "support/new",
      TicketDetail: "support/ticket/:ticketId",
      CreateDispute: "support/dispute/new/:requestId",
      DisputeDetail: "support/dispute/:disputeId",
    },
  },
};

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isHydrating, user } = useSelector((state) => state.auth);
  const riderStatus = useSelector((s) => s.rider?.rider?.status);
  const riderLoading = useSelector((s) => s.rider?.isLoading);
  const riderProfile = useSelector((s) => s.rider?.rider);
  const hasPinSet = useSelector((s) => s.profile?.profile?.hasPinSet);
  const profileLoaded = useSelector((s) => !!s.profile?.profile);
  const { tokens, isDark } = useTheme();
  const navigationTheme = useMemo(
    () => buildNavigationTheme(tokens, isDark),
    [tokens, isDark],
  );

  const navigationRef = useRef(null);
  const pendingActionRef = useRef(null);

  // Biometric gate: 'pending' | 'required' | 'passed'.
  const [bioGate, setBioGate] = useState("pending");

  // Register api.js silent-refresh force-logout hook.
  useEffect(() => {
    registerForceLogout(() => dispatch(forceLogout()));
  }, [dispatch]);

  // Sentry + analytics user tagging — fires whenever the authenticated
  // user changes so crash reports and events are scoped to the right
  // rider. Cleared on sign-out so a shared device doesn't leak the
  // previous rider's id into next session's breadcrumbs.
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      sentrySetUser({ id: user.id, role: user.role || "RIDER" });
      analyticsSetUser({ id: user.id, role: user.role || "RIDER" });
      sentryBreadcrumb({
        category: "auth",
        message: "user authenticated",
        level: "info",
        data: { userId: user.id, role: user.role },
      });
      track(EVENTS.LoginSucceeded, { method: "session-restore" });
    } else {
      sentrySetUser(null);
      analyticsSetUser(null);
    }
  }, [isAuthenticated, user?.id, user?.role]);

  // Boot sequence: hydrate auth + onboarding draft + fetch public settings.
  useEffect(() => {
    dispatch(hydrateAuth());
    dispatch(hydrateOnboarding());
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
        const ok = await authenticateWithBiometric("Unlock iPrime Rider");
        setBioGate(ok ? "passed" : "required");
      } catch (_) {
        setBioGate("passed");
      }
    })();
  }, [isAuthenticated, isHydrating]);

  // Once authed + bio passed: load profile + rider profile + connect socket.
  // After the rider profile lands, rehydrate an in-flight trip if there is
  // one — and resume the location stream so the customer's tracking screen
  // stops going stale. Covers force-close / cold-start so the rider picks
  // up exactly where they left off.
  useEffect(() => {
    if (!isAuthenticated || bioGate !== "passed") return;
    dispatch(fetchProfile());
    // Wallet boot — pulls balance + NUBAN so the Wallet tab is populated by
    // the time the rider taps it. Subsequent socket updates flow via the
    // notificationsBus.
    dispatch(fetchWallet()).catch?.(() => {});
    dispatch(fetchRiderProfile())
      .then(async (action) => {
        const profile = action?.payload || null;
        const active = profile?.activeRequest;
        if (!active?.id) return;
        // Hydrate trip state first (joins the socket room + sets cadence).
        dispatch(activateFromAcceptedRequest(active));
        dispatch(hydrateFromServer(active.id));
        // If the server thinks the rider is on a trip, resume the foreground
        // GPS stream. The locationStream is mode-aware so re-calling start
        // when already running is a no-op.
        try {
          const res = await locationStream.start({
            mode: "on_delivery",
            onFix: (fix) => dispatch(setLastFix(fix)),
            requestIdGetter: () => active.id,
          });
          if (res?.ok) dispatch(setStreaming(true));
        } catch (_) {
          // Permission/services failures bubble up via the existing
          // LocationServicesEnabledBanner on the Home tab.
        }
      })
      .catch(() => {});
    socketService.connect();
    const unsub = subscribeSocketToStore(dispatch, { notificationReceived });
    return () => {
      unsub?.();
    };
  }, [isAuthenticated, bioGate, dispatch]);

  // Socket lifecycle on AppState background/foreground.
  // Phase 2: also reconcile rider availability with the server on foreground
  // so the presence cache (which TTLs out after 30 s of no location fix)
  // doesn't drift if the rider was away briefly.
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
          // Best-effort re-assert availability + refetch rider snapshot.
          dispatch(reconcileFromServer()).catch?.(() => {});
          // Drop any offers whose 60 s window elapsed while we were backgrounded —
          // the server already resolved them and we'd be showing a phantom sheet.
          dispatch(offersPruneStale());
        }
      }
    });
    return () => {
      if (backgroundTimer) clearTimeout(backgroundTimer);
      sub.remove();
    };
  }, [isAuthenticated, bioGate, dispatch]);

  // Phase 2: stop the foreground GPS stream the instant auth ends or biometric
  // gate drops, so a sign-out (or session-expired forceLogout) doesn't leak
  // a running subscription into the next user's session.
  useEffect(() => {
    if (!isAuthenticated || bioGate !== "passed") {
      locationStream.stop().catch(() => {});
    }
  }, [isAuthenticated, bioGate]);

  // Push-tap routing (foreground + background).
  // Earlier phases (0-1) don't have every target screen registered yet — guard
  // against `navigation.navigate("JobOffer")` crashing by fingerprinting which
  // routes are available and falling back to Home if not.
  const safeNavigate = useCallback((action) => {
    if (!action || !navigationRef.current?.isReady?.()) return false;
    try {
      const state = navigationRef.current.getRootState?.();
      const registered = collectScreenNames(state);
      if (action.name && !registered.has(action.name)) {
        // Unknown screen — degrade to MainTabs/Home if it exists, else swallow.
        if (registered.has("MainTabs")) {
          navigationRef.current.navigate("MainTabs", { screen: "HomeTab" });
        }
        return true;
      }
      navigationRef.current.navigate(action.name, action.params);
      return true;
    } catch (_) {
      return false;
    }
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      const action = routeToScreen({
        data,
        requestId: data.requestId,
        transactionId: data.transactionId,
      });
      if (!action) return;
      if (!safeNavigate(action)) {
        pendingActionRef.current = action;
      }
    });

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
      } catch (_) {}
    })();

    return () => sub.remove();
  }, [safeNavigate]);

  const onNavReady = () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) safeNavigate(action);
  };

  if (isHydrating || bioGate === "pending") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tokens.bg.canvas,
        }}
      >
        <ActivityIndicator color={tokens.brand.default} />
      </View>
    );
  }

  if (isAuthenticated && bioGate === "required") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: tokens.bg.canvas,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: tokens.text.primary,
            marginBottom: 8,
          }}
        >
          Locked
        </Text>
        <Text style={{ color: tokens.text.muted, textAlign: "center", marginBottom: 24 }}>
          Unlock iPrime Rider with biometrics to continue.
        </Text>
        <TouchableOpacity
          onPress={async () => {
            const ok = await authenticateWithBiometric("Unlock iPrime Rider");
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

  // ── Role + status gating ──────────────────────────────────────────────────
  const role = user?.role;
  const needsBecomeRider = isAuthenticated && role !== "RIDER";
  // For a RIDER, hold in a spinner until the rider profile has loaded at least
  // once. Without this, role==="RIDER" + riderStatus===undefined would slip past
  // the gating checks and route directly to SetPin/MainTabs — wrong if the
  // server actually replies with PENDING_APPROVAL.
  const isRiderAwaitingProfile =
    isAuthenticated && role === "RIDER" && !riderProfile && riderLoading !== false;
  const isPending = role === "RIDER" && riderStatus === RIDER_STATUS.PENDING_APPROVAL;
  const isRejected = role === "RIDER" && riderStatus === RIDER_STATUS.REJECTED;
  const isSuspended = role === "RIDER" && riderStatus === RIDER_STATUS.SUSPENDED;
  const isApproved = role === "RIDER" && riderStatus === RIDER_STATUS.APPROVED;
  // After APPROVED, gate the main app on having a PIN set. Wait for profile to
  // actually load before deciding — undefined hasPinSet must not flip the gate.
  const needsPin = isApproved && profileLoaded && hasPinSet === false;

  // Hold in a spinner if we're authed as a RIDER but haven't loaded either:
  //   (a) the rider profile (drives status routing), or
  //   (b) the user profile (drives PIN routing post-approval).
  // Without this, undefined values race the gating chain and route incorrectly.
  const needsLoadingGate =
    isRiderAwaitingProfile || (isApproved && !profileLoaded);
  if (needsLoadingGate) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tokens.bg.canvas,
        }}
      >
        <ActivityIndicator color={tokens.brand.default} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={NAV_LINKING}
      onReady={onNavReady}
      onStateChange={(state) => {
        const route = state?.routes?.[state.index];
        if (route?.name) socketService.setCurrentRouteName(route.name);
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </Stack.Group>
        ) : isSuspended ? (
          <Stack.Screen name="Suspended" component={SuspendedScreen} />
        ) : isRejected ? (
          <Stack.Group>
            <Stack.Screen name="Rejected" component={RejectedScreen} />
            <Stack.Screen name="BecomeRiderPersonal" component={BecomeRiderPersonalStep} />
            <Stack.Screen name="BecomeRiderVehicle" component={BecomeRiderVehicleStep} />
            <Stack.Screen name="BecomeRiderDocuments" component={BecomeRiderDocumentsStep} />
            <Stack.Screen name="BecomeRiderReview" component={BecomeRiderReviewSubmitStep} />
            <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
          </Stack.Group>
        ) : isPending ? (
          <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
        ) : needsBecomeRider ? (
          <Stack.Group>
            <Stack.Screen name="BecomeRiderPersonal" component={BecomeRiderPersonalStep} />
            <Stack.Screen name="BecomeRiderVehicle" component={BecomeRiderVehicleStep} />
            <Stack.Screen name="BecomeRiderDocuments" component={BecomeRiderDocumentsStep} />
            <Stack.Screen name="BecomeRiderReview" component={BecomeRiderReviewSubmitStep} />
            <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
          </Stack.Group>
        ) : needsPin ? (
          <Stack.Group>
            <Stack.Screen
              name="SetPin"
              component={SetTransactionPinScreen}
              initialParams={{ nextScreen: "EnableBiometric" }}
            />
            <Stack.Screen name="EnableBiometric" component={EnableBiometricScreen} />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen
              name="TripCockpit"
              component={TripCockpitScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="EarningsBreakdown" component={EarningsBreakdownScreen} />
            <Stack.Screen name="Withdraw" component={WithdrawScreen} />
            <Stack.Screen name="Beneficiaries" component={BeneficiariesScreen} />
            <Stack.Screen name="Transactions" component={TransactionsScreen} />
            <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
            <Stack.Screen
              name="LocationPermissionRecovery"
              component={LocationPermissionRecoveryScreen}
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
            {/* Phase 7 — profile / settings / support / notifications */}
            <Stack.Screen name="NotificationsCenter" component={NotificationsCenterScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ProfilePhoto" component={ProfilePhotoScreen} />
            <Stack.Screen name="VehicleInfo" component={VehicleInfoScreen} />
            <Stack.Screen name="KycStatus" component={KycStatusScreen} />
            <Stack.Screen name="Performance" component={PerformanceScreen} />
            <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
            <Stack.Screen name="Sessions" component={SessionsScreen} />
            <Stack.Screen name="ChangePin" component={ChangePinScreen} />
            <Stack.Screen name="PhoneChange" component={PhoneChangeScreen} />
            <Stack.Screen name="BiometricSettings" component={BiometricSettingsScreen} />
            <Stack.Screen name="Language" component={LanguageScreen} />
            <Stack.Screen name="Theme" component={ThemeScreen} />
            <Stack.Screen name="Legal" component={LegalScreen} />
            <Stack.Screen name="SupportHome" component={SupportHomeScreen} />
            <Stack.Screen name="CreateTicket" component={CreateTicketScreen} />
            <Stack.Screen name="TicketDetail" component={TicketDetailScreen} />
            <Stack.Screen name="CreateDispute" component={CreateDisputeScreen} />
            <Stack.Screen name="DisputeDetail" component={DisputeDetailScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
      <OfferOverlayNavigator />
    </NavigationContainer>
  );
}
