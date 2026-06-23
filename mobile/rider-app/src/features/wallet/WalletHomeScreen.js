import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { formatNaira } from "../../lib/formatters";
import { fetchWallet, retryProvisioning } from "../../store/slices/walletSlice";

const PROVISIONING_POLL_MS = 30_000;

// VTU services for the "Pay bills" section. `key` ties each row to the i18n
// catalog (utility.*) and to its `category.*` accent token (so the gradient
// chips re-tone in dark mode); `screen` is the navigation target. Airtime is
// promoted to a wide featured hero card, the rest sit in a 3-up grid below -
// mirroring the customer app's Bills & Utilities layout.
const VTU_SERVICES = [
  { key: "airtime", screen: "Airtime", icon: "phone-portrait-outline" },
  { key: "data", screen: "Data", icon: "wifi-outline" },
  { key: "electricity", screen: "Electricity", icon: "flash-outline" },
  { key: "cable", screen: "Cable", icon: "tv-outline" },
];

// Suffix a hex color with an alpha byte ("#EA580C" + "B3" -> "#EA580CB3").
// Falls back to the input when the color isn't a clean 6-hex.
const withAlpha = (hex, alpha) =>
  /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : hex;

// Resolve a VTU service's accent from its category token (reactive in dark mode).
const vtuColor = (item, tokens) =>
  tokens.category?.[item.key] || tokens.brand.default;

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
  // Legacy accounts created before phone became a signup requirement have no
  // phone on file, so provisioning can't proceed. We surface an "add phone"
  // CTA instead of looping the retry silently.
  const [needsPhone, setNeedsPhone] = useState(false);
  const popAnim = useRef(new Animated.Value(1)).current;
  const lastBalanceRef = useRef(balance);

  // Refetch on focus (covers initial mount + returning from phone capture) and
  // clear the CTA so a freshly added phone lets provisioning resume.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchWallet());
      setNeedsPhone(false);
    }, [dispatch]),
  );

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

  // Retry provisioning; route legacy phone-less accounts to capture a phone,
  // and pull the wallet on success so the NUBAN appears as soon as it's minted.
  const runProvisionRetry = useCallback(async () => {
    const res = await dispatch(retryProvisioning());
    if (retryProvisioning.rejected.match(res)) {
      if (res.payload?.code === "PHONE_REQUIRED") setNeedsPhone(true);
      return;
    }
    setNeedsPhone(false);
    dispatch(fetchWallet());
  }, [dispatch]);

  // While the NUBAN isn't provisioned (and a phone is on file), retry on a timer.
  useEffect(() => {
    if (accountNumber || needsPhone) return undefined;
    runProvisionRetry();
    const id = setInterval(runProvisionRetry, PROVISIONING_POLL_MS);
    return () => clearInterval(id);
  }, [accountNumber, needsPhone, runProvisionRetry]);

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
        ) : needsPhone ? (
          <TouchableOpacity
            onPress={() => navigation.navigate("PhoneCapture")}
            accessibilityRole="button"
            accessibilityLabel={t("wallet.addPhoneTitle", "Add your phone number")}
            style={{
              backgroundColor: tokens.bg.surface,
              borderRadius: 14, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: tokens.status.warningSoft,
              flexDirection: "row", alignItems: "center",
            }}
          >
            <Ionicons name="call-outline" size={22} color={tokens.status.warningStrong} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: tokens.text.primary }}>
                {t("wallet.addPhoneTitle", "Add your phone number")}
              </Text>
              <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                {t("wallet.addPhonePrompt", "We need your phone number to create your wallet account.")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={tokens.brand.default} />
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
                onPress={runProvisionRetry}
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

        {/* Pay bills - VTU from wallet balance. Bento layout mirroring the
            customer app: Airtime promotes to a wide featured hero card, while
            Data / Electricity / Cable sit below in a 3-up grid. Each chip is a
            per-service gradient with a 1px specular highlight so the row reads
            as distinct services instead of one monolithic orange block. */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: tokens.text.primary, letterSpacing: -0.3 }}>
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

        {(() => {
          const [hero, ...rest] = VTU_SERVICES;
          const heroColor = vtuColor(hero, tokens);
          const heroLabel = t(`utility.${hero.key}`, hero.key);
          return (
            <View style={{ marginBottom: 16 }}>
              {/* Hero - Airtime: faint color wash bleeds from the icon side for
                  a soft branded glow without overpowering the white surface. */}
              <TouchableOpacity
                onPress={() => navigation.navigate(hero.screen)}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={heroLabel}
                style={{
                  backgroundColor: tokens.bg.surface,
                  borderRadius: 22, padding: 16,
                  flexDirection: "row", alignItems: "center",
                  borderWidth: 1, borderColor: tokens.border.default,
                  shadowColor: heroColor, shadowOpacity: 0.14,
                  shadowOffset: { width: 0, height: 10 }, shadowRadius: 20,
                  elevation: 4, marginBottom: 12, overflow: "hidden",
                  ...(Platform.OS === "ios" && { borderCurve: "continuous" }),
                }}
              >
                <LinearGradient
                  colors={[withAlpha(heroColor, "1A"), "transparent"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0.8 }}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <View style={{ width: 60, height: 60, borderRadius: 18, overflow: "hidden", marginRight: 14 }}>
                  <LinearGradient
                    colors={[heroColor, withAlpha(heroColor, "B3")]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name={hero.icon} size={28} color={tokens.text.onBrand} />
                  </LinearGradient>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: heroColor, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 2 }}>
                    {t("home.billsHero.tag", "Top up")}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "900", color: tokens.text.primary, letterSpacing: -0.5 }}>
                    {heroLabel}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                    {t("home.billsHero.blurb", "Recharge any network instantly")}
                  </Text>
                </View>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: heroColor, alignItems: "center", justifyContent: "center", marginLeft: 8 }}>
                  <Ionicons name="arrow-forward" size={16} color={tokens.text.onBrand} />
                </View>
              </TouchableOpacity>

              {/* Rest - 3-up grid. `marginHorizontal: -5` + per-cell padding
                  yields even gutters without growing the section's padding. */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, rowGap: 10 }}>
                {rest.map((item) => {
                  const color = vtuColor(item, tokens);
                  const label = t(`utility.${item.key}`, item.key);
                  return (
                    <View key={item.key} style={{ width: "33.333%", paddingHorizontal: 5 }}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate(item.screen)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={label}
                        style={{
                          backgroundColor: tokens.bg.surface,
                          borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8,
                          alignItems: "center",
                          borderWidth: 1, borderColor: tokens.border.default,
                          shadowColor: "#09090b", shadowOpacity: 0.06,
                          shadowOffset: { width: 0, height: 6 }, shadowRadius: 16,
                          elevation: 3,
                          ...(Platform.OS === "ios" && { borderCurve: "continuous" }),
                        }}
                      >
                        <View style={{ width: 48, height: 48, borderRadius: 15, overflow: "hidden", marginBottom: 9 }}>
                          <LinearGradient
                            colors={[color, withAlpha(color, "B3")]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                          >
                            <Ionicons name={item.icon} size={24} color={tokens.text.onBrand} />
                          </LinearGradient>
                          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.45)" }} />
                        </View>
                        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: tokens.text.primary, textAlign: "center", letterSpacing: -0.2 }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}

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
