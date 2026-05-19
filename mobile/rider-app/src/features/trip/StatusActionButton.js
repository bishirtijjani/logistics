import React from "react";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { STATUS } from "../../lib/constants";

/**
 * Big primary action button on the cockpit. Label + behaviour change with
 * the current trip status:
 *
 *   RIDER_ASSIGNED       → "I'm on my way to pickup"        (PATCH RIDER_EN_ROUTE)
 *   RIDER_EN_ROUTE       → "I've arrived at pickup"          (sets arrivedAt.pickup)
 *   RIDER_EN_ROUTE (arrived) → "Confirm pickup"               (PATCH PICKED_UP)
 *   PICKED_UP            → "I'm on my way to dropoff"        (PATCH IN_TRANSIT)
 *   IN_TRANSIT           → "I've arrived at dropoff"          (sets arrivedAt.dropoff)
 *   IN_TRANSIT (arrived) → "Complete delivery"                (PATCH DELIVERED via POD flow)
 *   DELIVERED            → "Settling..." (read-only, settling spinner)
 *   CANCELLED            → null (parent surfaces the cancelled banner instead)
 *
 * Action contract — `onAction({ kind, nextStatus? })`:
 *   - `kind: 'patch'`        — caller patches FSM to `nextStatus` (Idempotency-Key handled in tripSlice).
 *   - `kind: 'arrive-pickup' | 'arrive-dropoff'` — caller dispatches tripArrived(...).
 *   - `kind: 'complete'`     — caller opens the POD sheet (Phase 5 hands DELIVERED PATCH).
 */
export default function StatusActionButton({
  status,
  arrivedPickup,
  arrivedDropoff,
  patching,
  onAction,
}) {
  const { tokens } = useTheme();
  const { t } = useT();
  const action = computeAction({ status, arrivedPickup, arrivedDropoff, t });
  if (!action) return null;

  return (
    <TouchableOpacity
      onPress={() => {
        if (patching) return;
        onAction(action);
      }}
      disabled={patching || action.disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: patching || action.disabled, busy: patching }}
      accessibilityLabel={action.label}
      style={{
        backgroundColor: action.disabled ? tokens.border.strong : tokens.brand.default,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        opacity: patching ? 0.7 : 1,
      }}
    >
      {patching ? (
        <ActivityIndicator color={tokens.text.onBrand} />
      ) : (
        <>
          <Ionicons name={action.icon} size={20} color={tokens.text.onBrand} />
          <Text
            style={{
              marginLeft: 10,
              color: tokens.text.onBrand,
              fontWeight: "700",
              fontSize: 15,
              flexShrink: 1,
            }}
            numberOfLines={2}
          >
            {action.label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function computeAction({ status, arrivedPickup, arrivedDropoff, t }) {
  switch (status) {
    case STATUS.RIDER_ASSIGNED:
      return {
        kind: "patch",
        nextStatus: STATUS.RIDER_EN_ROUTE,
        label: t("trip.action.onMyWayPickup", "I'm on my way to pickup"),
        icon: "navigate-outline",
      };
    case STATUS.RIDER_EN_ROUTE:
      if (!arrivedPickup) {
        return {
          kind: "arrive-pickup",
          label: t("trip.action.arrivedPickup", "I've arrived at pickup"),
          icon: "location-outline",
        };
      }
      return {
        kind: "patch",
        nextStatus: STATUS.PICKED_UP,
        label: t("trip.action.confirmPickup", "Confirm pickup"),
        icon: "checkmark-circle-outline",
      };
    case STATUS.PICKED_UP:
      return {
        kind: "patch",
        nextStatus: STATUS.IN_TRANSIT,
        label: t("trip.action.onMyWayDropoff", "I'm on my way to dropoff"),
        icon: "navigate-outline",
      };
    case STATUS.IN_TRANSIT:
      if (!arrivedDropoff) {
        return {
          kind: "arrive-dropoff",
          label: t("trip.action.arrivedDropoff", "I've arrived at dropoff"),
          icon: "location-outline",
        };
      }
      return {
        kind: "complete",
        label: t("trip.action.complete", "Complete delivery"),
        icon: "flag-outline",
      };
    case STATUS.DELIVERED:
      return {
        kind: "settling",
        label: t("trip.action.settling", "Settling…"),
        icon: "hourglass-outline",
        disabled: true,
      };
    default:
      return null;
  }
}
