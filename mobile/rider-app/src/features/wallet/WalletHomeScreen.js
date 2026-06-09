import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { formatNaira } from "../../lib/formatters";
import { fetchWallet, retryProvisioning } from "../../store/slices/walletSlice";

const PROVISIONING_POLL_MS = 30_000;

/**
 * Wallet home - balance, virtual NUBAN, quick actions. On balance change
 * (socket-driven), the big number pops with a brief scale animation so the
 * rider feels each settlement.
 *
 * If the rider's virtual account hasn't been provisioned yet, we show a
 * provisioning-pending state with a 30 s auto-retry - same UX as customer-app.
 */
export default function WalletHomeScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const balance = useSelector((s) => s.wallet?.balance) || 0;
  const accountNumber = useSelector((s) => s.wallet?.accountNumber);
  const bankName = useSelector((s) => s.wallet?.bankName);
  const accountName = useSelector((s) => s.wallet?.accountName);
  const isLocked = useSelector((s) => s.wallet?.isLocked);
  const isLoading = useSelector((s) => s.wallet?.isLoading);
  const provisioningInFlight = useSelector((s) => s.wallet?.provisioningInFlight);

  const [refreshing, setRefreshing] = useState(false);
  const popAnim = useRef(new Animated.Value(1)).current;
  const lastBalanceRef = useRef(balance);

  useEffect(() => {
    dispatch(fetchWallet());
  }, [dispatch]);

  // Pop animation on balance increase (settlement, funding, refund).
  useEffect(() => {
    if (balance > lastBalanceRef.current) {
      Animated.sequence([
        Animated.spring(popAnim, { toValue: 1.08, useNativeDriver: true, friction: 4 }),
        Animated.spring(popAnim, { toValue: 1, useNativeDriver: true, friction: 5 }),
      ]).start();
    }
    lastBalanceRef.current = balance;
  }, [balance, popAnim]);

  // If NUBAN isn't provisioned, retry on a timer until it is.
  useEffect(() => {
    if (accountNumber) return undefined;
    const id = setInterval(() => {
      dispatch(retryProvisioning());
    }, PROVISIONING_POLL_MS);
    return () => clearInterval(id);
  }, [accountNumber, dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await dispatch(fetchWallet()).unwrap?.().catch(() => {}); }
    finally { setRefreshing(false); }
  }, [dispatch]);

  const copyAccountNumber = () => {
    if (!accountNumber) return;
    try {
      Clipboard.setString(accountNumber);
      Toast.show({
        type: "success",
        text1: t("wallet.copied", "Account number copied"),
        text2: accountNumber,
      });
    } catch (_) {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 26, fontWeight: "800", color: tokens.text.primary,
            letterSpacing: -0.5, marginBottom: 16,
          }}
        >
          {t("wallet.title", "Wallet")}
        </Text>

        {/* Balance card */}
        <View
          style={{
            backgroundColor: tokens.brand.default,
            borderRadius: 18, padding: 22, marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 12, color: tokens.text.onBrand, opacity: 0.85, letterSpacing: 0.5, fontWeight: "700" }}>
            {t("wallet.availableBalance", "AVAILABLE BALANCE")}
          </Text>
          <Animated.Text
            accessibilityLiveRegion="polite"
            style={{
              fontSize: 38, fontWeight: "900", color: tokens.text.onBrand,
              letterSpacing: -1, marginTop: 8,
              transform: [{ scale: popAnim }],
            }}
          >
            {formatNaira(balance)}
          </Animated.Text>
          {isLocked ? (
            <View
              style={{
                marginTop: 10, alignSelf: "flex-start",
                backgroundColor: "rgba(255,255,255,0.18)",
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                flexDirection: "row", alignItems: "center",
              }}
            >
              <Ionicons name="lock-closed" size={12} color={tokens.text.onBrand} />
              <Text style={{ marginLeft: 6, fontSize: 11, fontWeight: "700", color: tokens.text.onBrand }}>
                {t("wallet.locked", "Wallet locked. Contact support")}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Virtual account */}
        {accountNumber ? (
          <TouchableOpacity
            onPress={copyAccountNumber}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.copyAria", "Copy account number {{number}}", { number: accountNumber })}
            style={{
              backgroundColor: tokens.bg.surface,
              borderRadius: 14, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: tokens.border.default,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Ionicons name="card-outline" size={16} color={tokens.brand.default} />
              <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "700", color: tokens.text.muted, letterSpacing: 0.5 }}>
                {t("wallet.fundByTransfer", "FUND BY BANK TRANSFER")}
              </Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: tokens.text.primary, letterSpacing: 2 }}>
              {accountNumber}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ fontSize: 13, color: tokens.text.muted }}>
                {bankName || "-"}{accountName ? ` · ${accountName}` : ""}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="copy-outline" size={14} color={tokens.brand.default} />
                <Text style={{ marginLeft: 4, fontSize: 12, color: tokens.brand.default, fontWeight: "700" }}>
                  {t("wallet.tapToCopy", "Tap to copy")}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <View
            style={{
              backgroundColor: tokens.bg.surface,
              borderRadius: 14, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: tokens.status.warningSoft,
              flexDirection: "row", alignItems: "center",
            }}
          >
            <Ionicons name="time-outline" size={22} color={tokens.status.warningStrong} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary }}>
                {t("wallet.provisioningTitle", "Setting up your account")}
              </Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                {t("wallet.provisioningSub", "Your virtual account is being created. This usually takes under a minute.")}
              </Text>
            </View>
            {provisioningInFlight ? (
              <ActivityIndicator size="small" color={tokens.brand.default} />
            ) : (
              <TouchableOpacity
                onPress={() => dispatch(retryProvisioning())}
                accessibilityRole="button"
                accessibilityLabel={t("wallet.retry", "Retry")}
                hitSlop={6}
              >
                <Ionicons name="refresh" size={20} color={tokens.brand.default} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <ActionTile
            tokens={tokens}
            icon="arrow-down"
            label={t("wallet.withdraw", "Withdraw")}
            onPress={() => navigation.navigate("Withdraw")}
          />
          <ActionTile
            tokens={tokens}
            icon="receipt-outline"
            label={t("wallet.transactions", "Transactions")}
            onPress={() => navigation.navigate("Transactions")}
          />
          <ActionTile
            tokens={tokens}
            icon="people-outline"
            label={t("wallet.beneficiariesCta", "Beneficiaries")}
            onPress={() => navigation.navigate("Beneficiaries")}
          />
        </View>

        {/* Pay bills - VTU from wallet balance */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: tokens.text.primary }}>
            {t("wallet.payBills", "Pay bills")}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("UtilityHistory")}
            accessibilityRole="button"
            accessibilityLabel={t("utility.history.title", "Bill history")}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.brand.default }}>
              {t("utility.history.title", "History")}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <ActionTile
            tokens={tokens}
            icon="phone-portrait-outline"
            label={t("utility.airtime", "Airtime")}
            onPress={() => navigation.navigate("Airtime")}
          />
          <ActionTile
            tokens={tokens}
            icon="wifi-outline"
            label={t("utility.data", "Data")}
            onPress={() => navigation.navigate("Data")}
          />
          <ActionTile
            tokens={tokens}
            icon="flash-outline"
            label={t("utility.electricity", "Electricity")}
            onPress={() => navigation.navigate("Electricity")}
          />
          <ActionTile
            tokens={tokens}
            icon="tv-outline"
            label={t("utility.cable", "Cable")}
            onPress={() => navigation.navigate("Cable")}
          />
        </View>

        <View
          style={{
            backgroundColor: tokens.brand.soft,
            borderRadius: 12, padding: 12,
            borderWidth: 1, borderColor: tokens.brand.softBorder,
            flexDirection: "row", alignItems: "flex-start",
          }}
        >
          <Ionicons name="information-circle" size={18} color={tokens.brand.strong} style={{ marginTop: 1 }} />
          <Text style={{ marginLeft: 8, flex: 1, fontSize: 12, color: tokens.text.primary, lineHeight: 17 }}>
            {t("wallet.tip", "Every completed delivery credits this wallet within a minute. Withdraw any time above the platform minimum.")}
          </Text>
        </View>

        {isLoading && !refreshing ? (
          <View style={{ alignItems: "center", marginTop: 16 }}>
            <ActivityIndicator color={tokens.brand.default} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionTile({ tokens, icon, label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        backgroundColor: tokens.bg.surface,
        borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: tokens.border.default,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: tokens.brand.soft,
          alignItems: "center", justifyContent: "center",
          marginBottom: 6,
        }}
      >
        <Ionicons name={icon} size={18} color={tokens.brand.strong} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: "700", color: tokens.text.primary, textAlign: "center" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
