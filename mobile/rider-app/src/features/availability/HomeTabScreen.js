import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  AppState,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useKeepAwake } from "expo-keep-awake";

import { useTheme } from "../../theme";
import AvailabilityToggle from "../../components/AvailabilityToggle";
import LocationServicesEnabledBanner from "../../components/LocationServicesEnabledBanner";
import EarningsTodaySnapshot from "../../components/EarningsTodaySnapshot";
import {
  goOnline,
  goOffline,
  fetchRiderProfile,
  clearForceOfflineReason,
} from "../../store/slices/riderSlice";
import { fetchRiderEarnings } from "../../store/slices/earningsSlice";
import { AVAILABILITY } from "../../lib/constants";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const ONLINE_NUDGE_BACKGROUND_MS = 90_000; // 90 s

/**
 * Phase 2 Home tab.
 *
 *   - Big AvailabilityToggle. Tapping it dispatches goOnline / goOffline.
 *   - LocationServicesEnabledBanner self-renders only if permission / services
 *     need fixing.
 *   - EarningsTodaySnapshot driven by fetchRiderEarnings (refresh on mount,
 *     on pull-to-refresh, on AppState `active`).
 *   - useKeepAwake while ONLINE — screen stays awake so foreground GPS keeps
 *     flowing. Removed when OFFLINE so the device behaves normally.
 *   - 4-hour ONLINE cap — after 4 hours, prompts the rider to confirm or
 *     go offline. Mitigates riders who forget they're online.
 *   - 90s background auto-offline — if the rider backgrounds the app for
 *     more than 90 s while ONLINE-idle, the server presence cache will TTL
 *     out anyway; we PATCH OFFLINE proactively so the UI stays truthful.
 *     Active trips don't get cancelled — only the availability flips.
 */
export default function HomeTabScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const availability = useSelector((s) => s.rider?.availability) || AVAILABILITY.OFFLINE;
  const busy = useSelector((s) => s.rider?.isTogglingAvailability);
  const lastFix = useSelector((s) => s.rider?.lastFix);
  const lastForceOfflineReason = useSelector((s) => s.rider?.lastForceOfflineReason);
  const user = useSelector((s) => s.auth?.user);
  const activeTripId = useSelector((s) => s.trip?.activeRequestId);

  const isOnline = availability === AVAILABILITY.ONLINE || availability === AVAILABILITY.ON_DELIVERY;
  const isOnDelivery = availability === AVAILABILITY.ON_DELIVERY;

  // Keep the device screen awake while ONLINE. The hook is a no-op when the
  // component is unmounted, so going OFFLINE → unmount → screen sleeps normally.
  // We mount it unconditionally inside a child wrapper so the hook itself is
  // always called (React rules of hooks).
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {isOnline ? <KeepAwakeWhileOnline /> : null}
      <HomeBody
        dispatch={dispatch}
        navigation={navigation}
        t={t}
        tokens={tokens}
        availability={availability}
        busy={busy}
        lastFix={lastFix}
        lastForceOfflineReason={lastForceOfflineReason}
        user={user}
        activeTripId={activeTripId}
        isOnline={isOnline}
        isOnDelivery={isOnDelivery}
      />
    </SafeAreaView>
  );
}

function KeepAwakeWhileOnline() {
  // Dedicated component so the hook is mounted/unmounted with the ONLINE state.
  useKeepAwake();
  return null;
}

