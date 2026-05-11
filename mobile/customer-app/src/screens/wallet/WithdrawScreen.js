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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchBanks,
  lookupBankAccount,
  withdrawToBank,
  saveBeneficiary,
  fetchBeneficiaries,
} from "../../store/slices/walletSlice";
import { colors } from "../../theme";
import Toast from "react-native-toast-message";
import { usePlatformSetting } from "../../services/settings";

const PIN_LENGTH = 6;

const formatNaira = (n) => `₦${Number(n).toLocaleString()}`;
const formatChip = (n) => (n >= 1000 ? `₦${n / 1000}k` : `₦${n}`);

export default function WithdrawScreen({ navigation }) {
  const dispatch = useDispatch();
  const { balance, banks, isWithdrawing, beneficiaries } = useSelector((s) => s.wallet);

  const minWithdraw = Number(usePlatformSetting("wallet.minWithdraw", 500));
  const maxWithdraw = Number(usePlatformSetting("wallet.maxWithdraw", 500000));
  const withdrawalFee = Number(usePlatformSetting("wallet.withdrawalFee", 25));
  const quickChipsSetting = usePlatformSetting("wallet.withdrawQuickAmounts", null);
  const quickChips = Array.isArray(quickChipsSetting) && quickChipsSetting.length > 0
    ? quickChipsSetting.map(Number)
    : [1000, 5000, 10000, 20000];

  const [step, setStep] = useState("form"); // form | pin | success
  const [selectedBank, setSelectedBank] = useState(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState(null);
  const [amount, setAmount] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [result, setResult] = useState(null);

  useEffect(() => {
    dispatch(fetchBanks());
    dispatch(fetchBeneficiaries());
  }, [dispatch]);

  // Auto-resolve account name
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
  }, [selectedBank, accountNumber]);

  const filteredBanks = banks.filter((b) => {
    const name = b.bankName || b.name || "";
    return name.toLowerCase().includes(bankSearch.toLowerCase());
  });

  // Use bank beneficiaries for quick pick
  const bankBeneficiaries = beneficiaries.filter((b) => b.bankCode && b.accountNumber);

  const handleContinue = () => {
    if (!selectedBank) { Toast.show({ type: "error", text1: "Select a bank" }); return; }
    if (!accountNumber || accountNumber.replace(/\D/g, "").length < 10) { Toast.show({ type: "error", text1: "Enter account number" }); return; }
    if (!accountName) { Toast.show({ type: "error", text1: "Account name not resolved yet" }); return; }
    const amt = parseFloat(amount);
    if (!amt || amt < minWithdraw) { Toast.show({ type: "error", text1: `Minimum withdrawal is ${formatNaira(minWithdraw)}` }); return; }
    if (amt > maxWithdraw) { Toast.show({ type: "error", text1: `Maximum withdrawal is ${formatNaira(maxWithdraw)}` }); return; }
    if (amt > balance) { Toast.show({ type: "error", text1: "Insufficient balance" }); return; }
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
        withdrawToBank({
          bankCode: selectedBank.bankCode || selectedBank.code,
          accountNumber,
          accountName,
          amount: parseFloat(amount),
          pin: newPin,
        }),
      );

      if (withdrawToBank.fulfilled.match(res)) {
        setResult(res.payload);
        setStep("success");
        // Offer to save beneficiary
        if (accountName && !bankBeneficiaries.some((b) => b.accountNumber === accountNumber)) {
          dispatch(saveBeneficiary({
            name: accountName,
            bankCode: selectedBank.bankCode || selectedBank.code,
            accountNumber,
            accountName,
          }));
        }
      } else {
        shake();
        const msg = res.payload || "Withdrawal failed";
        setPinError(msg.includes("locked") || msg.includes("attempt") ? msg : "Incorrect PIN");
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
          <Text style={{ fontSize: 26, fontWeight: "900", color: colors.text, letterSpacing: -1, marginBottom: 8 }}>Processing</Text>
          <Text style={{ fontSize: 32, fontWeight: "900", color: colors.primary, letterSpacing: -1, marginBottom: 4 }}>
            ₦{parseFloat(amount).toLocaleString()}
          </Text>
          <Text style={{ fontSize: 15, color: colors.textMuted, marginBottom: 4 }}>to {accountName}</Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>{selectedBank?.bankName || selectedBank?.name} · {accountNumber}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 40 }}>
            Your bank transfer is being processed. You'll get a notification when it's done.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 48, paddingVertical: 14, borderRadius: 14 }}
          >
            <Text style={{ color: colors.white, fontWeight: "800", fontSize: 15 }}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === "pin") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, marginBottom: 32 }}>
          <TouchableOpacity onPress={() => setStep("form")}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, marginLeft: 16 }}>Confirm Withdrawal</Text>
        </View>

        {/* Summary */}
        <View style={{ marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 32 }}>
          <Row label="To" value={accountName} />
          <Row label="Bank" value={selectedBank?.bankName || selectedBank?.name} />
          <Row label="Account" value={accountNumber} />
          <Row label="Amount" value={`₦${parseFloat(amount).toLocaleString()}`} bold />
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 32 }}>Enter your 6-digit transaction PIN</Text>

          <Animated.View style={{ flexDirection: "row", gap: 12, marginBottom: 12, transform: [{ translateX: shakeAnim }] }}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View key={i} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: i < pin.length ? colors.primary : colors.border }} />
            ))}
          </Animated.View>

          {pinError ? <Text style={{ color: "#DC2626", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>{pinError}</Text> : null}

          <View style={{ width: "100%", maxWidth: 300, marginTop: 16 }}>
            {[[1, 2, 3], [4, 5, 6], [7, 8, 9], ["", 0, "del"]].map((row, ri) => (
              <View key={ri} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                {row.map((key, ki) => (
                  <TouchableOpacity
                    key={ki}
                    onPress={() => { if (key === "del") pinDelete(); else if (key !== "") handlePinInput(String(key)); }}
                    style={{ width: 84, height: 64, borderRadius: 16, backgroundColor: key === "" ? "transparent" : colors.surface, alignItems: "center", justifyContent: "center" }}
                    disabled={isWithdrawing}
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

          {isWithdrawing && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}
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
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginLeft: 16, letterSpacing: -0.5 }}>Withdraw</Text>
          </View>

          {/* Balance chip */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 24, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 8 }}>
              Balance: <Text style={{ fontWeight: "800", color: colors.text }}>₦{Number(balance).toLocaleString()}</Text>
            </Text>
          </View>

          {/* Quick beneficiaries */}
          {bankBeneficiaries.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 10, letterSpacing: 0.8 }}>SAVED ACCOUNTS</Text>
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
                    style={{ marginRight: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 12, width: 140 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }} numberOfLines={1}>{b.accountName || b.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{b.accountNumber}</Text>
                    <Text style={{ fontSize: 10, color: colors.primary }}>{b.bankCode}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bank picker */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6, letterSpacing: 0.8 }}>BANK</Text>
          <TouchableOpacity
            onPress={() => setShowBankPicker(true)}
            style={{ backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderWidth: 1.5, borderColor: selectedBank ? colors.primary : colors.border }}
          >
            <Text style={{ fontSize: 15, color: selectedBank ? colors.text : colors.textMuted, fontWeight: selectedBank ? "700" : "400" }}>
              {selectedBank ? (selectedBank.bankName || selectedBank.name) : "Select bank"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Account number */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 6, letterSpacing: 0.8 }}>ACCOUNT NUMBER</Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 4, borderWidth: 1.5, borderColor: accountNumber ? colors.primary : colors.border }}>
            <TextInput
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="0000000000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              maxLength={10}
              style={{ flex: 1, paddingVertical: 14, fontSize: 15, color: colors.text, letterSpacing: 2 }}
            />
            {resolving && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          {accountName && (
            <Text style={{ fontSize: 13, color: "#16A34A", fontWeight: "700", marginBottom: 8, paddingLeft: 4 }}>
              {accountName}
            </Text>
          )}
          {!accountName && accountNumber.length === 10 && selectedBank && !resolving && (
            <Text style={{ fontSize: 12, color: "#DC2626", marginBottom: 8, paddingLeft: 4 }}>Account not found — check number or bank</Text>
          )}

          {/* Amount */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginTop: 12, marginBottom: 6, letterSpacing: 0.8 }}>AMOUNT (₦)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderColor: amount ? colors.primary : colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textMuted, marginRight: 4 }}>₦</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={{ flex: 1, paddingVertical: 14, fontSize: 22, fontWeight: "800", color: colors.text }}
            />
          </View>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8, paddingLeft: 4 }}>
            Min: {formatNaira(minWithdraw)} · Fee: {formatNaira(withdrawalFee)}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 32 }}>
            {quickChips.map((q) => (
              <TouchableOpacity key={q} onPress={() => setAmount(String(q))}
                style={{ flex: 1, backgroundColor: colors.surface, paddingVertical: 8, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: amount === String(q) ? colors.primary : colors.border }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: amount === String(q) ? colors.primary : colors.textMuted }}>
                  {formatChip(q)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleContinue}
            style={{ backgroundColor: colors.primary, paddingVertical: 15, borderRadius: 14, alignItems: "center" }}
          >
            <Text style={{ color: colors.white, fontWeight: "800", fontSize: 16 }}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bank Picker Modal */}
        <Modal visible={showBankPicker} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Select Bank</Text>
              <TouchableOpacity onPress={() => setShowBankPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder="Search bank..."
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 15, color: colors.text }}
              />
            </View>

            {banks.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={filteredBanks}
                keyExtractor={(item, i) => item.bankCode || item.code || String(i)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { setSelectedBank(item); setAccountName(null); setShowBankPicker(false); setBankSearch(""); }}
                    style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.text }}>
                      {item.bankName || item.name}
                    </Text>
                    {selectedBank && (selectedBank.bankCode || selectedBank.code) === (item.bankCode || item.code) && (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
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
