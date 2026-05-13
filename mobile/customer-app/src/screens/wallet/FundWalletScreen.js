import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Clipboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { colors } from "../../theme";
import { fetchWallet } from "../../store/slices/walletSlice";

export default function FundWalletScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { wallet, isLoading } = useSelector((state) => state.wallet);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dispatch(fetchWallet());
  }, [dispatch]);

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Steps live inside the component so the translations re-evaluate on locale
  // change without a stale closure.
  const steps = [
    { icon: "copy-outline", title: t("wallet.fund_.stepCopyTitle"), desc: t("wallet.fund_.stepCopyDesc") },
    { icon: "phone-portrait-outline", title: t("wallet.fund_.stepBankTitle"), desc: t("wallet.fund_.stepBankDesc") },
    { icon: "send-outline", title: t("wallet.fund_.stepTransferTitle"), desc: t("wallet.fund_.stepTransferDesc") },
    { icon: "checkmark-done-outline", title: t("wallet.fund_.stepDoneTitle"), desc: t("wallet.fund_.stepDoneDesc") },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginRight: 16 }}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>
            {t("wallet.fundTitle")}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      >
        {/* Virtual Account Card */}
        <View
          style={{
            backgroundColor: colors.dark,
            borderRadius: 24,
            padding: 24,
            marginTop: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 16,
              }}
            >
              <Ionicons name="card" size={24} color={colors.white} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.white }}>
                {t("wallet.fund_.vAccountTitle")}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                {t("wallet.fund_.vAccountSubtitle")}
              </Text>
            </View>
          </View>

          {/* Account Number */}
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
              {t("wallet.fund_.accountNumber")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  flex: 1,
                  fontSize: 28,
                  fontWeight: "900",
                  color: colors.white,
                  letterSpacing: 2,
                }}
                accessibilityLabel={`${t("wallet.fund_.accountNumber")} ${wallet?.accountNumber || ""}`}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : wallet?.accountNumber ? (
                  wallet.accountNumber
                ) : (
                  "------"
                )}
              </Text>
              <TouchableOpacity
                onPress={() => wallet?.accountNumber && copyToClipboard(wallet.accountNumber)}
                accessibilityRole="button"
                accessibilityLabel={copied ? t("wallet.fund_.copied") : t("wallet.fund_.copy")}
                accessibilityState={{ disabled: !wallet?.accountNumber }}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: colors.white, fontSize: 13, fontWeight: "700" }}>
                  {copied ? t("wallet.fund_.copied") : t("wallet.fund_.copy")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bank Name */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Ionicons name="business" size={20} color={colors.primary} />
            <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: "600", color: colors.white }}>
              {wallet?.bankName || t("wallet.fund_.fallbackBank")}
            </Text>
          </View>
        </View>

        {/* Instructions */}
        <Text
          accessibilityRole="header"
          style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 24, marginBottom: 16 }}
        >
          {t("wallet.fund_.howTo")}
        </Text>

        {steps.map((step, index) => (
          <View key={index} style={{ flexDirection: "row", marginBottom: 16 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary + "15",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 16,
              }}
            >
              <Ionicons name={step.icon} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                {index + 1}. {step.title}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{step.desc}</Text>
            </View>
          </View>
        ))}

        {/* Important Notice */}
        <View
          style={{
            backgroundColor: "#FFF7ED",
            borderRadius: 16,
            padding: 16,
            marginTop: 8,
            borderWidth: 1,
            borderColor: "#FED7AA",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Ionicons name="information-circle" size={20} color={colors.primary} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
                {t("wallet.fund_.importantTitle")}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 18 }}>
                {t("wallet.fund_.importantBody")}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
