import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useT } from "../../i18n/useT";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import PinBottomSheet from "../../components/PinBottomSheet";
import { usePinGuard } from "../../lib/usePinGuard";
import { buyData, fetchPlans, fetchRecentRecipients } from "../../store/slices/utilitySlice";
import { detectNetworkFromPhone } from "../../services/networkDetect";

const NETWORK_COLORS = { MTN: "#FFCC00", GLO: "#00AA00", "9MOBILE": "#0066CC", AIRTEL: "#FF0000" };
const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function DataScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useT();
  const { tokens } = useTheme();
  const { balance } = useSelector((state) => state.wallet);
  const { plans, isLoading, recentRecipients } = useSelector((state) => state.utility);
  const requirePin = usePinGuard();

  // Airtime networks are used as the network list for data too
  const networks = plans["AIRTIME"] || [];
  const recents = recentRecipients["DATA"] || [];

  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [networkAutoSelected, setNetworkAutoSelected] = useState(false);
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPinSheet, setShowPinSheet] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const detectTimer = useRef(null);

  const showErr = (field, msg) => {
    setFieldErrors({ [field]: msg });
    Toast.show({ type: "error", text1: msg });
  };
  const clearField = (field) =>
    setFieldErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  const dataPlansKey = selectedNetwork ? `DATA-${selectedNetwork.providerNetworkId}` : null;
  const dataPlans = dataPlansKey ? (plans[dataPlansKey] || []) : [];

  useEffect(() => {
    dispatch(fetchPlans({ type: "AIRTIME" }));
    dispatch(fetchRecentRecipients({ type: "DATA", limit: 5 }));
  }, [dispatch]);

  useEffect(() => {
    if (networks.length && !selectedNetwork) setSelectedNetwork(networks[0]);
  }, [networks]);

  useEffect(() => {
    if (selectedNetwork) {
      setSelectedPlan(null);
      dispatch(fetchPlans({ type: "DATA", networkId: selectedNetwork.providerNetworkId }));
    }
  }, [selectedNetwork?.providerNetworkId]);

  // Auto-detect network on phone change (500ms debounce).
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
    setNetworkAutoSelected(false);
  };

  const handlePurchase = () => {
    if (!phone.trim() || phone.length < 10) { showErr("phone", t("utility.dataScreen.errInvalidPhone")); return; }
    if (!selectedPlan) { showErr("plan", t("utility.dataScreen.errSelectPlan")); return; }
    if (Number(selectedPlan.sellingPrice) > Number(balance)) { showErr("plan", t("utility.dataScreen.errInsufficientBalance")); return; }
    setFieldErrors({});
    if (!requirePin()) return;
    setShowPinSheet(true);
  };

  const handlePinConfirm = async (pin) => {
    await dispatch(buyData({ planId: selectedPlan.id, phone: phone.trim(), pin })).unwrap();
    setShowPinSheet(false);
    navigation.navigate("UtilityHistory");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginRight: 16 }}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
          >
            <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: tokens.text.primary }}>
            {t("utility.dataScreen.title")}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 12 }}>
          {t("utility.dataScreen.selectNetwork")}{" "}
          {networkAutoSelected ? <Text style={{ color: tokens.brand.default }}>{t("utility.airtimeScreen.autoDetected")}</Text> : null}
        </Text>
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
                backgroundColor: selectedNetwork?.id === n.id ? tokens.brand.default : tokens.bg.surface,
                borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                marginRight: 8, marginBottom: 8, borderWidth: 2,
                borderColor: selectedNetwork?.id === n.id ? tokens.brand.default : tokens.border.default,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: NETWORK_COLORS[n.networkName] || "#999", marginRight: 8 }} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: selectedNetwork?.id === n.id ? "#FFFFFF" : tokens.text.primary }}>{n.networkName}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {recents.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>{t("utility.dataScreen.recent")}</Text>
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
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>{t("utility.dataScreen.phoneLabel")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 2, borderColor: fieldErrors.phone ? tokens.status.error : tokens.border.default, paddingHorizontal: 16, marginBottom: fieldErrors.phone ? 4 : 20 }}>
          <Ionicons name="call-outline" size={20} color={tokens.text.muted} />
          <TextInput
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="080XXXXXXXX"
            accessibilityLabel={t("utility.dataScreen.phoneLabel")}
            placeholderTextColor={tokens.text.placeholder}
            keyboardType="phone-pad"
            maxLength={11}
            style={{ flex: 1, fontSize: 16, fontWeight: "600", color: tokens.text.primary, paddingVertical: 16, marginLeft: 12 }}
          />
        </View>
        {fieldErrors.phone ? (
          <Text style={{ fontSize: 12, color: tokens.status.error, marginBottom: 16, paddingLeft: 4 }}>{fieldErrors.phone}</Text>
        ) : null}

        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: fieldErrors.plan ? 4 : 12 }}>{t("utility.dataScreen.selectPlan")}</Text>
        {fieldErrors.plan ? (
          <Text style={{ fontSize: 12, color: tokens.status.error, marginBottom: 12, paddingLeft: 4 }}>{fieldErrors.plan}</Text>
        ) : null}
        {isLoading ? (
          <ActivityIndicator color={tokens.brand.default} style={{ marginVertical: 20 }} accessibilityLabel={t("common.loading")} />
        ) : (
          <View style={{ marginBottom: 20 }}>
            {dataPlans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                onPress={() => { setSelectedPlan(plan); clearField("plan"); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedPlan?.id === plan.id }}
                accessibilityLabel={`${plan.name}. ${naira(plan.sellingPrice)}`}
                style={{
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: selectedPlan?.id === plan.id ? tokens.brand.soft : tokens.bg.surface,
                  borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2,
                  borderColor: selectedPlan?.id === plan.id ? tokens.brand.default : tokens.border.default,
                }}
              >
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: selectedPlan?.id === plan.id ? tokens.brand.default : tokens.bg.surfaceMuted, alignItems: "center", justifyContent: "center", marginRight: 16 }}>
                  <Ionicons name="wifi" size={24} color={selectedPlan?.id === plan.id ? "#FFFFFF" : tokens.text.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>{plan.name}</Text>
                  {plan.planType ? <Text style={{ fontSize: 11, color: tokens.brand.default, fontWeight: "600", marginTop: 2 }}>{plan.planType}</Text> : null}
                  <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 2 }}>{t("utility.dataScreen.validity")}: {plan.validity || "N/A"}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: tokens.brand.default }}>{naira(plan.sellingPrice)}</Text>
              </TouchableOpacity>
            ))}
            {!dataPlans.length && selectedNetwork && (
              <Text style={{ color: tokens.text.muted, textAlign: "center", marginVertical: 20 }}>{t("utility.dataScreen.noPlans")}</Text>
            )}
          </View>
        )}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg.canvas, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: tokens.border.default }}>
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={isLoading || !selectedPlan}
          accessibilityRole="button"
          accessibilityLabel={selectedPlan ? naira(selectedPlan.sellingPrice) : t("utility.dataScreen.selectPlan")}
          accessibilityState={{ disabled: isLoading || !selectedPlan, busy: isLoading }}
          style={{ backgroundColor: selectedPlan ? tokens.brand.default : tokens.text.placeholder, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" accessibilityLabel={t("common.loading")} />
          ) : (
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
              {selectedPlan ? naira(selectedPlan.sellingPrice) : t("utility.dataScreen.selectPlan")}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <PinBottomSheet
        isVisible={showPinSheet}
        onClose={() => setShowPinSheet(false)}
        onConfirm={handlePinConfirm}
        onForgotPin={() => { setShowPinSheet(false); navigation.navigate("ChangePin"); }}
        onSetupPin={() => navigation.navigate("ChangePin")}
        title={t("utility.dataScreen.pinTitle")}
        subtitle={selectedPlan ? t("utility.dataScreen.pinSubtitle", { plan: selectedPlan.name, phone }) : ""}
      />
    </SafeAreaView>
  );
}
