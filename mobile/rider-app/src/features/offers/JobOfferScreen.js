import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { useTheme } from "../../theme";
import OfferCountdownRing from "../../components/OfferCountdownRing";
import OfferMapPreview from "../../components/OfferMapPreview";
import {
  acceptOffer,
  offerDismissed,
  offerRejected,
  offerExpired,
  clearOfferError,
} from "../../store/slices/offersSlice";
import { activateFromAcceptedRequest } from "../../store/slices/tripSlice";
import { startOfferAlert, stopOfferAlert } from "../../services/offerRingtone";
import { formatNaira } from "../../lib/formatters";

const AUTO_DISMISS_MS = 2_000;

/**
 * Full-screen job offer sheet, mounted by OfferOverlayNavigator.
 *
 * Visual states (driven by `offersSlice.status`):
 *   - 'showing'   → countdown + map + actions (Accept primary, Reject ghost)
 *   - 'accepting' → spinner over Accept button
 *   - 'accepted'  → success flash → auto-dismiss + activate trip
 *   - 'taken'     → "Another rider got it" badge → auto-dismiss
 *   - 'expired'   → "Offer expired" badge → auto-dismiss
 *   - 'error'     → "Try again" CTA with the error code visible
 *
 * Stops the offer alert + clears the offer from the queue on every terminal state.
 */
