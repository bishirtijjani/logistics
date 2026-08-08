import React, { useState, useEffect } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import PinBottomSheet from "../../components/PinBottomSheet";
import { usePinGuard } from "../../lib/usePinGuard";
import { payElectricity, fetchPlans, validateMeter, clearValidation } from "../../store/slices/utilitySlice";
import { usePlatformSetting } from "../../services/settings";

const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function ElectricityScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { balance } = useSelector((state) => state.wallet);
  const { plans, isLoading, isValidating, validationResult } = useSelector((state) => state.utility);
  const requirePin = usePinGuard();

  const minAmount = Number(usePlatformSetting("utility.minElectricityAmount", 500));
  const serviceFee = Number(usePlatformSetting("utility.electricityServiceFee", 10));
  const quickAmountsSetting = usePlatformSetting("utility.electricityQuickAmounts", null);
  const QUICK_AMOUNTS = Array.isArray(quickAmountsSetting) && quickAmountsSetting.length > 0
    ? quickAmountsSetting.map(Number)
    : [1000, 2000, 5000, 10000, 20000];

  const discos = plans["ELECTRICITY"] || [];

  const [selectedDisco, setSelectedDisco] = useState(null);
  const [meterNumber, setMeterNumber] = useState("");
  const [meterType, setMeterType] = useState("PREPAID");
  const [meterValidated, setMeterValidated] = useState(false);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [showPinSheet, setShowPinSheet] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const showErr = (field, msg) => {
    setFieldErrors({ [field]: msg });
    Toast.show({ type: "error", text1: msg });
  };
  const clearField = (field) =>
    setFieldErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  useEffect(() => { dispatch(fetchPlans({ type: "ELECTRICITY" })); }, [dispatch]);

  useEffect(() => {
    if (discos.length && !selectedDisco) setSelectedDisco(discos[0]);
  }, [discos]); // eslint-disable-line

  const handleValidateMeter = async () => {
    if (!meterNumber.trim() || meterNumber.length < 11) { showErr("meter", t("utility.electricityScreen.errMeter")); return; }
    if (!selectedDisco) { showErr("disco", t("utility.electricityScreen.errSelectDisco")); return; }
    clearField("meter");
    try {
      await dispatch(validateMeter({ meterNumber: meterNumber.trim(), discoId: selectedDisco.providerNetworkId, meterType })).unwrap();
      setMeterValidated(true);
    } catch {
      showErr("meter", t("utility.electricityScreen.verifyFailed"));
      setMeterValidated(false);
    }
  };

  const handleMeterBlur = () => {
    if (meterValidated || isValidating) return;
    if (!meterNumber.trim() || meterNumber.length < 11) return;
    if (!selectedDisco) return;
    handleValidateMeter();
  };

  const handlePurchase = () => {
    if (!selectedDisco) { showErr("disco", t("utility.electricityScreen.errSelectDisco")); return; }
    if (!meterValidated) { showErr("meter", t("utility.electricityScreen.errVerifyFirst")); return; }
    if (!phone.trim() || phone.length < 10) { showErr("phone", t("utility.airtimeScreen.errInvalidPhone")); return; }
    if (!amount || Number(amount) < minAmount) { showErr("amount", t("utility.electricityScreen.errMinAmount", { amount: naira(minAmount) })); return; }
    if (Number(amount) + serviceFee > Number(balance)) { showErr("amount", t("utility.electricityScreen.errInsufficientBalance")); return; }
    setFieldErrors({});
    if (!requirePin()) return;
    setShowPinSheet(true);
  };

  const handlePinConfirm = async (pin) => {
    const payment = await dispatch(payElectricity({
      discoId: selectedDisco.providerNetworkId,
      meterNumber: meterNumber.trim(),
      meterType,
      amount: Number(amount),
      phone: phone.trim(),
      pin,
    })).unwrap();
    setShowPinSheet(false);
    navigation.replace("ElectricityResult", {
      paymentId: payment?.id,
      amount: Number(amount),
      fee: serviceFee,
      meterNumber: meterNumber.trim(),
      biller: selectedDisco?.networkName,
      beneficiaryName: payment?.beneficiaryName || null,
    });
  };

  const customerName = validationResult?.Customer_Name || validationResult?.name || t("utility.verified");

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
            {t("utility.electricityScreen.title")}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}>
        {/* Disco Selection */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 12 }}>{t("utility.electricityScreen.selectDisco")}</Text>
        {isLoading && !discos.length ? (
          <ActivityIndicator color={tokens.brand.default} style={{ marginBottom: 20 }} accessibilityLabel={t("common.loading")} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: fieldErrors.disco ? 4 : 20 }}>
            {discos.map((d) => {
              const selected = selectedDisco?.id === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => { setSelectedDisco(d); setMeterValidated(false); dispatch(clearValidation()); clearField("disco"); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={d.networkName}
                  style={{
                    backgroundColor: selected ? tokens.brand.default : tokens.bg.surface,
                    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                    marginRight: 8, marginBottom: 8, borderWidth: 2,
                    borderColor: selected ? tokens.brand.default : tokens.border.default,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: selected ? tokens.text.onBrand : tokens.text.primary }}>{d.networkName}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {fieldErrors.disco ? (
          <Text style={{ fontSize: 12, color: tokens.status.error, marginBottom: 16, paddingLeft: 4 }}>{fieldErrors.disco}</Text>
        ) : null}

        {/* Meter Type */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 12 }}>{t("utility.electricityScreen.meterType")}</Text>
        <View style={{ flexDirection: "row", marginBottom: 20 }} accessibilityRole="radiogroup">
          {["PREPAID", "POSTPAID"].map((type) => {
            const selected = meterType === type;
            const label = type === "PREPAID" ? t("utility.electricityScreen.prepaid") : t("utility.electricityScreen.postpaid");
            return (
              <TouchableOpacity
                key={type}
                onPress={() => { setMeterType(type); setMeterValidated(false); dispatch(clearValidation()); }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                style={{
                  flex: 1, marginRight: type === "PREPAID" ? 8 : 0,
                  backgroundColor: selected ? tokens.brand.default : tokens.bg.surface,
                  borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 2,
                  borderColor: selected ? tokens.brand.default : tokens.border.default,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: selected ? tokens.text.onBrand : tokens.text.primary }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Meter Number */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>{t("utility.electricityScreen.meterLabel")}</Text>
        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 2, borderColor: fieldErrors.meter ? tokens.status.error : (meterValidated ? tokens.status.success : tokens.border.default), paddingHorizontal: 16, marginRight: 8 }}>
            <Ionicons name="flash-outline" size={20} color={tokens.text.muted} />
            <TextInput
              value={meterNumber}
              onChangeText={(text) => { setMeterNumber(text.replace(/[^0-9]/g, "")); setMeterValidated(false); dispatch(clearValidation()); clearField("meter"); }}
              onBlur={handleMeterBlur}
              placeholder={t("utility.electricityScreen.meterPh")}
              accessibilityLabel={t("utility.electricityScreen.meterLabel")}
              placeholderTextColor={tokens.text.placeholder}
              keyboardType="number-pad"
              style={{ flex: 1, fontSize: 15, fontWeight: "600", color: tokens.text.primary, paddingVertical: 16, marginLeft: 12 }}
            />
            {meterValidated && <Ionicons name="checkmark-circle" size={20} color={tokens.status.success} />}
          </View>
          <TouchableOpacity
            onPress={handleValidateMeter}
            disabled={isValidating}
            accessibilityRole="button"
            accessibilityLabel={t("utility.electricityScreen.verify")}
            accessibilityState={{ disabled: isValidating, busy: isValidating }}
            style={{ backgroundColor: tokens.brand.default, borderRadius: 16, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }}
          >
            {isValidating ? <ActivityIndicator size="small" color={tokens.text.onBrand} /> : <Text style={{ color: tokens.text.onBrand, fontWeight: "700", fontSize: 13 }}>{t("utility.electricityScreen.verify")}</Text>}
          </TouchableOpacity>
        </View>
        {fieldErrors.meter ? (
          <Text style={{ fontSize: 12, color: tokens.status.error, marginBottom: 8, paddingLeft: 4 }}>{fieldErrors.meter}</Text>
        ) : null}

        {validationResult && (
          <View style={{ backgroundColor: tokens.status.successSoft, borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: tokens.status.successStrong, fontWeight: "600" }}>{customerName}</Text>
            {validationResult.Address ? <Text style={{ fontSize: 12, color: tokens.status.successStrong, marginTop: 2 }}>{validationResult.Address}</Text> : null}
          </View>
        )}

        {/* Phone */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>{t("utility.airtimeScreen.phoneLabel")}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 2, borderColor: fieldErrors.phone ? tokens.status.error : tokens.border.default, paddingHorizontal: 16, marginBottom: fieldErrors.phone ? 4 : 20 }}>
          <Ionicons name="call-outline" size={20} color={tokens.text.muted} />
          <TextInput
            value={phone}
            onChangeText={(text) => { setPhone(text.replace(/[^0-9]/g, "")); clearField("phone"); }}
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

        {/* Amount */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.text.muted, marginBottom: 8 }}>{t("utility.electricityScreen.amountLabel")}</Text>
        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 16, borderWidth: 2, borderColor: fieldErrors.amount ? tokens.status.error : tokens.border.default, paddingHorizontal: 16, marginBottom: fieldErrors.amount ? 4 : 12 }}>
          <TextInput
            value={amount}
            onChangeText={(text) => { setAmount(text.replace(/[^0-9]/g, "")); clearField("amount"); }}
            placeholder={t("utility.electricityScreen.amountPh")}
            accessibilityLabel={t("utility.electricityScreen.amountLabel")}
            placeholderTextColor={tokens.text.placeholder}
            keyboardType="number-pad"
            style={{ fontSize: 24, fontWeight: "700", color: tokens.text.primary, paddingVertical: 16 }}
          />
        </View>
        {fieldErrors.amount ? (
          <Text style={{ fontSize: 12, color: tokens.status.error, marginBottom: 8, paddingLeft: 4 }}>{fieldErrors.amount}</Text>
        ) : null}
        <Text style={{ fontSize: 11, color: tokens.text.muted, marginBottom: 8, paddingLeft: 4 }}>
          {t("utility.electricityScreen.minHint", { amount: naira(minAmount) })}
        </Text>
        {amount ? (
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginBottom: 12, paddingLeft: 4 }}>
            {t("utility.electricityScreen.feeHint", { fee: naira(serviceFee), total: naira(Number(amount) + serviceFee) })}
          </Text>
        ) : null}
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
                style={{ backgroundColor: selected ? tokens.brand.default : tokens.bg.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8, marginBottom: 8, borderWidth: 2, borderColor: selected ? tokens.brand.default : tokens.border.default }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: selected ? tokens.text.onBrand : tokens.text.primary }}>{naira(value)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg.canvas, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: tokens.border.default }}>
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={amount ? t("utility.electricityScreen.payCta", { amount: naira(Number(amount) + serviceFee) }) : t("utility.electricityScreen.enterAmountCta")}
          accessibilityState={{ disabled: isLoading, busy: isLoading }}
          style={{ backgroundColor: amount ? tokens.brand.default : tokens.text.placeholder, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={tokens.text.onBrand} accessibilityLabel={t("common.loading")} />
          ) : (
            <Text style={{ color: tokens.text.onBrand, fontSize: 16, fontWeight: "800" }}>
              {amount ? t("utility.electricityScreen.payCta", { amount: naira(Number(amount) + serviceFee) }) : t("utility.electricityScreen.enterAmountCta")}
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
        title={t("utility.electricityScreen.pinTitle")}
        subtitle={t("utility.electricityScreen.pinSubtitle", { amount: naira(Number(amount) + serviceFee), disco: selectedDisco?.networkName || "" })}
      />
    </SafeAreaView>
  );
}
