import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Share, Alert, Clipboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch } from "react-redux";
import { useT } from "../../i18n/useT";
import { useTheme } from "../../theme";
import { fetchUtilityPayment } from "../../store/slices/utilitySlice";

const POLL_MS = 3000;
const MAX_POLLS = 60;

const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;

/**
 * Post-purchase screen for electricity. Polls the payment row until the token
 * arrives (worker settles) or the payment fails/refunds.
 */
export default function ElectricityResultScreen({ route, navigation }) {
  const dispatch = useDispatch();
  const { t } = useT();
  const { tokens } = useTheme();
  const { paymentId, amount, meterNumber, biller, beneficiaryName: initialName } = route.params || {};

  const [status, setStatus] = useState("PROCESSING");
  const [token, setToken] = useState(null);
  const [beneficiaryName, setBeneficiaryName] = useState(initialName || null);
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const payment = await dispatch(fetchUtilityPayment(paymentId)).unwrap();
        if (cancelled) return;
        setStatus(payment.status);
        if (payment.token) setToken(payment.token);
        if (payment.beneficiaryName) setBeneficiaryName(payment.beneficiaryName);

        const terminal = ["COMPLETED", "FAILED", "REFUNDED"].includes(payment.status);
        if (terminal) return;
        if (attempts + 1 >= MAX_POLLS) return;
        setAttempts((a) => a + 1);
        timerRef.current = setTimeout(tick, POLL_MS);
      } catch {
        if (cancelled) return;
        timerRef.current = setTimeout(tick, POLL_MS);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [paymentId]);

  const copyToken = async () => {
    if (!token) return;
    try { Clipboard.setString(String(token)); } catch {}
    Alert.alert(t("utility.result.copied"), t("utility.result.copiedSub"));
  };

  const shareToken = async () => {
    if (!token) return;
    try {
      await Share.share({
        message: t("utility.result.shareLine", {
          disco: biller || t("utility.electricity"),
          meter: meterNumber,
          token,
        }),
      });
    } catch {}
  };

  const isDone = status === "COMPLETED" && !!token;
  const isFailed = status === "FAILED" || status === "REFUNDED";
  const isPolling = !isDone && !isFailed;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => navigation.popToTop()}
            style={{ marginRight: 16 }}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Ionicons name="close" size={24} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: tokens.text.primary }}>
            {t("utility.result.title")}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}>
        {/* Status banner */}
        <View
          accessibilityLiveRegion="polite"
          style={{
            backgroundColor: isDone ? "#ECFDF5" : isFailed ? tokens.status.errorSoft : tokens.brand.soft,
            borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 20,
            borderWidth: 2, borderColor: isDone ? "#10B981" : isFailed ? tokens.status.error : tokens.brand.softBorder,
          }}
        >
          {isPolling ? <ActivityIndicator size="large" color={tokens.brand.default} accessibilityLabel={t("common.loading")} /> : (
            <Ionicons name={isDone ? "checkmark-circle" : "alert-circle"} size={56}
              color={isDone ? "#10B981" : tokens.status.error} />
          )}
          <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, marginTop: 12 }}>
            {isDone ? t("utility.result.successTitle") : isFailed ? t("utility.result.failedTitle") : t("utility.result.processingTitle")}
          </Text>
          <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 4, textAlign: "center" }}>
            {isDone ? t("utility.result.successBody") : isFailed ? t("utility.result.failedBody") : t("utility.result.processingBody")}
          </Text>
        </View>

        {/* Payment summary */}
        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <Row label={t("utility.result.amountLabel")} value={naira(amount)} />
          <Row label={t("utility.result.discoLabel")} value={biller || "—"} />
          <Row label={t("utility.result.meterLabel")} value={meterNumber || "—"} />
          {beneficiaryName ? <Row label={t("utility.result.accountLabel")} value={beneficiaryName} /> : null}
          <Row label={t("utility.result.statusLabel")} value={status} last />
        </View>

        {/* Token block — only when delivered */}
        {token ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#94A3B8", letterSpacing: 1.5, marginBottom: 8 }}>
              {t("utility.result.tokenLabel")}
            </Text>
            <Text
              selectable
              accessibilityLabel={`${t("utility.result.tokenLabel")} ${token}`}
              style={{ fontSize: 24, fontWeight: "800", color: "#fff", letterSpacing: 2, marginBottom: 16 }}
            >
              {token}
            </Text>
            <View style={{ flexDirection: "row" }}>
              <TouchableOpacity
                onPress={copyToken}
                accessibilityRole="button"
                accessibilityLabel={t("utility.result.copy")}
                style={{ flex: 1, backgroundColor: "#1E293B", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginRight: 8, flexDirection: "row", justifyContent: "center" }}
              >
                <Ionicons name="copy-outline" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>{t("utility.result.copy")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={shareToken}
                accessibilityRole="button"
                accessibilityLabel={t("utility.result.share")}
                style={{ flex: 1, backgroundColor: "#1E293B", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
              >
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>{t("utility.result.share")}</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 12, textAlign: "center" }}>
              {t("utility.result.tokenSmsHint")}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity
            onPress={() => navigation.replace("UtilityHistory")}
            accessibilityRole="button"
            accessibilityLabel={t("utility.result.viewHistory")}
            style={{ flex: 1, backgroundColor: tokens.bg.surface, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginRight: 8, borderWidth: 1, borderColor: tokens.border.default }}
          >
            <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>{t("utility.result.viewHistory")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.popToTop()}
            accessibilityRole="button"
            accessibilityLabel={t("utility.result.done")}
            style={{ flex: 1, backgroundColor: tokens.brand.default, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>{t("utility.result.done")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, last = false }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: tokens.border.default }}>
      <Text style={{ fontSize: 13, color: tokens.text.muted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.primary }}>{value}</Text>
    </View>
  );
}
