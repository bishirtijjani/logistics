import React, { useState, useEffect } from "react";
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
import { buyCable, fetchPlans, validateIuc, clearValidation } from "../../store/slices/utilitySlice";

// providerNetworkId: GOTV=1, DSTV=2, STARTIME=3
const PROVIDERS = [
  { id: 1, name: "GOTV", color: "#00A650" },
  { id: 2, name: "DSTV", color: "#0066CC" },
  { id: 3, name: "STARTIME", color: "#E8003D" },
];

const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function CableScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useT();
  const { tokens } = useTheme();
  const { balance } = useSelector((state) => state.wallet);
  const { plans, isLoading, isValidating, validationResult } = useSelector((state) => state.utility);
  const requirePin = usePinGuard();

  const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0]);
  const [smartCard, setSmartCard] = useState("");
  const [smartCardValidated, setSmartCardValidated] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPinSheet, setShowPinSheet] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const showErr = (field, msg) => {
    setFieldErrors({ [field]: msg });
    Toast.show({ type: "error", text1: msg });
  };
  const clearField = (field) =>
    setFieldErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  const plansKey = `CABLE-${selectedProvider.id}`;
  const cablePlans = plans[plansKey] || [];

  useEffect(() => {
    dispatch(fetchPlans({ type: "CABLE", networkId: selectedProvider.id }));
    setSelectedPlan(null);
    setSmartCardValidated(false);
    dispatch(clearValidation());
  }, [selectedProvider.id]);

  const handleValidateIuc = async () => {
    if (!smartCard.trim()) { showErr("smartCard", t("utility.cableScreen.errSmartCard")); return; }
    clearField("smartCard");
    try {
      await dispatch(validateIuc({ smartCardNumber: smartCard.trim(), cableNameId: selectedProvider.id })).unwrap();
      setSmartCardValidated(true);
    } catch {
      showErr("smartCard", t("utility.cableScreen.verifyFailed"));
      setSmartCardValidated(false);
    }
  };

  const handlePurchase = () => {
    if (!smartCardValidated) { showErr("smartCard", t("utility.cableScreen.errVerifyFirst")); return; }
    if (!selectedPlan) { showErr("plan", t("utility.cableScreen.errSelectPackage")); return; }
    if (Number(selectedPlan.sellingPrice) > Number(balance)) { showErr("plan", t("errors.INSUFFICIENT_BALANCE")); return; }
    setFieldErrors({});
    if (!requirePin()) return;
    setShowPinSheet(true);
  };

  const handlePinConfirm = async (pin) => {
    await dispatch(buyCable({ planId: selectedPlan.id, smartCardNumber: smartCard.trim(), pin })).unwrap();
    setShowPinSheet(false);
    navigation.navigate("UtilityHistory");
  };

  const customerName = validationResult?.Customer_Name || validationResult?.name || t("utility.verified");

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
            {t("utility.cableScreen.title")}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}>
        {/* Provider Selection */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 12 }}>{t("utility.cableScreen.selectProvider")}</Text>
        <View style={{ flexDirection: "row", marginBottom: 20 }}>
          {PROVIDERS.map((p) => {
            const selected = selectedProvider.id === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => { setSelectedProvider(p); setSmartCardValidated(false); dispatch(clearValidation()); }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={p.name}
                style={{
                  flex: 1, marginRight: p.id !== PROVIDERS[PROVIDERS.length - 1].id ? 8 : 0,
                  backgroundColor: selected ? tokens.brand.default : tokens.bg.surface,
                  borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 2,
                  borderColor: selected ? tokens.brand.default : tokens.border.default,
                }}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginBottom: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: selected ? tokens.text.onBrand : tokens.text.primary }}>{p.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Smart Card */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>{t("utility.cableScreen.smartCardLabel")}</Text>
        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 2, borderColor: fieldErrors.smartCard ? tokens.status.error : (smartCardValidated ? tokens.status.success : tokens.border.default), paddingHorizontal: 16, marginRight: 8 }}>
            <Ionicons name="tv-outline" size={20} color={tokens.text.muted} />
            <TextInput
              value={smartCard}
              onChangeText={(text) => { setSmartCard(text); setSmartCardValidated(false); dispatch(clearValidation()); clearField("smartCard"); }}
              placeholder={t("utility.cableScreen.smartCardPh")}
              accessibilityLabel={t("utility.cableScreen.smartCardLabel")}
              placeholderTextColor={tokens.text.placeholder}
              keyboardType="number-pad"
              style={{ flex: 1, fontSize: 15, fontWeight: "600", color: tokens.text.primary, paddingVertical: 16, marginLeft: 12 }}
            />
            {smartCardValidated && <Ionicons name="checkmark-circle" size={20} color={tokens.status.success} />}
          </View>
          <TouchableOpacity
            onPress={handleValidateIuc}
            disabled={isValidating}
            accessibilityRole="button"
            accessibilityLabel={t("utility.cableScreen.verify")}
            accessibilityState={{ disabled: isValidating, busy: isValidating }}
            style={{ backgroundColor: tokens.brand.default, borderRadius: 16, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }}
          >
            {isValidating ? <ActivityIndicator size="small" color={tokens.text.onBrand} /> : <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 13 }}>{t("utility.cableScreen.verify")}</Text>}
          </TouchableOpacity>
        </View>
        {fieldErrors.smartCard ? (
          <Text style={{ fontSize: 12, color: tokens.status.error, marginBottom: 12, paddingLeft: 4 }}>{fieldErrors.smartCard}</Text>
        ) : null}

        {validationResult && (
          <View style={{ backgroundColor: tokens.status.successSoft, borderRadius: 12, padding: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 13, color: tokens.status.successStrong, fontWeight: "600" }}>
              {customerName}
            </Text>
          </View>
        )}

        {/* Plans */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 12 }}>{t("utility.cableScreen.selectPackage")}</Text>
        {isLoading ? (
          <ActivityIndicator color={tokens.brand.default} style={{ marginVertical: 20 }} accessibilityLabel={t("common.loading")} />
        ) : (
          <View style={{ marginBottom: fieldErrors.plan ? 4 : 20 }}>
            {cablePlans.map((plan) => (
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
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary }}>{plan.name}</Text>
                  {plan.validity ? <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 2 }}>{plan.validity}</Text> : null}
                </View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: tokens.brand.default }}>{naira(plan.sellingPrice)}</Text>
              </TouchableOpacity>
            ))}
            {!cablePlans.length && <Text style={{ color: tokens.text.muted, textAlign: "center", marginVertical: 20 }}>{t("utility.cableScreen.noPackages")}</Text>}
          </View>
        )}
        {fieldErrors.plan ? (
          <Text style={{ fontSize: 12, color: tokens.status.error, marginBottom: 16, paddingLeft: 4 }}>{fieldErrors.plan}</Text>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg.canvas, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: tokens.border.default }}>
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={isLoading || !selectedPlan}
          accessibilityRole="button"
          accessibilityLabel={selectedPlan ? naira(selectedPlan.sellingPrice) : t("utility.cableScreen.selectPackage")}
          accessibilityState={{ disabled: isLoading || !selectedPlan, busy: isLoading }}
          style={{ backgroundColor: selectedPlan ? tokens.brand.default : tokens.text.placeholder, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={tokens.text.onBrand} accessibilityLabel={t("common.loading")} />
          ) : (
            <Text style={{ color: tokens.text.onBrand, fontSize: 16, fontWeight: "800" }}>
              {selectedPlan ? naira(selectedPlan.sellingPrice) : t("utility.cableScreen.selectPackage")}
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
        title={t("utility.cableScreen.pinTitle")}
        subtitle={selectedPlan ? t("utility.cableScreen.pinSubtitle", { plan: selectedPlan.name, name: customerName }) : ""}
      />
    </SafeAreaView>
  );
}
