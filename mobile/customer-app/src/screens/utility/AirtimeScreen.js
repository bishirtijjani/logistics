import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme";
import PinBottomSheet from "../../components/PinBottomSheet";
import { usePinGuard } from "../../lib/usePinGuard";
import { buyAirtime, fetchPlans, fetchRecentRecipients } from "../../store/slices/utilitySlice";
import { usePlatformSetting } from "../../services/settings";
import { detectNetworkFromPhone } from "../../services/networkDetect";

const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;

const NETWORK_COLORS = { MTN: "#FFCC00", GLO: "#00AA00", "9MOBILE": "#0066CC", AIRTEL: "#FF0000", SMILE: "#1E90FF" };

export default function AirtimeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { balance } = useSelector((state) => state.wallet);
  const { plans, isLoading, recentRecipients } = useSelector((state) => state.utility);

  const requirePin = usePinGuard();
  const minAmount = Number(usePlatformSetting("utility.minAirtimeAmount", 50));
  const quickAmountsSetting = usePlatformSetting("utility.airtimeQuickAmounts", null);
  const QUICK_AMOUNTS = Array.isArray(quickAmountsSetting) && quickAmountsSetting.length > 0
    ? quickAmountsSetting.map(Number)
    : [100, 200, 500, 1000, 2000, 5000];

  const networks = plans["AIRTIME"] || [];
  const recents = recentRecipients["AIRTIME"] || [];

  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [networkAutoSelected, setNetworkAutoSelected] = useState(false);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [showPinSheet, setShowPinSheet] = useState(false);
  const [error, setError] = useState("");

  const detectTimer = useRef(null);

  useEffect(() => {
    dispatch(fetchPlans({ type: "AIRTIME" }));
    dispatch(fetchRecentRecipients({ type: "AIRTIME", limit: 5 }));
  }, [dispatch]);

  useEffect(() => {
    if (networks.length && !selectedNetwork) setSelectedNetwork(networks[0]);
  }, [networks]);

  // Auto-detect network from phone prefix (debounced 500ms). Per Phase 7 spec
  // the table-based client-side approach is acceptable and avoids a round
  // trip per keystroke. User can still manually override.
  useEffect(() => {
    if (detectTimer.current) clearTimeout(detectTimer.current);
    if (!phone || phone.length < 4 || networkAutoSelected) return;
    detectTimer.current = setTimeout(() => {
      const detected = detectNetworkFromPhone(phone);
      if (!detected) return;
      const match = networks.find((n) => n.networkName === detected.name);
      if (match && match.id !== selectedNetwork?.id) {
        setSelectedNetwork(match);
        setNetworkAutoSelected(true);
      }
    }, 500);
    return () => detectTimer.current && clearTimeout(detectTimer.current);
  }, [phone, networks]);

  const handlePhoneChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    setPhone(cleaned);
    setError("");
    if (cleaned.length < 4) setNetworkAutoSelected(false);
  };

  const handlePickRecent = (item) => {
    setPhone(item.recipient);
    setNetworkAutoSelected(false); // re-trigger detection
  };

  const handlePurchase = () => {
    if (!selectedNetwork) { setError(t("utility.airtimeScreen.errSelectNetwork")); return; }
    if (!phone.trim() || phone.length < 10) { setError(t("utility.airtimeScreen.errInvalidPhone")); return; }
    if (!amount || Number(amount) < minAmount) { setError(t("utility.airtimeScreen.errMinAmount", { amount: naira(minAmount) })); return; }
    if (Number(amount) > Number(balance)) { setError(t("utility.airtimeScreen.errInsufficientBalance")); return; }
    setError("");
    if (!requirePin()) return;
    setShowPinSheet(true);
  };

  const handlePinConfirm = async (pin) => {
    await dispatch(buyAirtime({
      networkId: selectedNetwork.providerNetworkId,
      phone: phone.trim(),
      amount: Number(amount),
      pin,
    })).unwrap();
    setShowPinSheet(false);
    navigation.navigate("UtilityHistory");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginRight: 16 }}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
            {t("utility.airtimeScreen.title")}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
        {error ? (
          <View style={{ backgroundColor: colors.error + "15", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="alert-circle" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.error, fontWeight: "500" }}>{error}</Text>
          </View>
        ) : null}

        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 12 }}>
          {t("utility.airtimeScreen.selectNetwork")}{" "}
          {networkAutoSelected ? <Text style={{ color: colors.primary }}>{t("utility.airtimeScreen.autoDetected")}</Text> : null}
        </Text>
        {isLoading && !networks.length ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
            {networks.map((n) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => { setSelectedNetwork(n); setNetworkAutoSelected(false); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedNetwork?.id === n.id }}
                accessibilityLabel={n.networkName}
                style={{
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: selectedNetwork?.id === n.id ? colors.primary : colors.surface,
                  borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                  marginRight: 8, marginBottom: 8, borderWidth: 2,
                  borderColor: selectedNetwork?.id === n.id ? colors.primary : colors.border,
                }}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: NETWORK_COLORS[n.networkName] || "#999", marginRight: 8 }} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: selectedNetwork?.id === n.id ? colors.white : colors.text }}>
                  {n.networkName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {recents.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>{t("utility.airtimeScreen.recent")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recents.map((r) => (
                <TouchableOpacity
                  key={r.recipient}
                  onPress={() => handlePickRecent(r)}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10,
                    marginRight: 8, borderWidth: 1, borderColor: colors.border,
                    flexDirection: "row", alignItems: "center",
                  }}
                >
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>{r.recipient}</Text>
                  {r.biller ? (
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textMuted, marginLeft: 6 }}>• {r.biller}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>{t("utility.airtimeScreen.phoneLabel")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 16, marginBottom: 20 }}>
          <Ionicons name="call-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="080XXXXXXXX"
            accessibilityLabel={t("utility.airtimeScreen.phoneLabel")}
            placeholderTextColor={colors.textLight}
            keyboardType="phone-pad"
            maxLength={11}
            style={{ flex: 1, fontSize: 16, fontWeight: "600", color: colors.text, paddingVertical: 16, marginLeft: 12 }}
          />
        </View>

        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>{t("utility.airtimeScreen.amountLabel")}</Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 16, marginBottom: 12 }}>
          <TextInput
            value={amount}
            onChangeText={(text) => { setAmount(text.replace(/[^0-9]/g, "")); setError(""); }}
            placeholder={t("utility.airtimeScreen.amountPh")}
            accessibilityLabel={t("utility.airtimeScreen.amountLabel")}
            placeholderTextColor={colors.textLight}
            keyboardType="number-pad"
            style={{ fontSize: 24, fontWeight: "700", color: colors.text, paddingVertical: 16 }}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24 }}>
          {QUICK_AMOUNTS.map((value) => {
            const selected = Number(amount) === value;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setAmount(value.toString())}
                accessibilityRole="button"
                accessibilityLabel={naira(value)}
                accessibilityState={{ selected }}
                style={{ backgroundColor: selected ? colors.primary : colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, marginBottom: 8, borderWidth: 2, borderColor: selected ? colors.primary : colors.border }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: selected ? colors.white : colors.text }}>₦{value}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {amount ? (
          <View style={{ backgroundColor: colors.primary + "10", borderRadius: 16, padding: 20, borderWidth: 2, borderColor: colors.primary + "30" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>{t("utility.airtimeScreen.summaryNetwork")}</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{selectedNetwork?.networkName || "—"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>{t("utility.airtimeScreen.summaryPhone")}</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{phone || "—"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{t("utility.airtimeScreen.summaryTotal")}</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.primary }}>{naira(amount)}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={amount ? t("utility.airtimeScreen.payCta", { amount: naira(amount) }) : t("utility.airtimeScreen.enterAmountCta")}
          accessibilityState={{ disabled: isLoading, busy: isLoading }}
          style={{ backgroundColor: amount ? colors.primary : colors.textLight, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.white} accessibilityLabel={t("common.loading")} />
          ) : (
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>
              {amount ? t("utility.airtimeScreen.payCta", { amount: naira(amount) }) : t("utility.airtimeScreen.enterAmountCta")}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <PinBottomSheet
        isVisible={showPinSheet}
        onClose={() => setShowPinSheet(false)}
        onConfirm={handlePinConfirm}
        onForgotPin={() => { setShowPinSheet(false); navigation.navigate("ChangePin"); }}
        onSetupPin={() => navigation.navigate("SetPin")}
        title={t("utility.airtimeScreen.pinTitle")}
        subtitle={t("utility.airtimeScreen.pinSubtitle", { amount: naira(amount), network: selectedNetwork?.networkName || "" })}
      />
    </SafeAreaView>
  );
}
