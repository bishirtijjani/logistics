import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  fetchBanks,
  lookupBankAccount,
  sendMoney,
  saveBeneficiary,
  fetchBeneficiaries,
} from "../../store/slices/walletSlice";
import { colors } from "../../theme";
import Toast from "react-native-toast-message";
import { usePlatformSetting } from "../../services/settings";
import { usePinGuard } from "../../lib/usePinGuard";

const PIN_LENGTH = 6;

const formatNaira = (n) => `₦${Number(n).toLocaleString()}`;
const formatChip = (n) => (n >= 1000 ? `₦${n / 1000}k` : `₦${n}`);

/**
 * Send money = transfer wallet balance to any Nigerian bank account. This is the
 * same disbursement rail as Withdraw (the backend routes /wallet/transfer
 * through withdrawToBank); the screen mirrors WithdrawScreen but reads as
 * "sending to someone" rather than cashing out to yourself.
 */
export default function SendMoneyScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { balance, banks, isSending, beneficiaries } = useSelector((s) => s.wallet);
  const requirePin = usePinGuard();

  const minTransfer = Number(usePlatformSetting("wallet.minTransfer", 100));
  const maxTransfer = Number(usePlatformSetting("wallet.maxTransfer", 500000));
  const quickChipsSetting = usePlatformSetting("wallet.transferQuickAmounts", null);
  const quickChips = Array.isArray(quickChipsSetting) && quickChipsSetting.length > 0
    ? quickChipsSetting.map(Number)
    : [1000, 2000, 5000, 10000];

  const prefill = route?.params ?? {};

  const [step, setStep] = useState("form"); // form | pin | success
  const [selectedBank, setSelectedBank] = useState(
    prefill.bankCode ? { bankCode: prefill.bankCode, bankName: prefill.bankName } : null,
  );
  const [accountNumber, setAccountNumber] = useState(prefill.accountNumber ?? "");
  const [accountName, setAccountName] = useState(prefill.accountName ?? null);
  const [amount, setAmount] = useState(prefill.amount ? String(prefill.amount) : "");
  const [bankSearch, setBankSearch] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    dispatch(fetchBanks());
    dispatch(fetchBeneficiaries());
  }, [dispatch]);

  // Resolve the bankName once the bank list loads if we were prefilled with just a code.
  useEffect(() => {
    if (!selectedBank || selectedBank.bankName || !banks?.length) return;
    const code = selectedBank.bankCode || selectedBank.code;
    if (!code) return;
    const match = banks.find((b) => (b.bankCode || b.code) === code);
    if (match) setSelectedBank(match);
  }, [banks, selectedBank]);

  // Resolve account name as the user finishes typing the 10-digit number.
  useEffect(() => {
    setAccountName(null);
    if (!selectedBank || accountNumber.replace(/\D/g, "").length < 10) return;
    const timer = setTimeout(async () => {
      setResolving(true);
      const res = await dispatch(lookupBankAccount({ bankCode: selectedBank.bankCode || selectedBank.code, accountNumber }));
      if (lookupBankAccount.fulfilled.match(res)) {
        setAccountName(res.payload?.accountName || res.payload?.data?.accountName || null);
      }
      setResolving(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedBank, accountNumber, dispatch]);

  const filteredBanks = banks.filter((b) => {
    const name = b.bankName || b.name || "";
    return name.toLowerCase().includes(bankSearch.toLowerCase());
  });

  const bankBeneficiaries = beneficiaries.filter((b) => b.bankCode && b.accountNumber);

  const handleContinue = () => {
    if (!selectedBank) { Toast.show({ type: "error", text1: t("wallet.send_.selectABank") }); return; }
    if (!accountNumber || accountNumber.replace(/\D/g, "").length < 10) { Toast.show({ type: "error", text1: t("wallet.send_.enterAccount") }); return; }
    if (!accountName) { Toast.show({ type: "error", text1: t("wallet.send_.accountNotResolved") }); return; }
    const amt = parseFloat(amount);
    if (!amt || amt < minTransfer) { Toast.show({ type: "error", text1: t("wallet.send_.minTransfer", { amount: formatNaira(minTransfer) }) }); return; }
    if (amt > maxTransfer) { Toast.show({ type: "error", text1: t("wallet.send_.maxTransfer", { amount: formatNaira(maxTransfer) }) }); return; }
    if (amt > balance) { Toast.show({ type: "error", text1: t("errors.INSUFFICIENT_BALANCE") }); return; }
    if (!requirePin()) return;
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
          bankCode: selectedBank.bankCode || selectedBank.code,
          bankName: selectedBank.bankName || selectedBank.name,
          accountNumber,
          accountName,
          amount: parseFloat(amount),
          pin: newPin,
        }),
      );

      if (sendMoney.fulfilled.match(res)) {
        setStep("success");
        if (accountName && !bankBeneficiaries.some((b) => b.accountNumber === accountNumber)) {
          dispatch(saveBeneficiary({
            name: accountName,
            bankCode: selectedBank.bankCode || selectedBank.code,
            accountNumber,
            accountName,
          }));
        }
      } else if (res.payload?.code === "PIN_NOT_SET") {
        // No transaction PIN yet — bounce back to the form and route to SetPin so
        // the keypad isn't left in a dead state.
        setStep("form");
        setPin("");
        setPinError("");
        Toast.show({
          type: "info",
          text1: res.payload?.message || t("wallet.send_.pinNotSetTitle"),
          text2: t("wallet.send_.pinNotSetHint"),
        });
        navigation.navigate("SetPin");
      } else {
        shake();
        const msg = res.payload?.message || res.payload || t("wallet.send_.transferFailed");
        setPinError(typeof msg === "string" && (msg.includes("locked") || msg.includes("attempt")) ? msg : t("wallet.send_.incorrectPin"));
        setPin("");
      }
    }
  };

  const pinDelete = () => setPin((p) => p.slice(0, -1));

  if (step === "success") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#16A34A15", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Ionicons name="checkmark-circle" size={52} color="#16A34A" />
          </View>
          <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "900", color: colors.text, letterSpacing: -1, marginBottom: 8 }}>
            {t("wallet.send_.successTitle")}
          </Text>
          <Text style={{ fontSize: 32, fontWeight: "900", color: colors.primary, letterSpacing: -1, marginBottom: 4 }}>
            {formatNaira(amount)}
          </Text>
          <Text style={{ fontSize: 15, color: colors.textMuted, marginBottom: 4 }}>{accountName}</Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>{selectedBank?.bankName || selectedBank?.name} · {accountNumber}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 40, textAlign: "center", paddingHorizontal: 24 }}>
            {t("wallet.send_.successHint")}
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
            {t("wallet.send_.confirmTitle")}
          </Text>
        </View>

        {/* Summary */}
        <View style={{ marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 32 }}>
          <Row label={t("wallet.send_.summaryTo")} value={accountName} />
          <Row label={t("wallet.send_.summaryBank")} value={selectedBank?.bankName || selectedBank?.name} />
          <Row label={t("wallet.send_.summaryAccount")} value={accountNumber} />
          <Row label={t("wallet.send_.summaryAmount")} value={formatNaira(amount)} bold />
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 32 }}>
            {t("wallet.send_.enterPinSub")}
          </Text>

          <Animated.View style={{ flexDirection: "row", gap: 12, marginBottom: 12, transform: [{ translateX: shakeAnim }] }}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View key={i} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: i < pin.length ? colors.primary : colors.border }} />
            ))}
          </Animated.View>

          {pinError ? (
            <Text accessibilityLiveRegion="polite" style={{ color: "#DC2626", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              {pinError}
            </Text>
          ) : null}

          <View style={{ width: "100%", maxWidth: 300, marginTop: 16 }}>
            {[[1, 2, 3], [4, 5, 6], [7, 8, 9], ["", 0, "del"]].map((row, ri) => (
              <View key={ri} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                {row.map((key, ki) => (
                  <TouchableOpacity
                    key={ki}
                    onPress={() => { if (key === "del") pinDelete(); else if (key !== "") handlePinInput(String(key)); }}
                    style={{ width: 84, height: 64, borderRadius: 16, backgroundColor: key === "" ? "transparent" : colors.surface, alignItems: "center", justifyContent: "center" }}
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
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ height: 4, backgroundColor: colors.primary }} />

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
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
              {t("wallet.send_.balanceLabel")} <Text style={{ fontWeight: "800", color: colors.text }}>{formatNaira(balance)}</Text>
            </Text>
          </View>

          {bankBeneficiaries.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 10, letterSpacing: 0.8 }}>
                {t("wallet.send_.saved")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {bankBeneficiaries.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => {
                      const bank = banks.find((bk) => (bk.bankCode || bk.code) === b.bankCode);
                      if (bank) setSelectedBank(bank);
                      setAccountNumber(b.accountNumber);
                      setAccountName(b.accountName);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={b.accountName || b.name}
                    style={{ marginRight: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 12, width: 140 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }} numberOfLines={1}>{b.accountName || b.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{b.accountNumber}</Text>
                    <Text style={{ fontSize: 10, color: colors.primaryStrong }}>{b.bankCode}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6, letterSpacing: 0.8 }}>
            {t("wallet.send_.bankLabel")}
          </Text>
          <TouchableOpacity
            onPress={() => setShowBankPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={selectedBank ? (selectedBank.bankName || selectedBank.name) : t("wallet.send_.selectBank")}
            style={{ backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderWidth: 1.5, borderColor: selectedBank ? colors.primary : colors.border }}
          >
            <Text style={{ fontSize: 15, color: selectedBank ? colors.text : colors.textMuted, fontWeight: selectedBank ? "700" : "400" }}>
              {selectedBank ? (selectedBank.bankName || selectedBank.name) : t("wallet.send_.selectBank")}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6, letterSpacing: 0.8 }}>
            {t("wallet.send_.accountLabel")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 4, borderWidth: 1.5, borderColor: accountNumber ? colors.primary : colors.border }}>
            <TextInput
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="0000000000"
              accessibilityLabel={t("wallet.send_.accountLabel")}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              maxLength={10}
              style={{ flex: 1, paddingVertical: 14, fontSize: 15, color: colors.text, letterSpacing: 2 }}
            />
            {resolving && <ActivityIndicator size="small" color={colors.primary} accessibilityLabel={t("common.loading")} />}
          </View>
          {accountName && (
            <Text style={{ fontSize: 13, color: "#16A34A", fontWeight: "700", marginBottom: 8, paddingLeft: 4 }}>
              {accountName}
            </Text>
          )}
          {!accountName && accountNumber.length === 10 && selectedBank && !resolving && (
            <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: "#DC2626", marginBottom: 8, paddingLeft: 4 }}>
              {t("wallet.send_.accountNotFound")}
            </Text>
          )}

          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginTop: 12, marginBottom: 6, letterSpacing: 0.8 }}>
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
          <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8, paddingLeft: 4 }}>
            {t("wallet.send_.minHint", { min: formatNaira(minTransfer) })}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 32 }}>
            {quickChips.map((q) => {
              const selected = amount === String(q);
              return (
                <TouchableOpacity
                  key={q}
                  onPress={() => setAmount(String(q))}
                  accessibilityRole="button"
                  accessibilityLabel={formatNaira(q)}
                  accessibilityState={{ selected }}
                  style={{ flex: 1, backgroundColor: colors.surface, paddingVertical: 8, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? colors.primary : colors.textMuted }}>
                    {formatChip(q)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.send_.continue")}
            style={{ backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 14, alignItems: "center" }}
          >
            <Text style={{ color: colors.white, fontWeight: "800", fontSize: 16 }}>{t("wallet.send_.continue")}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bank Picker Modal */}
        <Modal visible={showBankPicker} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                {t("wallet.send_.bankPickerTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowBankPicker(false)}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder={t("wallet.send_.bankSearchPh")}
                accessibilityLabel={t("wallet.send_.bankSearchPh")}
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 15, color: colors.text }}
              />
            </View>

            {banks.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} accessibilityLabel={t("common.loading")} />
            ) : (
              <FlatList
                data={filteredBanks}
                keyExtractor={(item, i) => item.bankCode || item.code || String(i)}
                renderItem={({ item }) => {
                  const selected = selectedBank && (selectedBank.bankCode || selectedBank.code) === (item.bankCode || item.code);
                  return (
                    <TouchableOpacity
                      onPress={() => { setSelectedBank(item); setAccountName(null); setShowBankPicker(false); setBankSearch(""); }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={item.bankName || item.name}
                      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    >
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.text }}>
                        {item.bankName || item.name}
                      </Text>
                      {selected && (
                        <Ionicons name="checkmark" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, bold }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 13, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: bold ? "800" : "600", color: bold ? colors.primary : colors.text }}>{value}</Text>
    </View>
  );
}
