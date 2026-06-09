import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useRoute } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { formatNaira } from "../../lib/formatters";
import PinBottomSheet from "../../components/PinBottomSheet";
import {
  fetchBanks,
  fetchWallet,
  lookupBankAccount,
  withdrawToBank,
  getPendingWithdraw,
  discardPendingWithdraw,
} from "../../store/slices/walletSlice";
import {
  fetchBeneficiaries,
  saveBeneficiary,
} from "../../store/slices/beneficiariesSlice";

/**
 * Withdraw flow - bank picker, account-number lookup, save-as-beneficiary,
 * PIN-gated submit. The idempotency key persists across kill+restart so the
 * server replays the original response instead of double-charging.
 *
 * State machine:
 *   form → pin (in PinBottomSheet) → success
 * On terminal 4xx the PinBottomSheet's own catch surfaces the error +
 * lockout countdown; the user can re-enter and re-submit.
 */

// Group the integer part with thousand separators for display ("5000" ->
// "5,000") while the model stays a bare numeric string. The amount field's own
// onChangeText strips commas back out, so this round-trips cleanly.
const groupAmount = (raw) => {
  if (!raw) return raw;
  const [int, ...rest] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return raw.includes(".") ? `${grouped}.${rest.join("")}` : grouped;
};

export default function WithdrawScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const prefill = route?.params || {};

  const balance = useSelector((s) => s.wallet?.balance) || 0;
  const banks = useSelector((s) => s.wallet?.banks) || [];
  const settings = useSelector((s) => s.settings?.values) || {};
  const beneficiariesById = useSelector((s) => s.beneficiaries?.byId) || {};
  const beneficiariesAllIds = useSelector((s) => s.beneficiaries?.allIds) || [];

  const beneficiaries = useMemo(
    () => beneficiariesAllIds.map((id) => beneficiariesById[id]).filter(Boolean),
    [beneficiariesById, beneficiariesAllIds],
  );

  const minWithdraw = Number(settings["wallet.minWithdraw"] ?? 500);
  const maxWithdraw = Number(settings["wallet.maxWithdraw"] ?? 500000);
  const withdrawalFee = Number(settings["wallet.withdrawalFee"] ?? 0);
  const quickChips = Array.isArray(settings["wallet.withdrawQuickAmounts"])
    && settings["wallet.withdrawQuickAmounts"].length > 0
    ? settings["wallet.withdrawQuickAmounts"].map(Number)
    : [1000, 5000, 10000, 20000];

  const [selectedBank, setSelectedBank] = useState(
    prefill.bankCode ? { bankCode: prefill.bankCode, bankName: prefill.bankName } : null,
  );
  const [accountNumber, setAccountNumber] = useState(prefill.accountNumber || "");
  const [accountName, setAccountName] = useState(prefill.accountName || null);
  const [amount, setAmount] = useState(prefill.amount ? String(prefill.amount) : "");
  const [bankSearch, setBankSearch] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [success, setSuccess] = useState(null);
  // Carry-over key from a previous kill-mid-flight attempt.
  const [pendingKey, setPendingKey] = useState(null);
  const [pendingBanner, setPendingBanner] = useState(false);
  const lookupTimerRef = useRef(null);

  // Boot - banks, beneficiaries, wallet refresh + check for unfinished withdraw.
  useEffect(() => {
    dispatch(fetchBanks());
    dispatch(fetchBeneficiaries());
    dispatch(fetchWallet());
    (async () => {
      const snap = await getPendingWithdraw();
      if (snap?.idempotencyKey) {
        setPendingKey(snap.idempotencyKey);
        setPendingBanner(true);
        // Prefill the form from the persisted snapshot so the rider can
        // re-confirm with PIN and submit the same key. Body has no PIN
        // (deliberately stripped) - they enter it again.
        const b = snap.body || {};
        if (b.bankCode) setSelectedBank({ bankCode: b.bankCode, bankName: b.bankName });
        if (b.accountNumber) setAccountNumber(b.accountNumber);
        if (b.accountName) setAccountName(b.accountName);
        if (b.amount) setAmount(String(b.amount));
      }
    })();
  }, [dispatch]);

  // Once banks load, hydrate the partial selectedBank ({ bankCode } only).
  useEffect(() => {
    if (!selectedBank || selectedBank.bankName || !banks.length) return;
    const code = selectedBank.bankCode || selectedBank.code;
    if (!code) return;
    const match = banks.find((b) => (b.bankCode || b.code) === code);
    if (match) setSelectedBank(match);
  }, [banks, selectedBank]);

  // Account-name lookup - debounced, fires once we have a bank + 10 digits.
  // Skips the lookup if a saved beneficiary already provided the name for
  // this exact bank+account combo, so tapping a chip doesn't flicker
  // (clear→loading→reload) the name back to itself.
  useEffect(() => {
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    if (!selectedBank || accountNumber.replace(/\D/g, "").length < 10) {
      setAccountName(null);
      return undefined;
    }
    const bankCode = selectedBank.bankCode || selectedBank.code;
    const savedHit = beneficiaries.find(
      (b) => (b.bankCode || b.code) === bankCode && b.accountNumber === accountNumber,
    );
    if (savedHit) {
      setAccountName(savedHit.accountName || savedHit.name || null);
      return undefined;
    }
    setAccountName(null);
    lookupTimerRef.current = setTimeout(async () => {
      setResolving(true);
      try {
        const res = await dispatch(lookupBankAccount({
          bankCode,
          accountNumber,
        }));
        if (lookupBankAccount.fulfilled.match(res)) {
          setAccountName(res.payload?.accountName || res.payload?.data?.accountName || null);
        }
      } finally {
        setResolving(false);
      }
    }, 700);
    return () => { if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current); };
  }, [selectedBank, accountNumber, beneficiaries, dispatch]);

  const filteredBanks = banks.filter((b) => {
    const name = b.bankName || b.name || "";
    return name.toLowerCase().includes(bankSearch.toLowerCase());
  });

  const handleContinue = () => {
    if (!selectedBank) {
      Toast.show({ type: "error", text1: t("withdraw.errSelectBank", "Pick a bank first") });
      return;
    }
    if (!accountNumber || accountNumber.replace(/\D/g, "").length < 10) {
      Toast.show({ type: "error", text1: t("withdraw.errAccount", "Enter a 10-digit account number") });
      return;
    }
    if (!accountName) {
      Toast.show({ type: "error", text1: t("withdraw.errLookup", "We couldn't verify that account") });
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt < minWithdraw) {
      Toast.show({
        type: "error",
        text1: t("withdraw.errMin", "Minimum withdrawal is {{amount}}", { amount: formatNaira(minWithdraw) }),
      });
      return;
    }
    if (amt > maxWithdraw) {
      Toast.show({
        type: "error",
        text1: t("withdraw.errMax", "Maximum withdrawal is {{amount}}", { amount: formatNaira(maxWithdraw) }),
      });
      return;
    }
    if (amt > balance) {
      Toast.show({ type: "error", text1: t("withdraw.errBalance", "Insufficient balance") });
      return;
    }
    setPinVisible(true);
  };

  const handlePinConfirm = async (pin) => {
    const res = await dispatch(withdrawToBank({
      bankCode: selectedBank.bankCode || selectedBank.code,
      bankName: selectedBank.bankName || selectedBank.name,
      accountNumber,
      accountName,
      amount: parseFloat(amount),
      pin,
      // Reuse the persisted key on first submit after a kill-mid-flight.
      idempotencyKey: pendingKey || undefined,
    }));

    if (withdrawToBank.fulfilled.match(res)) {
      setPinVisible(false);
      setPendingKey(null);
      setPendingBanner(false);
      setSuccess({
        amount: parseFloat(amount),
        bankName: selectedBank.bankName || selectedBank.name,
        accountNumber,
        accountName,
        transactionId: res.payload?.transactionId || res.payload?.transaction?.id || null,
        reference: res.payload?.reference || res.payload?.transaction?.reference || null,
      });
      // Save beneficiary if not already saved.
      const exists = beneficiaries.some(
        (b) => (b.bankCode || b.code) === (selectedBank.bankCode || selectedBank.code)
          && b.accountNumber === accountNumber,
      );
      if (!exists) {
        dispatch(saveBeneficiary({
          name: accountName,
          bankCode: selectedBank.bankCode || selectedBank.code,
          accountNumber,
          accountName,
        })).catch?.(() => {});
      }
      return;
    }
    // Rejected - throw so PinBottomSheet shakes + shows the error.
    const payload = res.payload || {};
    const err = new Error(payload.message || t("withdraw.failed", "Withdrawal failed"));
    err.code = payload.code;
    err.status = payload.status;
    err.data = payload.data;
    throw err;
  };

  const discardPending = useCallback(async () => {
    await discardPendingWithdraw();
    setPendingKey(null);
    setPendingBanner(false);
  }, []);

  // ── Success screen ─────────────────────────────────────────────────────
  if (success) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View
            style={{
              width: 86, height: 86, borderRadius: 43,
              backgroundColor: "#16A34A22",
              alignItems: "center", justifyContent: "center", marginBottom: 22,
            }}
          >
            <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
          </View>
          <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "800", color: tokens.text.primary, marginBottom: 6 }}>
            {t("withdraw.successTitle", "Withdrawal sent")}
          </Text>
          <Text style={{ fontSize: 32, fontWeight: "900", color: tokens.brand.default, letterSpacing: -1, marginBottom: 8 }}>
            {formatNaira(success.amount)}
          </Text>
          <Text style={{ fontSize: 14, color: tokens.text.muted, textAlign: "center" }}>
            {success.accountName}
          </Text>
          <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2, textAlign: "center" }}>
            {success.bankName} · {success.accountNumber}
          </Text>
          <Text style={{ fontSize: 11, color: tokens.text.placeholder, marginTop: 16, paddingHorizontal: 24, textAlign: "center" }}>
            {t("withdraw.successHint", "We'll notify you when the bank confirms the transfer. This usually takes under a minute.")}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 28 }}>
            {success.transactionId ? (
              <TouchableOpacity
                onPress={() => navigation.replace("TransactionDetail", { transactionId: success.transactionId })}
                accessibilityRole="button"
                accessibilityLabel={t("withdraw.viewReceipt", "View receipt")}
                style={{
                  paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12,
                  backgroundColor: tokens.bg.surface,
                  borderWidth: 1, borderColor: tokens.border.default,
                }}
              >
                <Text style={{ color: tokens.text.primary, fontWeight: "700", fontSize: 14 }}>
                  {t("withdraw.viewReceipt", "View receipt")}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t("withdraw.done", "Done")}
              style={{
                paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12,
                backgroundColor: tokens.brand.default,
              }}
            >
              <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 14 }}>
                {t("withdraw.done", "Done")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
        <View
          style={{
            flexDirection: "row", alignItems: "center",
            paddingHorizontal: 14, paddingVertical: 12,
            backgroundColor: tokens.bg.surface,
            borderBottomWidth: 1, borderBottomColor: tokens.border.default,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("common.back", "Back")}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
            {t("withdraw.title", "Withdraw")}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* Pending banner */}
          {pendingBanner ? (
            <View
              style={{
                marginBottom: 14, padding: 12, borderRadius: 12,
                backgroundColor: tokens.status.warningSoft,
                borderWidth: 1, borderColor: tokens.status.warningSoft,
                flexDirection: "row", alignItems: "flex-start",
              }}
            >
              <Ionicons name="time-outline" size={20} color={tokens.status.warningStrong} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.status.warningStrong }}>
                  {t("withdraw.pendingTitle", "Unfinished withdrawal")}
                </Text>
                <Text style={{ fontSize: 12, color: tokens.text.primary, marginTop: 2 }}>
                  {t("withdraw.pendingBody", "We restored your last attempt. Confirm with PIN to resume. We won't double-charge you.")}
                </Text>
                <TouchableOpacity
                  onPress={discardPending}
                  accessibilityRole="button"
                  accessibilityLabel={t("withdraw.discard", "Discard")}
                  style={{ alignSelf: "flex-start", marginTop: 6 }}
                  hitSlop={6}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.brand.default }}>
                    {t("withdraw.discard", "Discard")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Balance chip */}
          <View
            style={{
              backgroundColor: tokens.bg.surface,
              borderRadius: 12, padding: 12, marginBottom: 16,
              flexDirection: "row", alignItems: "center",
              borderWidth: 1, borderColor: tokens.border.default,
            }}
          >
            <Ionicons name="wallet-outline" size={18} color={tokens.brand.default} />
            <Text style={{ color: tokens.text.muted, fontSize: 13, marginLeft: 8 }}>
              {t("withdraw.balance", "Available")}{" "}
              <Text style={{ fontWeight: "800", color: tokens.text.primary }}>{formatNaira(balance)}</Text>
            </Text>
          </View>

          {/* Saved beneficiaries chips */}
          {beneficiaries.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, letterSpacing: 0.5, marginBottom: 8 }}>
                {t("withdraw.savedLabel", "SAVED ACCOUNTS")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {beneficiaries.map((b) => {
                  const selected = (selectedBank?.bankCode || selectedBank?.code) === b.bankCode
                    && accountNumber === b.accountNumber;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      onPress={() => {
                        const bank = banks.find((bk) => (bk.bankCode || bk.code) === b.bankCode);
                        setSelectedBank(bank || { bankCode: b.bankCode, bankName: b.bankName || b.accountName });
                        setAccountNumber(b.accountNumber);
                        setAccountName(b.accountName);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={b.accountName || b.name}
                      accessibilityState={{ selected }}
                      style={{
                        marginRight: 10,
                        backgroundColor: selected ? tokens.brand.soft : tokens.bg.surface,
                        borderColor: selected ? tokens.brand.softBorder : tokens.border.default,
                        borderWidth: 1, borderRadius: 12, padding: 10, minWidth: 140,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "800", color: tokens.text.primary }} numberOfLines={1}>
                        {b.accountName || b.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>{b.accountNumber}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Bank picker */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>
            {t("withdraw.bankLabel", "BANK")}
          </Text>
          <TouchableOpacity
            onPress={() => setShowBankPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={t("withdraw.selectBankAria", "Select bank")}
            style={{
              backgroundColor: tokens.bg.surface,
              borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              marginBottom: 14,
              borderWidth: 1.5, borderColor: selectedBank ? tokens.brand.default : tokens.border.default,
            }}
          >
            <Text style={{ fontSize: 14, color: selectedBank ? tokens.text.primary : tokens.text.muted, fontWeight: selectedBank ? "700" : "500" }}>
              {selectedBank ? (selectedBank.bankName || selectedBank.name) : t("withdraw.selectBank", "Select bank")}
            </Text>
            <Ionicons name="chevron-down" size={18} color={tokens.text.muted} />
          </TouchableOpacity>

          {/* Account number */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>
            {t("withdraw.accountLabel", "ACCOUNT NUMBER")}
          </Text>
          <View
            style={{
              flexDirection: "row", alignItems: "center",
              backgroundColor: tokens.bg.surface,
              borderRadius: 14, paddingHorizontal: 14, marginBottom: 6,
              borderWidth: 1.5, borderColor: accountNumber ? tokens.brand.default : tokens.border.default,
            }}
          >
            <TextInput
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="0000000000"
              placeholderTextColor={tokens.text.placeholder}
              keyboardType="number-pad"
              maxLength={10}
              accessibilityLabel={t("withdraw.accountLabel", "Account number")}
              style={{
                flex: 1, paddingVertical: 14, fontSize: 15,
                color: tokens.text.primary, letterSpacing: 2,
              }}
            />
            {resolving ? <ActivityIndicator size="small" color={tokens.brand.default} /> : null}
          </View>
          {accountName ? (
            <Text style={{ fontSize: 13, fontWeight: "700", color: tokens.status.successStrong, marginBottom: 12, marginLeft: 4 }}>
              {accountName}
            </Text>
          ) : (accountNumber.length === 10 && selectedBank && !resolving) ? (
            <Text style={{ fontSize: 12, color: tokens.status.errorStrong, marginBottom: 12, marginLeft: 4 }}>
              {t("withdraw.accountNotFound", "Account not found. Check the number and bank.")}
            </Text>
          ) : null}

          {/* Amount */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.muted, letterSpacing: 0.5, marginBottom: 6, marginTop: 6 }}>
            {t("withdraw.amountLabel", "AMOUNT")}
          </Text>
          <View
            style={{
              flexDirection: "row", alignItems: "center",
              backgroundColor: tokens.bg.surface,
              borderRadius: 14, paddingHorizontal: 14, marginBottom: 8,
              borderWidth: 1.5, borderColor: amount ? tokens.brand.default : tokens.border.default,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.muted, marginRight: 4 }}>₦</Text>
            <TextInput
              value={groupAmount(amount)}
              onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ""))}
              placeholder="0.00"
              placeholderTextColor={tokens.text.placeholder}
              keyboardType="numeric"
              accessibilityLabel={t("withdraw.amountLabel", "Amount")}
              style={{ flex: 1, paddingVertical: 14, fontSize: 22, fontWeight: "800", color: tokens.text.primary }}
            />
          </View>
          <Text style={{ fontSize: 11, color: tokens.text.muted, marginBottom: 12, marginLeft: 4 }}>
            {withdrawalFee > 0
              ? t("withdraw.minFee", "Min {{min}} · Fee {{fee}}", {
                  min: formatNaira(minWithdraw),
                  fee: formatNaira(withdrawalFee),
                })
              : t("withdraw.min", "Min {{min}}", { min: formatNaira(minWithdraw) })}
          </Text>

          {/* Quick amounts */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {quickChips.map((q) => {
              const selected = amount === String(q);
              return (
                <TouchableOpacity
                  key={q}
                  onPress={() => setAmount(String(q))}
                  accessibilityRole="button"
                  accessibilityLabel={formatNaira(q)}
                  accessibilityState={{ selected }}
                  style={{
                    flex: 1, paddingVertical: 9, borderRadius: 10,
                    backgroundColor: selected ? tokens.brand.soft : tokens.bg.surface,
                    borderWidth: 1, borderColor: selected ? tokens.brand.softBorder : tokens.border.default,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? tokens.brand.strong : tokens.text.muted }}>
                    {q >= 1000 ? `₦${q / 1000}k` : formatNaira(q)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel={t("withdraw.continue", "Continue")}
            style={{
              backgroundColor: tokens.brand.default,
              paddingVertical: 16, borderRadius: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>
              {t("withdraw.continue", "Continue")}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bank picker modal */}
        <Modal visible={showBankPicker} animationType="slide" onRequestClose={() => setShowBankPicker(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
            <View
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingHorizontal: 16, paddingVertical: 14,
                borderBottomWidth: 1, borderBottomColor: tokens.border.default,
                backgroundColor: tokens.bg.surface,
              }}
            >
              <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
                {t("withdraw.bankPickerTitle", "Choose your bank")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowBankPicker(false)}
                accessibilityRole="button"
                accessibilityLabel={t("common.close", "Close")}
              >
                <Ionicons name="close" size={22} color={tokens.text.primary} />
              </TouchableOpacity>
            </View>
            <View
              style={{
                margin: 14, backgroundColor: tokens.bg.surface,
                borderRadius: 12, flexDirection: "row", alignItems: "center",
                paddingHorizontal: 12,
                borderWidth: 1, borderColor: tokens.border.default,
              }}
            >
              <Ionicons name="search" size={18} color={tokens.text.muted} />
              <TextInput
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder={t("withdraw.bankSearchPh", "Search banks")}
                placeholderTextColor={tokens.text.placeholder}
                accessibilityLabel={t("withdraw.bankSearchPh", "Search banks")}
                style={{ flex: 1, paddingVertical: 11, paddingLeft: 8, fontSize: 14, color: tokens.text.primary }}
              />
            </View>
            {banks.length === 0 ? (
              <ActivityIndicator color={tokens.brand.default} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={filteredBanks}
                keyExtractor={(item, i) => item.bankCode || item.code || String(i)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const selected = selectedBank && (selectedBank.bankCode || selectedBank.code) === (item.bankCode || item.code);
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedBank(item);
                        setAccountName(null);
                        setShowBankPicker(false);
                        setBankSearch("");
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={item.bankName || item.name}
                      style={{
                        flexDirection: "row", alignItems: "center",
                        paddingHorizontal: 16, paddingVertical: 14,
                        borderBottomWidth: 1, borderBottomColor: tokens.border.subtle,
                      }}
                    >
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: tokens.text.primary }}>
                        {item.bankName || item.name}
                      </Text>
                      {selected ? <Ionicons name="checkmark" size={20} color={tokens.brand.default} /> : null}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </SafeAreaView>
        </Modal>

        <PinBottomSheet
          isVisible={pinVisible}
          onClose={() => setPinVisible(false)}
          onConfirm={handlePinConfirm}
          title={t("withdraw.pinTitle", "Confirm withdrawal")}
          subtitle={t("withdraw.pinSubtitle", "Enter your 6-digit PIN to authorise")}
          onSetupPin={() => navigation.navigate("SetPin")}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
