import React, { useState, useEffect } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
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
import { useTheme } from "../../theme";
import Toast from "react-native-toast-message";
import { usePlatformSetting } from "../../services/settings";
import PinBottomSheet from "../../components/PinBottomSheet";

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
  const { tokens } = useTheme();
  const { balance, banks, isSending, beneficiaries } = useSelector((s) => s.wallet);

  const minTransfer = Number(usePlatformSetting("wallet.minTransfer", 100));
  const maxTransfer = Number(usePlatformSetting("wallet.maxTransfer", 500000));
  const quickChipsSetting = usePlatformSetting("wallet.transferQuickAmounts", null);
  const quickChips = Array.isArray(quickChipsSetting) && quickChipsSetting.length > 0
    ? quickChipsSetting.map(Number)
    : [1000, 2000, 5000, 10000];

  const prefill = route?.params ?? {};

  const [step, setStep] = useState("form"); // form | success
  const [selectedBank, setSelectedBank] = useState(
    prefill.bankCode ? { bankCode: prefill.bankCode, bankName: prefill.bankName } : null,
  );
  const [accountNumber, setAccountNumber] = useState(prefill.accountNumber ?? "");
  const [accountName, setAccountName] = useState(prefill.accountName ?? null);
  const [amount, setAmount] = useState(prefill.amount ? String(prefill.amount) : "");
  const [bankSearch, setBankSearch] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showPinSheet, setShowPinSheet] = useState(false);

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
    setShowPinSheet(true);
  };

  // The sheet owns PIN entry (eye toggle, Confirm, and inline setup for no-PIN
  // users). onConfirm must throw on failure; .unwrap() rethrows the thunk's
  // rejectWithValue payload ({ message, code }) so the sheet can react -
  // including switching to inline setup on PIN_NOT_SET.
  const handlePinConfirm = async (enteredPin) => {
    await dispatch(
      sendMoney({
        bankCode: selectedBank.bankCode || selectedBank.code,
        bankName: selectedBank.bankName || selectedBank.name,
        accountNumber,
        accountName,
        amount: parseFloat(amount),
        pin: enteredPin,
      }),
    ).unwrap();

    setShowPinSheet(false);
    setStep("success");
    if (accountName && !bankBeneficiaries.some((b) => b.accountNumber === accountNumber)) {
      dispatch(saveBeneficiary({
        name: accountName,
        bankCode: selectedBank.bankCode || selectedBank.code,
        accountNumber,
        accountName,
      }));
    }
  };

  if (step === "success") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: tokens.status.successSoft, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Ionicons name="checkmark-circle" size={52} color={tokens.status.success} />
          </View>
          <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "900", color: tokens.text.primary, letterSpacing: -1, marginBottom: 8 }}>
            {t("wallet.send_.successTitle")}
          </Text>
          <Text style={{ fontSize: 32, fontWeight: "900", color: tokens.brand.default, letterSpacing: -1, marginBottom: 4 }}>
            {formatNaira(amount)}
          </Text>
          <Text style={{ fontSize: 15, color: tokens.text.muted, marginBottom: 4 }}>{accountName}</Text>
          <Text style={{ fontSize: 13, color: tokens.text.muted, marginBottom: 8 }}>{selectedBank?.bankName || selectedBank?.name} · {accountNumber}</Text>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginBottom: 40, textAlign: "center", paddingHorizontal: 24 }}>
            {t("wallet.send_.successHint")}
          </Text>
          <TouchableOpacity
            onPress={() => goBackOr(navigation)}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.send_.done")}
            style={{ backgroundColor: tokens.brand.default, paddingHorizontal: 48, paddingVertical: 14, borderRadius: 14 }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>{t("wallet.send_.done")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 28 }}>
            <TouchableOpacity
              onPress={() => goBackOr(navigation)}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.back")}
            >
              <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
            </TouchableOpacity>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "900", color: tokens.text.primary, marginLeft: 16, letterSpacing: -0.5 }}>
              {t("wallet.sendTitle")}
            </Text>
          </View>

          {/* Balance chip */}
          <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, padding: 12, marginBottom: 24, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="wallet-outline" size={18} color={tokens.brand.default} />
            <Text style={{ color: tokens.text.muted, fontSize: 13, marginLeft: 8 }}>
              {t("wallet.send_.balanceLabel")} <Text style={{ fontWeight: "800", color: tokens.text.primary }}>{formatNaira(balance)}</Text>
            </Text>
          </View>

          {bankBeneficiaries.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 10, letterSpacing: 0.8 }}>
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
                    style={{ marginRight: 12, backgroundColor: tokens.bg.surface, borderRadius: 12, padding: 12, width: 140 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary }} numberOfLines={1}>{b.accountName || b.name}</Text>
                    <Text style={{ fontSize: 11, color: tokens.text.muted }}>{b.accountNumber}</Text>
                    <Text style={{ fontSize: 10, color: tokens.brand.strong }}>{b.bankCode}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6, letterSpacing: 0.8 }}>
            {t("wallet.send_.bankLabel")}
          </Text>
          <TouchableOpacity
            onPress={() => setShowBankPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={selectedBank ? (selectedBank.bankName || selectedBank.name) : t("wallet.send_.selectBank")}
            style={{ backgroundColor: tokens.bg.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderWidth: 1.5, borderColor: selectedBank ? tokens.brand.default : tokens.border.default }}
          >
            <Text style={{ fontSize: 15, color: selectedBank ? tokens.text.primary : tokens.text.muted, fontWeight: selectedBank ? "700" : "400" }}>
              {selectedBank ? (selectedBank.bankName || selectedBank.name) : t("wallet.send_.selectBank")}
            </Text>
            <Ionicons name="chevron-down" size={18} color={tokens.text.muted} />
          </TouchableOpacity>

          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginBottom: 6, letterSpacing: 0.8 }}>
            {t("wallet.send_.accountLabel")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 4, borderWidth: 1.5, borderColor: accountNumber ? tokens.brand.default : tokens.border.default }}>
            <TextInput
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="0000000000"
              accessibilityLabel={t("wallet.send_.accountLabel")}
              placeholderTextColor={tokens.text.muted}
              keyboardType="numeric"
              maxLength={10}
              style={{ flex: 1, paddingVertical: 14, fontSize: 15, color: tokens.text.primary, letterSpacing: 2 }}
            />
            {resolving && <ActivityIndicator size="small" color={tokens.brand.default} accessibilityLabel={t("common.loading")} />}
          </View>
          {accountName && (
            <Text style={{ fontSize: 13, color: tokens.status.success, fontWeight: "700", marginBottom: 8, paddingLeft: 4 }}>
              {accountName}
            </Text>
          )}
          {!accountName && accountNumber.length === 10 && selectedBank && !resolving && (
            <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: tokens.status.errorStrong, marginBottom: 8, paddingLeft: 4 }}>
              {t("wallet.send_.accountNotFound")}
            </Text>
          )}

          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, marginTop: 12, marginBottom: 6, letterSpacing: 0.8 }}>
            {t("wallet.send_.amountLabel")}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: tokens.bg.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderColor: amount ? tokens.brand.default : tokens.border.default }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.muted, marginRight: 4 }}>₦</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              accessibilityLabel={t("wallet.send_.amountLabel")}
              placeholderTextColor={tokens.text.muted}
              keyboardType="numeric"
              style={{ flex: 1, paddingVertical: 14, fontSize: 22, fontWeight: "800", color: tokens.text.primary }}
            />
          </View>
          <Text style={{ fontSize: 11, color: tokens.text.muted, marginBottom: 8, paddingLeft: 4 }}>
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
                  style={{ flex: 1, backgroundColor: tokens.bg.surface, paddingVertical: 8, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: selected ? tokens.brand.default : tokens.border.default }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? tokens.brand.default : tokens.text.muted }}>
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
            style={{ backgroundColor: tokens.brand.default, paddingVertical: 15, borderRadius: 14, alignItems: "center" }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 16 }}>{t("wallet.send_.continue")}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bank Picker Modal */}
        <Modal visible={showBankPicker} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary }}>
                {t("wallet.send_.bankPickerTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowBankPicker(false)}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
              >
                <Ionicons name="close" size={24} color={tokens.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: tokens.bg.surface, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color={tokens.text.muted} />
              <TextInput
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder={t("wallet.send_.bankSearchPh")}
                accessibilityLabel={t("wallet.send_.bankSearchPh")}
                placeholderTextColor={tokens.text.muted}
                style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 15, color: tokens.text.primary }}
              />
            </View>

            {banks.length === 0 ? (
              <ActivityIndicator color={tokens.brand.default} style={{ marginTop: 24 }} accessibilityLabel={t("common.loading")} />
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
                      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}
                    >
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: tokens.text.primary }}>
                        {item.bankName || item.name}
                      </Text>
                      {selected && (
                        <Ionicons name="checkmark" size={20} color={tokens.brand.default} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </SafeAreaView>
        </Modal>

        <PinBottomSheet
          isVisible={showPinSheet}
          onClose={() => setShowPinSheet(false)}
          onConfirm={handlePinConfirm}
          title={t("wallet.send_.confirmTitle")}
          subtitle={`${formatNaira(amount)}${accountName ? ` to ${accountName}` : ""}`}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