export default function JobOfferScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const queue = useSelector((s) => s.offers?.queue) || [];
  const activeOfferId = useSelector((s) => s.offers?.activeOfferId);
  const status = useSelector((s) => s.offers?.status);
  const error = useSelector((s) => s.offers?.error);

  const active = useMemo(
    () => queue.find((o) => o.requestId === activeOfferId) || null,
    [queue, activeOfferId],
  );

  // Defensive: clean up orphaned activeOfferId. If `activeOfferId` is set but
  // the matching queue entry vanished (rapid state churn), dismiss so the
  // overlay isn't stuck rendering null forever.
  useEffect(() => {
    if (activeOfferId && !active) {
      dispatch(offerDismissed({ requestId: activeOfferId, outcome: "orphaned" }));
    }
  }, [activeOfferId, active, dispatch]);

  // Track the last-used idempotency key per request so retries replay the
  // same key (server returns the original response).
  const idempotencyKeyRef = useRef({});

  // ── Lifecycle: alert on mount, stop on unmount or status change away from 'showing' ──
  useEffect(() => {
    if (status === "showing" && activeOfferId) {
      startOfferAlert().catch(() => {});
    } else {
      stopOfferAlert().catch(() => {});
    }
    return () => {
      stopOfferAlert().catch(() => {});
    };
  }, [status, activeOfferId]);

  // ── Terminal-state auto-dismiss + trip activation ─────────────────────────
  useEffect(() => {
    if (!activeOfferId) return;
    if (status === "accepted") {
      // Trip activation already happened in the accept handler. Just dismiss.
      const id = setTimeout(() => {
        dispatch(offerDismissed({ requestId: activeOfferId, outcome: "accepted" }));
      }, 400);
      return () => clearTimeout(id);
    }
    if (status === "taken") {
      Toast.show({
        type: "info",
        text1: t("offer.takenToast", "Another rider got it"),
      });
      const id = setTimeout(() => {
        dispatch(offerDismissed({ requestId: activeOfferId, outcome: "taken" }));
      }, AUTO_DISMISS_MS);
      return () => clearTimeout(id);
    }
    if (status === "expired") {
      Toast.show({
        type: "error",
        text1: t("offer.expiredToast", "Offer expired"),
      });
      const id = setTimeout(() => {
        dispatch(offerDismissed({ requestId: activeOfferId, outcome: "expired" }));
      }, AUTO_DISMISS_MS);
      return () => clearTimeout(id);
    }
  }, [status, activeOfferId, dispatch, t]);

  const onCountdownExpire = useCallback(() => {
    if (!activeOfferId) return;
    if (status === "showing" || status === "error") {
      dispatch(offerExpired(activeOfferId));
    }
  }, [activeOfferId, status, dispatch]);

  const onReject = useCallback(() => {
    if (!activeOfferId) return;
    dispatch(offerRejected(activeOfferId));
  }, [activeOfferId, dispatch]);

  const onAccept = useCallback(async () => {
    if (!activeOfferId) return;
    const key = idempotencyKeyRef.current[activeOfferId];
    const action = await dispatch(
      acceptOffer({ requestId: activeOfferId, idempotencyKey: key }),
    );

    if (acceptOffer.fulfilled.match(action)) {
      // Activate the trip + navigate to cockpit BEFORE the auto-dismiss
      // effect fires the offerDismissed action, so the cockpit can read
      // tripSlice.activeRequestId.
      const activateAction = await dispatch(activateFromAcceptedRequest(action.payload.payload));
      if (activateFromAcceptedRequest.fulfilled.match(activateAction)) {
        navigation.navigate("MainTabs"); // Phase 4 will register TripCockpit here.
      } else {
        // The HTTP accept succeeded but trip activation failed (malformed payload).
        // Surface to the rider so they can contact support before the offer
        // auto-dismisses and they're left wondering where the trip went.
        Toast.show({
          type: "error",
          text1: t("offer.activationFailed", "Couldn't start trip"),
          text2: t("offer.activationFailedSub", "Contact support. Your acceptance was recorded."),
          visibilityTime: 6000,
        });
        if (__DEV__) {
          console.error("[JobOfferScreen] activateFromAcceptedRequest rejected:", activateAction.error);
        }
        // Still dismiss the offer overlay so the rider isn't trapped.
        dispatch(offerDismissed({ requestId: activeOfferId, outcome: "accepted-activate-failed" }));
      }
    } else {
      // Persist the key so a "Try again" tap replays the same request.
      const payload = action.payload || {};
      if (payload.idempotencyKey) {
        idempotencyKeyRef.current[activeOfferId] = payload.idempotencyKey;
      }
    }
  }, [activeOfferId, dispatch, navigation, t]);

  const onTryAgain = useCallback(() => {
    dispatch(clearOfferError());
    onAccept();
  }, [dispatch, onAccept]);

  if (!active) return null; // Overlay parent already guards this; defensive.

  const p = active.payload || {};
  const fare = p.fare ?? p.estimatedFare ?? p.riderEarning;
  const distanceKm = p.distanceKm;
  const eta = p.eta || p.estimatedMinutes;

  const isAccepting = status === "accepting";
  const isTaken = status === "taken";
  const isExpired = status === "expired";
  const isError = status === "error";
  const isShowing = status === "showing";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      edges={["top", "bottom"]}
    >
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header strip */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: tokens.brand.soft,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name="flash" size={20} color={tokens.brand.default} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: tokens.brand.default, letterSpacing: 1 }}>
              NEW JOB OFFER
            </Text>
            <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 2 }}>
              {p.type ? p.type.toLowerCase() : t("offer.delivery", "Delivery")}
            </Text>
          </View>
        </View>

        {/* Countdown ring */}
        <View style={{ alignItems: "center", marginBottom: 18 }}>
          <OfferCountdownRing
            offeredAt={active.offeredAt}
            ttlSeconds={active.ttl}
            onExpire={onCountdownExpire}
          />
        </View>

        {/* Terminal-state badges */}
        {isTaken ? (
          <Badge tokens={tokens} kind="info" icon="time-outline" text={t("offer.takenBadge", "Taken by another rider")} />
        ) : null}
        {isExpired ? (
          <Badge tokens={tokens} kind="error" icon="alert-circle-outline" text={t("offer.expiredBadge", "Offer expired")} />
        ) : null}
        {isError ? (
          <Badge
            tokens={tokens}
            kind="error"
            icon="warning-outline"
            text={error?.message || t("offer.errorBadge", "Couldn't accept this offer")}
          />
        ) : null}

        {/* Earnings + distance + ETA */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: tokens.bg.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.border.default,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Stat tokens={tokens} label={t("offer.fare", "Estimated fare")} value={fare ? formatNaira(fare) : "-"} />
          <Stat
            tokens={tokens}
            label={t("offer.distance", "Distance")}
            value={typeof distanceKm === "number" ? `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km` : "-"}
          />
          <Stat
            tokens={tokens}
            label={t("offer.eta", "Est. minutes")}
            value={typeof eta === "number" ? `${Math.round(eta)} min` : "-"}
            last
          />
        </View>

        {/* Map preview */}
        <OfferMapPreview
          pickupLat={p.pickupLat}
          pickupLng={p.pickupLng}
          dropoffLat={p.dropoffLat}
          dropoffLng={p.dropoffLng}
        />

        {/* Pickup + dropoff addresses */}
        <View style={{ marginTop: 16 }}>
          <AddressRow
            tokens={tokens}
            color={tokens.brand.default}
            icon="storefront"
            label={t("offer.pickup", "Pickup")}
            address={p.pickupAddress}
          />
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: tokens.border.default,
              borderStyle: "dashed",
              height: 14,
              marginLeft: 13,
            }}
          />
          <AddressRow
            tokens={tokens}
            color={tokens.status.success}
            icon="flag"
            label={t("offer.dropoff", "Drop-off")}
            address={p.dropoffAddress}
          />
        </View>
      </ScrollView>

      {/* Action bar - fixed at the bottom */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 12,
          borderTopWidth: 1,
          borderTopColor: tokens.border.default,
          backgroundColor: tokens.bg.surface,
          flexDirection: "row",
          gap: 12,
        }}
      >
        {isError ? (
          <TouchableOpacity
            onPress={onTryAgain}
            accessibilityRole="button"
            accessibilityLabel={t("offer.tryAgain", "Try again")}
            style={{
              flex: 1,
              padding: 16,
              borderRadius: 14,
              alignItems: "center",
              backgroundColor: tokens.brand.default,
            }}
          >
            <Text style={{ color: tokens.text.onBrand, fontSize: 15, fontWeight: "800" }}>
              {t("offer.tryAgain", "Try again")}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              onPress={onReject}
              disabled={!isShowing}
              accessibilityRole="button"
              accessibilityLabel={t("offer.reject", "Reject")}
              accessibilityState={{ disabled: !isShowing }}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: tokens.border.default,
                backgroundColor: tokens.bg.surfaceMuted,
                opacity: isShowing ? 1 : 0.5,
              }}
            >
              <Text style={{ color: tokens.text.muted, fontSize: 15, fontWeight: "800" }}>
                {t("offer.reject", "Reject")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAccept}
              disabled={!isShowing || isAccepting}
              accessibilityRole="button"
              accessibilityLabel={t("offer.accept", "Accept")}
              accessibilityState={{ disabled: !isShowing || isAccepting, busy: isAccepting }}
              style={{
                flex: 1.5,
                padding: 16,
                borderRadius: 14,
                alignItems: "center",
                backgroundColor: tokens.brand.default,
                opacity: isShowing || isAccepting ? 1 : 0.5,
              }}
            >
              {isAccepting ? (
                <ActivityIndicator color={tokens.text.onBrand} />
              ) : (
                <Text style={{ color: tokens.text.onBrand, fontSize: 15, fontWeight: "800" }}>
                  {t("offer.accept", "Accept")}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Stat({ tokens, label, value, last }) {
  return (
    <View
      style={{
        flex: 1,
        borderRightWidth: last ? 0 : 1,
        borderRightColor: tokens.border.subtle,
        paddingHorizontal: 8,
      }}
    >
      <Text style={{ fontSize: 11, color: tokens.text.muted, marginBottom: 4 }}>{label}</Text>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "800",
          color: tokens.text.primary,
          letterSpacing: -0.3,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function AddressRow({ tokens, color, icon, label, address }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={14} color="#fff" />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.text.muted, letterSpacing: 0.5 }}>
          {label.toUpperCase()}
        </Text>
        <Text
          style={{ fontSize: 14, color: tokens.text.primary, fontWeight: "600", marginTop: 2 }}
          numberOfLines={2}
        >
          {address || "-"}
        </Text>
      </View>
    </View>
  );
}

function Badge({ tokens, kind, icon, text }) {
  const bg =
    kind === "error"
      ? tokens.status.errorSoft
      : kind === "info"
        ? tokens.status.infoSoft
        : tokens.brand.soft;
  const fg =
    kind === "error"
      ? tokens.status.errorStrong
      : kind === "info"
        ? tokens.status.infoStrong
        : tokens.brand.strong;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: bg,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 14,
      }}
    >
      <Ionicons name={icon} size={18} color={fg} />
      <Text
        style={{ marginLeft: 10, color: fg, fontWeight: "700", flex: 1, fontSize: 13 }}
        numberOfLines={2}
      >
        {text}
      </Text>
    </View>
  );
}