function HomeBody({
  dispatch,
  navigation,
  t,
  tokens,
  availability,
  busy,
  lastFix,
  lastForceOfflineReason,
  user,
  activeTripId,
  isOnline,
  isOnDelivery,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const onlineSinceRef = useRef(null);
  const backgroundedAtRef = useRef(null);
  const fourHourTimerRef = useRef(null);
  const lastForceOfflineHandledRef = useRef(null);

  // ── Toast on force-offline events from server kill-switch ──────────────
  useEffect(() => {
    if (!lastForceOfflineReason) return;
    if (lastForceOfflineHandledRef.current === lastForceOfflineReason) return;
    lastForceOfflineHandledRef.current = lastForceOfflineReason;
    Toast.show({
      type: "error",
      text1: t("home.forceOfflineToast", "You were taken offline"),
      text2: t("home.forceOfflineToastSub", "An admin set your account to offline."),
      visibilityTime: 5000,
    });
    dispatch(clearForceOfflineReason());
  }, [lastForceOfflineReason, t, dispatch]);

  // ── Initial fetches ────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchRiderProfile());
    dispatch(fetchRiderEarnings());
  }, [dispatch]);

  // ── 4-hour ONLINE cap ──────────────────────────────────────────────────
  useEffect(() => {
    if (fourHourTimerRef.current) {
      clearTimeout(fourHourTimerRef.current);
      fourHourTimerRef.current = null;
    }
    if (isOnline) {
      onlineSinceRef.current = onlineSinceRef.current || Date.now();
      const elapsed = Date.now() - onlineSinceRef.current;
      const remaining = Math.max(0, FOUR_HOURS_MS - elapsed);
      fourHourTimerRef.current = setTimeout(() => {
        Alert.alert(
          t("home.fourHourTitle", "Still online?"),
          t(
            "home.fourHourBody",
            "You've been online for 4 hours. Tap Confirm to stay online or Go Offline to stop receiving jobs.",
          ),
          [
            {
              text: t("home.fourHourGoOffline", "Go offline"),
              style: "destructive",
              onPress: () => dispatch(goOffline({ reason: "four_hour_cap" })),
            },
            {
              text: t("home.fourHourConfirm", "Confirm"),
              onPress: () => { onlineSinceRef.current = Date.now(); },
            },
          ],
          { cancelable: false },
        );
      }, remaining);
    } else {
      onlineSinceRef.current = null;
    }
    return () => {
      if (fourHourTimerRef.current) {
        clearTimeout(fourHourTimerRef.current);
        fourHourTimerRef.current = null;
      }
    };
  }, [isOnline, t, dispatch]);

  // ── 90-s background auto-offline (only while ONLINE-idle, NOT on-delivery) ──
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        backgroundedAtRef.current = Date.now();
        return;
      }
      // Foreground: refresh earnings + check 90s window
      const wasBg = backgroundedAtRef.current;
      backgroundedAtRef.current = null;
      dispatch(fetchRiderEarnings());
      if (
        wasBg &&
        availability === AVAILABILITY.ONLINE &&
        !activeTripId &&
        Date.now() - wasBg > ONLINE_NUDGE_BACKGROUND_MS
      ) {
        dispatch(goOffline({ reason: "background_timeout" }));
      }
    });
    return () => sub.remove();
  }, [availability, activeTripId, dispatch]);

  const onToggle = useCallback(async () => {
    if (isOnDelivery) return; // toggle disabled mid-trip
    if (isOnline) {
      await dispatch(goOffline({}));
      return;
    }
    const action = await dispatch(goOnline());
    if (goOnline.rejected.match(action)) {
      const reason = action.payload?.reason;
      if (reason === "permission_denied" || reason === "services_disabled") {
        navigation.navigate("LocationPermissionRecovery");
      } else {
        Toast.show({
          type: "error",
          text1: t("home.goOnlineFailed", "Couldn't go online"),
          text2: action.payload?.message || t("errors.UNKNOWN_ERROR"),
        });
      }
    }
  }, [isOnline, isOnDelivery, dispatch, navigation, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      dispatch(fetchRiderProfile()),
      dispatch(fetchRiderEarnings()),
    ]);
    setRefreshing(false);
  }, [dispatch]);

  const firstName = user?.firstName || user?.name?.split?.(" ")?.[0] || "rider";

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />
      }
    >
      {/* Greeting */}
      <View style={{ marginBottom: 18 }}>
        <Text style={{ fontSize: 13, color: tokens.text.muted }}>
          {t("home.greetingLead", "Hello")},
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 26,
            fontWeight: "800",
            color: tokens.text.primary,
            letterSpacing: -0.5,
          }}
        >
          {firstName}
        </Text>
      </View>

      {/* Permission / services banner — self-renders only when needed */}
      <LocationServicesEnabledBanner />

      {/* ONLINE banner — clear reminder of the foreground-only constraint */}
      {isOnline ? (
        <View
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 14,
            backgroundColor: tokens.brand.soft,
            borderWidth: 1,
            borderColor: tokens.brand.softBorder,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons name="information-circle" size={20} color={tokens.brand.strong} />
          <Text style={{ marginLeft: 10, flex: 1, fontSize: 12, color: tokens.text.primary, lineHeight: 17 }}>
            {t(
              "home.onlineBanner",
              "Keep this screen visible to receive jobs. The screen will stay on while you're online.",
            )}
          </Text>
        </View>
      ) : null}

      {/* Big toggle */}
      <View style={{ marginTop: 16 }}>
        <AvailabilityToggle
          availability={availability}
          busy={busy}
          onPress={onToggle}
        />
      </View>

      {/* Last fix diagnostic — only when ONLINE */}
      {isOnline && lastFix ? (
        <Text style={{ marginTop: 8, fontSize: 11, color: tokens.text.placeholder, textAlign: "right" }}>
          Last fix · {formatLastFix(lastFix)}
        </Text>
      ) : null}

      {/* Earnings snapshot */}
      <EarningsTodaySnapshot onSeeAll={() => navigation.navigate("EarningsTab")} />

      {/* Performance deep link — Phase 7 will register the target */}
      <View
        style={{
          marginTop: 16,
          borderRadius: 14,
          backgroundColor: tokens.bg.surface,
          borderWidth: 1,
          borderColor: tokens.border.default,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="trophy-outline" size={22} color={tokens.brand.default} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>
            {t("home.performanceTitle", "Your performance")}
          </Text>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
            {t("home.performanceBody", "Acceptance rate, on-time %, ratings.")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={tokens.text.muted} />
      </View>
    </ScrollView>
  );
}

function formatLastFix(fix) {
  if (!fix?.capturedAt) return "—";
  const ageSec = Math.max(0, Math.round((Date.now() - fix.capturedAt) / 1000));
  if (ageSec < 5) return "just now";
  if (ageSec < 60) return `${ageSec}s ago`;
  const ageMin = Math.round(ageSec / 60);
  return `${ageMin}m ago`;
}
