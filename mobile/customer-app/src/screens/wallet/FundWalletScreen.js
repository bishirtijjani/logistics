import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Clipboard,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { colors } from "../../theme";
import { fetchWallet } from "../../store/slices/walletSlice";

export default function FundWalletScreen({ navigation }) {
  const dispatch = useDispatch();
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>Fund Wallet</Text>
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
                Your Virtual Account
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                Bank Transfer • Instant
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
              Account Number
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
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: colors.white, fontSize: 13, fontWeight: "700" }}>
                  {copied ? "Copied!" : "Copy"}
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
              {wallet?.bankName || "Wema Bank"}
            </Text>
          </View>
        </View>

        {/* Instructions */}
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 24, marginBottom: 16 }}>
          How to Fund
        </Text>

        {[
          { icon: "copy-outline", title: "Copy Account Number", desc: "Tap the Copy button above" },
          { icon: "phone-portrait-outline", title: "Open Your Bank App", desc: "Use any banking app or USSD" },
          { icon: "send-outline", title: "Transfer Money", desc: "Send any amount to the account number" },
          { icon: "checkmark-done-outline", title: "Wallet Updated", desc: "Funds appear instantly" },
        ].map((step, index) => (
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
                Important
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 18 }}>
                This is your personal virtual account. Only transfer from your own bank account.
                Third-party transfers may be flagged for review.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
