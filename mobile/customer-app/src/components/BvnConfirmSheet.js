import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

const { height } = Dimensions.get("window");

/**
 * Confirmation sheet shown right before BVN verification submits.
 * Used while phone-OTP is bypassed - the only friction we have left between
 * the form and KatPay account provisioning, so the warning copy matters.
 */
export default function BvnConfirmSheet({
  isVisible,
  onClose,
  onConfirm,
  details,
  submitting,
  error,
}) {
  const { tokens } = useTheme();
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : height,
      duration: isVisible ? 300 : 200,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  return (
    <Modal visible={isVisible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <TouchableOpacity
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: tokens.overlay.scrim }}
          onPress={submitting ? undefined : onClose}
          activeOpacity={1}
        />

        <Animated.View
          style={{
            backgroundColor: tokens.bg.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingBottom: 32,
            maxHeight: height * 0.85,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View style={{ width: 40, height: 4, backgroundColor: tokens.border.default, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 20 }} />

          <View style={{ alignItems: "center", marginBottom: 20, position: "relative" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: tokens.text.primary, marginBottom: 6 }}>
              Confirm your details
            </Text>
            <Text style={{ fontSize: 13, color: tokens.text.muted, textAlign: "center", lineHeight: 18 }}>
              Make sure these match your BVN record exactly.
            </Text>
            {!submitting && (
              <TouchableOpacity style={{ position: "absolute", right: 0, top: 0, padding: 4 }} onPress={onClose}>
                <Ionicons name="close" size={24} color={tokens.text.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Details */}
          <View style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Row label="BVN" value={details?.bvn} mono />
            <Row label="First name" value={details?.firstName} />
            <Row label="Last name" value={details?.lastName} />
            <Row label="Phone (BVN-linked)" value={details?.bvnPhone} mono last />
          </View>

          {/* Warning */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              backgroundColor: tokens.status.warningSoft,
              borderRadius: 12,
              padding: 14,
              marginBottom: error ? 12 : 20,
              borderWidth: 1,
              borderColor: tokens.status.warningStrong,
            }}
          >
            <Ionicons name="warning" size={18} color={tokens.status.warningStrong} style={{ marginRight: 10, marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: tokens.status.warningStrong }}>
              Once confirmed, your wallet's virtual account is created with these exact details.
              Typos cannot be corrected later without contacting support.
            </Text>
          </View>

          {error ? (
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.status.errorSoft, borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Ionicons name="alert-circle" size={16} color={tokens.status.error} />
              <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: "500", flex: 1, color: tokens.status.error }}>{error}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: tokens.border.default,
                opacity: submitting ? 0.5 : 1,
              }}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>Go back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: "center",
                backgroundColor: tokens.brand.default,
                opacity: submitting ? 0.7 : 1,
              }}
              onPress={onConfirm}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={tokens.text.onBrand} />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.onBrand }}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Row({ label, value, mono, last }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: tokens.border.default,
      }}
    >
      <Text style={{ fontSize: 13, color: tokens.text.muted }}>{label}</Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: tokens.text.primary,
          fontFamily: mono ? "Courier" : undefined,
          maxWidth: "60%",
          textAlign: "right",
        }}
        numberOfLines={1}
      >
        {value || "-"}
      </Text>
    </View>
  );
}
