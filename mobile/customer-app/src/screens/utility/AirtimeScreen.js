import React, { useState, useEffect, useRef } from "react";
import { goBackOr } from "../../lib/goBack";
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
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import PinBottomSheet from "../../components/PinBottomSheet";
import { usePinGuard } from "../../lib/usePinGuard";
import { buyAirtime, fetchPlans, fetchRecentRecipients } from "../../store/slices/utilitySlice";
import { usePlatformSetting } from "../../services/settings";
import { detectNetworkFromPhone } from "../../services/networkDetect";

const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;

const NETWORK_COLORS = { MTN: "#FFCC00", GLO: "#00AA00", "9MOBILE": "#0066CC", AIRTEL: "#FF0000", SMILE: "#1E90FF" };

export default function AirtimeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const { balance } = useSelector((state) => state.wallet);
  const { plans, isLoading, recentRecipients } = useSelector((state) => state.utility);

  const requirePin = usePinGuard();
  // ₦100 is the provider's hard floor (buys below it hang in PROCESSING), so
  // clamp the configurable setting up to it - never below.
  const minAmount = Math.max(100, Number(usePlatformSetting("utility.minAirtimeAmount", 100)) || 100);
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
  const [fieldErrors, setFieldErrors] = useState({});

  const detectTimer = useRef(null);

  const showErr = (field, msg) => {
    setFieldErrors({ [field]: msg });
    Toast.show({ type: "error", text1: msg });
  };
  const clearField = (field) =>
    setFieldErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

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
    clearField("phone");
    if (cleaned.length < 4) setNetworkAutoSelected(false);
  };

  const handlePickRecent = (item) => {
    setPhone(item.recipient);
    setNetworkAutoSelected(false); // re-trigger detection
  };

  const handlePurchase = () => {
    if (!selectedNetwork) { showErr("network", t("utility.airtimeScreen.errSelectNetwork")); return; }
    if (!phone.trim() || phone.length < 10) { showErr("phone", t("utility.airtimeScreen.errInvalidPhone")); return; }
    if (!amount || Number(amount) < minAmount) { showErr("amount", t("utility.airtimeScreen.errMinAmount", { amount: naira(minAmount) })); return; }
    if (Number(amount) > Number(balance)) { showErr("amount", t("utility.airtimeScreen.errInsufficientBalance")); return; }
    setFieldErrors({});
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
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => goBackOr(navigation)}
            style={{ marginRight: 16 }}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
          >
            <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: tokens.text.primary }}>
            {t("utility.airtimeScreen.title")}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 12 }}>
          {t("utility.airtimeScreen.selectNetwork")}{" "}
          {networkAutoSelected ? <Text style={{ color: tokens.brand.default }}>{t("utility.airtimeScreen.autoDetected")}</Text> : null}
        </Text>
        {isLoading && !networks.length ? (
          <ActivityIndicator color={tokens.brand.default} style={{ marginBottom: 20 }} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: fieldErrors.network ? 4 : 20 }}>
            {networks.map((n) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => { setSelectedNetwork(n); setNetworkAutoSelected(false); clearField("network"); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedNetwork?.id === n.id }}
                accessibilityLabel={n.networkName}
                style={{
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: selectedNetwork?.id === n.id ? tokens.brand.default : tokens.bg.surface,
                  borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                  marginRight: 8, marginBottom: 8, borderWidth: 2,
                  borderColor: selectedNetwork?.id === n.id ? tokens.brand.default : tokens.border.default,
                }}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: NETWORK_COLORS[n.networkName] || "#999", marginRight: 8 }} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: selectedNetwork?.id === n.id ? tokens.text.onBrand : tokens.text.primary }}>
                  {n.networkName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {fieldErrors.network ? (
          <Text style={{ fontSize: 12, color: tokens.status.error, marginBottom: 16, paddingLeft: 4 }}>{fieldErrors.network}</Text>
        ) : null}

        {recents.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>{t("utility.airtimeScreen.recent")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recents.map((r) => (
                <TouchableOpacity
                  key={r.recipient}
                  onPress={() => handlePickRecent(r)}
                  style={{
                    backgroundColor: tokens.bg.surface,
                    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10,
                    marginRight: 8, borderWidth: 1, borderColor: tokens.border.default,
                    flexDirection: "row", alignItems: "center",
                  }}
                >
                  <Ionicons name="time-outline" size={14} color={tokens.text.muted} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: tokens.text.primary }}>{r.recipient}</Text>
                  {r.biller ? (
                    <Text style={{ fontSize: 11, fontWeight: "600", color: tokens.text.muted, marginLeft: 6 }}>• {r.biller}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>{t("utility.airtimeScreen.phoneLabel")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 2, borderColor: fieldErrors.phone ? tokens.status.error : tokens.border.default, paddingHorizontal: 16, marginBottom: fieldErrors.phone ? 4 : 20 }}>
          <Ionicons name="call-outline" size={20} color={tokens.text.muted} />
          <TextInput
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="080XXXXXXXX"
            accessibilityLabel={t("utility.airtimeScreen.phoneLabel")}
            placeholderTextColor={tokens.text.placeholder}
            keyboardType="phone-pad"
            maxLength={11}
            style={{ flex: 1, fontSize: 16, fontWeight: "600", color: tokens.text.primary, paddingVertical: 16, marginLeft: 12 }}
          />
        </View>
        {fieldErrors.phone ? (
          <Text style={{ fontSize: 12, color: tokens.status.error, marginBottom: 16, paddingLeft: 4 }}>{fieldErrors.phone}</Text>
        ) : null}

        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>{t("utility.airtimeScreen.amountLabel")}</Text>
        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 2, borderColor: fieldErrors.amount ? tokens.status.error : tokens.border.default, paddingHorizontal: 16, marginBottom: fieldErrors.amount ? 4 : 12 }}>
          <TextInput
            value={amount}
            onChangeText={(text) => { setAmount(text.replace(/[^0-9]/g, "")); clearField("amount"); }}
            placeholder={t("utility.airtimeScreen.amountPh")}
            accessibilityLabel={t("utility.airtimeScreen.amountLabel")}
            placeholderTextColor={tokens.text.placeholder}
            keyboardType="number-pad"
            style={{ fontSize: 24, fontWeight: "700", color: tokens.text.primary, paddingVertical: 16 }}
          />
        </View>
        {fieldErrors.amount ? (
          <Text style={{ fontSize: 12, color: tokens.status.error, marginBottom: 8, paddingLeft: 4 }}>{fieldErrors.amount}</Text>
        ) : (
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginBottom: 8, paddingLeft: 4 }}>
            {t("utility.airtimeScreen.minHint", { amount: naira(minAmount) })}
          </Text>
        )}
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
                style={{ backgroundColor: selected ? tokens.brand.default : tokens.bg.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, marginBottom: 8, borderWidth: 2, borderColor: selected ? tokens.brand.default : tokens.border.default }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: selected ? tokens.text.onBrand : tokens.text.primary }}>₦{value}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {amount ? (
          <View style={{ backgroundColor: tokens.brand.default + "10", borderRadius: 16, padding: 20, borderWidth: 2, borderColor: tokens.brand.default + "30" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: tokens.text.muted }}>{t("utility.airtimeScreen.summaryNetwork")}</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>{selectedNetwork?.networkName || "-"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: tokens.text.muted }}>{t("utility.airtimeScreen.summaryPhone")}</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>{phone || "-"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: tokens.text.primary }}>{t("utility.airtimeScreen.summaryTotal")}</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: tokens.brand.default }}>{naira(amount)}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg.canvas, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: tokens.border.default }}>
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={amount ? t("utility.airtimeScreen.payCta", { amount: naira(amount) }) : t("utility.airtimeScreen.enterAmountCta")}
          accessibilityState={{ disabled: isLoading, busy: isLoading }}
          style={{ backgroundColor: amount ? tokens.brand.default : tokens.text.placeholder, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={tokens.text.onBrand} accessibilityLabel={t("common.loading")} />
          ) : (
            <Text style={{ color: tokens.text.onBrand, fontSize: 16, fontWeight: "800" }}>
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
