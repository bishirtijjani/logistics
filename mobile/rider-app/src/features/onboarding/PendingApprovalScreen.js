import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme";
import { logout } from "../../store/slices/authSlice";
import { fetchRiderProfile } from "../../store/slices/riderSlice";
import { fetchProfile } from "../../store/slices/profileSlice";
import { RIDER_STATUS } from "../../lib/constants";

const FOREGROUND_POLL_MS = 30_000;

/**
 * Pending Approval gating screen.
 *
 *   - Polls `GET /api/rider/profile` every 30 s while screen is foregrounded.
 *   - Refetches on every AppState `active` event so a backgrounded → foregrounded
 *     app sees the new status without waiting for the timer.
 *   - When BLK-PushOnApproval ships, `notification:new` with type=RIDER_APPROVED
 *     dispatches `fetchRiderProfile` (via notificationsBus) which updates
 *     `rider.rider.status` and flips the AppNavigator role gate automatically.
 *   - Status === REJECTED → AppNavigator routes to RejectedScreen on next tick.
 *   - Status === APPROVED → AppNavigator routes to SetPin → EnableBiometric → MainTabs.
 */
export default function PendingApprovalScreen() {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const rider = useSelector((s) => s.rider?.rider);
  const isLoading = useSelector((s) => s.rider?.isLoading);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);

  const refetch = useCallback(async () => {
    try {
      // Refresh both: rider profile drives status transitions; user profile
      // carries hasPinSet which gates the SetPin screen post-approval.
      await Promise.all([dispatch(fetchRiderProfile()), dispatch(fetchProfile())]);
    } catch (_) {}
  }, [dispatch]);

  // Initial fetch + polling timer while screen is mounted.
  useEffect(() => {
    refetch();
    const tick = () => {
      refetch();
      timerRef.current = setTimeout(tick, FOREGROUND_POLL_MS);
    };
    timerRef.current = setTimeout(tick, FOREGROUND_POLL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refetch]);

  // Refetch on AppState `active` for instant-feeling status updates.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const submittedAt = rider?.createdAt
    ? new Date(rider.createdAt).toLocaleString()
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />
        }
      >
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: tokens.brand.soft,
              borderWidth: 1,
              borderColor: tokens.brand.softBorder,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Ionicons name="hourglass-outline" size={42} color={tokens.brand.default} />
          </View>

          <Text
            accessibilityRole="header"
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: tokens.text.primary,
              marginBottom: 8,
              textAlign: "center",
              letterSpacing: -0.5,
            }}
          >
            {t("onboarding.pendingTitle", "Awaiting approval")}
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: tokens.text.muted,
              textAlign: "center",
              marginBottom: 24,
              lineHeight: 22,
            }}
          >
            {t(
              "onboarding.pendingBody",
              "We're reviewing your application. You'll be notified the moment an admin approves it — usually within a few hours.",
            )}
          </Text>

          {submittedAt ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: tokens.bg.surfaceMuted,
                marginBottom: 24,
              }}
            >
              <Text style={{ fontSize: 12, color: tokens.text.muted }}>
                {t("onboarding.submittedAt", "Submitted")}: {submittedAt}
              </Text>
            </View>
          ) : null}

          {isLoading && !refreshing ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <ActivityIndicator color={tokens.brand.default} size="small" />
              <Text style={{ color: tokens.text.muted, marginLeft: 8, fontSize: 13 }}>
                {t("common.loading", "Loading…")}
              </Text>
            </View>
          ) : null}

          <Text style={{ fontSize: 12, color: tokens.text.placeholder, textAlign: "center", marginBottom: 32 }}>
            {t("onboarding.pendingPullHint", "Pull down to refresh status")}
          </Text>

          <TouchableOpacity
            onPress={() => dispatch(logout())}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: tokens.border.default,
            }}
          >
            <Text style={{ color: tokens.text.muted, fontWeight: "600" }}>
              {t("common.signOut", "Sign out")}
            </Text>
          </TouchableOpacity>

          {/* Diagnostic chip for QA — shows current status from the server. */}
          {rider?.status ? (
            <Text style={{ fontSize: 11, color: tokens.text.placeholder, marginTop: 16 }}>
              status: {rider.status}
              {rider.status === RIDER_STATUS.PENDING_APPROVAL ? "" : " (gate will route on next tick)"}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
