import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { sendMoney, fetchBeneficiaries, saveBeneficiary } from "../../store/slices/walletSlice";
import { colors } from "../../theme";
import Toast from "react-native-toast-message";
import api from "../../services/api";
import { usePlatformSetting } from "../../services/settings";

const PIN_LENGTH = 6;

const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function SendMoneyScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { balance, isSending, beneficiaries } = useSelector((s) => s.wallet);

  const minTransfer = Number(usePlatformSetting("wallet.minTransfer", 50));
  const quickChipsSetting = usePlatformSetting("wallet.transferQuickAmounts", null);
  const quickChips = Array.isArray(quickChipsSetting) && quickChipsSetting.length > 0
    ? quickChipsSetting.map(Number)
    : [500, 1000, 2000, 5000];

  const prefill = route?.params ?? {};

  const [step, setStep] = useState("form"); // form | pin | success
  const [phone, setPhone] = useState(prefill.recipientPhone ?? "");
  const [amount, setAmount] = useState(prefill.amount ? String(prefill.amount) : "");
  const [description, setDescription] = useState(prefill.description ?? "");
  const [recipientName, setRecipientName] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [result, setResult] = useState(null);

  useEffect(() => {
    dispatch(fetchBeneficiaries());
  }, [dispatch]);

  // Lookup recipient name as user types phone
  useEffect(() => {
    setRecipientName(null);
    if (phone.replace(/\D/g, "").length < 10) return;
    const timer = setTimeout(async () => {
      try {
        setLookingUp(true);
        await api.get(`/auth/profile?phone=${phone}`);
        setRecipientName(null);
      } catch (_) {
        setRecipientName(null);
      } finally {
        setLookingUp(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [phone]);

  const phoneBeneficiaries = beneficiaries.filter((b) => b.phone);

  const handleContinue = () => {
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      Toast.show({ type: "error", text1: t("wallet.send_.invalidPhone") });
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt < minTransfer) {
      Toast.show({ type: "error", text1: t("wallet.send_.minTransfer", { amount: naira(minTransfer) }) });
      return;
    }
    if (amt > balance) {
      Toast.show({ type: "error", text1: t("errors.INSUFFICIENT_BALANCE") });
      return;
    }
    setStep("pin");
    setPin("");
    setPinError("");
  };

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handlePinInput = async (digit) => {
    const newPin = (pin + digit).slice(0, PIN_LENGTH);
    setPin(newPin);
    setPinError("");

    if (newPin.length === PIN_LENGTH) {
      const res = await dispatch(
        sendMoney({
          recipientPhone: phone,
          amount: parseFloat(amount),
          description,
          pin: newPin,
        }),
      );

      if (sendMoney.fulfilled.match(res)) {
        setResult(res.payload);
        setStep("success");
        if (res.payload.recipientName && !phoneBeneficiaries.some((b) => b.phone === phone)) {
          Alert.alert(
            t("wallet.send_.saveBeneficiaryTitle"),
            t("wallet.send_.saveBeneficiaryBody", { name: res.payload.recipientName }),
            [
              { text: t("wallet.send_.skip"), style: "cancel" },
              {
                text: t("wallet.send_.save"),
                onPress: () =>
                  dispatch(saveBeneficiary({ name: res.payload.recipientName, phone })),
              },
            ],
          );
        }
      } else {
        shake();
        const msg = res.payload || t("wallet.send_.transferFailed");
        if (typeof msg === "string" && (msg.includes("locked") || msg.includes("attempt"))) {
          setPinError(msg);
        } else {
          setPinError(t("wallet.send_.incorrectPin"));
        }
        setPin("");
      }
    }
  };

  const pinDelete = () => setPin((p) => p.slice(0, -1));

  if (step === "success" && result) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#16A34A15", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Ionicons name="checkmark-circle" size={52} color="#16A34A" />
          </View>
          <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "900", color: colors.text, letterSpacing: -1, marginBottom: 8 }}>
            {t("wallet.send_.sent")}
          </Text>
          <Text style={{ fontSize: 32, fontWeight: "900", color: "#16A34A", letterSpacing: -1, marginBottom: 4 }}>
            {naira(amount)}
          </Text>
          <Text style={{ fontSize: 15, color: colors.textMuted, marginBottom: 8 }}>
            {t("wallet.send_.sentTo", { name: result.recipientName || phone })}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 40 }}>
            {t("wallet.send_.newBalance", { amount: naira(result.newBalance) })}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.send_.done")}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 48, paddingVertical: 14, borderRadius: 14 }}
          >
            <Text style={{ color: colors.white, fontWeight: "800", fontSize: 15 }}>{t("wallet.send_.done")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === "pin") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, marginBottom: 32 }}>
          <TouchableOpacity
            onPress={() => setStep("form")}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: colors.text, marginLeft: 16 }}>
            {t("wallet.send_.enterPin")}
          </Text>
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 15, color: colors.textMuted, marginBottom: 4 }}>
            {t("wallet.send_.sendingTo", { amount: naira(amount), phone })}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 32 }}>{t("wallet.send_.enterPinSub")}</Text>

          <Animated.View style={{ flexDirection: "row", gap: 12, marginBottom: 12, transform: [{ translateX: shakeAnim }] }}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: i < pin.length ? colors.primary : colors.border,
                }}
              />
            ))}
          </Animated.View>

          {pinError ? (
            <Text accessibilityLiveRegion="polite" style={{ color: "#DC2626", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              {pinError}
            </Text>
          ) : null}

          {/* Numpad */}
          <View style={{ width: "100%", maxWidth: 300, marginTop: 16 }}>
            {[[1, 2, 3], [4, 5, 6], [7, 8, 9], ["", 0, "del"]].map((row, ri) => (
              <View key={ri} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                {row.map((key, ki) => (
                  <TouchableOpacity
                    key={ki}
                    onPress={() => {
                      if (key === "del") pinDelete();
                      else if (key !== "") handlePinInput(String(key));
                    }}
                    style={{
                      width: 84,
                      height: 64,
                      borderRadius: 16,
                      backgroundColor: key === "" ? "transparent" : colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    disabled={isSending || key === ""}
                    accessibilityRole={key === "" ? "none" : "button"}
                    accessibilityLabel={key === "del" ? t("common.delete") : String(key)}
                  >
                    {key === "del" ? (
                      <Ionicons name="backspace-outline" size={24} color={colors.text} />
                    ) : key !== "" ? (
                      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>{key}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {isSending && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} accessibilityLabel={t("common.loading")} />}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ height: 4, backgroundColor: colors.primary }} />

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 28 }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.back")}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginLeft: 16, letterSpacing: -0.5 }}>
              {t("wallet.sendTitle")}
            </Text>
          </View>

          {/* Balance chip */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 24, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 8 }}>
              {t("wallet.send_.balanceLabel")} <Text style={{ fontWeight: "800", color: colors.text }}>{naira(balance)}</Text>
            </Text>
          </View>

          {/* Quick beneficiaries */}
          {phoneBeneficiaries.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 10 }}>
                {t("wallet.send_.recent")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {phoneBeneficiaries.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => setPhone(b.phone)}
                    accessibilityRole="button"
                    accessibilityLabel={b.name}
                    style={{ alignItems: "center", marginRight: 16 }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.primary }}>{b.name[0]}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }} numberOfLines={1}>{b.name.split(" ")[0]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Phone */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6, letterSpacing: 0.8 }}>
            {t("wallet.send_.phoneLabel")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 4, borderWidth: 1.5, borderColor: phone ? colors.primary : colors.border }}>
            <Ionicons name="call-outline" size={18} color={colors.textMuted} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="08012345678"
              accessibilityLabel={t("wallet.send_.phoneLabel")}
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              style={{ flex: 1, paddingVertical: 14, paddingLeft: 10, fontSize: 15, color: colors.text }}
            />
            {lookingUp && <ActivityIndicator size="small" color={colors.primary} accessibilityLabel={t("common.loading")} />}
          </View>
          {recipientName && (
            <Text style={{ fontSize: 12, color: "#16A34A", fontWeight: "600", marginBottom: 8, paddingLeft: 4 }}>{recipientName}</Text>
          )}

          {/* Amount */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginTop: 16, marginBottom: 6, letterSpacing: 0.8 }}>
            {t("wallet.send_.amountLabel")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderColor: amount ? colors.primary : colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textMuted, marginRight: 4 }}>₦</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              accessibilityLabel={t("wallet.send_.amountLabel")}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={{ flex: 1, paddingVertical: 14, fontSize: 22, fontWeight: "800", color: colors.text }}
            />
          </View>

          {/* Quick amounts */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {quickChips.map((q) => (
              <TouchableOpacity
                key={q}
                onPress={() => setAmount(String(q))}
                accessibilityRole="button"
                accessibilityLabel={naira(q)}
                accessibilityState={{ selected: amount === String(q) }}
                style={{ flex: 1, backgroundColor: colors.surface, paddingVertical: 8, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: amount === String(q) ? colors.primary : colors.border }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: amount === String(q) ? colors.primary : colors.textMuted }}>{naira(q)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6, letterSpacing: 0.8 }}>
            {t("wallet.send_.noteLabel")}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("wallet.send_.notePh")}
            accessibilityLabel={t("wallet.send_.noteLabel")}
            placeholderTextColor={colors.textMuted}
            style={{ backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text, borderWidth: 1.5, borderColor: colors.border, marginBottom: 32 }}
          />

          <TouchableOpacity
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.send_.continue")}
            style={{ backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 14, alignItems: "center" }}
          >
            <Text style={{ color: colors.white, fontWeight: "800", fontSize: 16 }}>{t("wallet.send_.continue")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
