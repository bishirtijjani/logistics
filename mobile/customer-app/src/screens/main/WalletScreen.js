import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { fetchWallet } from "../../store/slices/walletSlice";
import { colors } from "../../theme";
import Toast from "react-native-toast-message";

function formatNaira(amount) {
  return (
    "\u20A6" +
    Number(amount).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export default function WalletScreen({ navigation }) {
  const dispatch = useDispatch();
  const { balance, isLoading } = useSelector((state) => state.wallet);
  const [showBalance, setShowBalance] = useState(true);

  useEffect(() => {
    dispatch(fetchWallet());
  }, [dispatch]);

  // Transactions will be populated from API - placeholder for now
  const transactions = [];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Header */}
        <View
          style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: colors.text,
              letterSpacing: -1,
              marginBottom: 18,
            }}
          >
            Wallet
          </Text>

          {/* Balance Card */}
          <View
            style={{
              backgroundColor: colors.dark,
              borderRadius: 22,
              padding: 24,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 36,
                width: 4,
                height: "100%",
                backgroundColor: colors.primary,
              }}
            />
            <View
              style={{
                position: "absolute",
                top: -40,
                left: -40,
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: "#ffffff05",
              }}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1.6,
                  textTransform: "uppercase",
                }}
              >
                Available Balance
              </Text>
              <TouchableOpacity onPress={() => setShowBalance(!showBalance)}>
                <Ionicons
                  name={showBalance ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            <Text
              style={{
                color: colors.white,
                fontSize: 40,
                fontWeight: "900",
                letterSpacing: -2,
                marginBottom: 24,
              }}
            >
              {showBalance
                ? formatNaira(balance)
                : "\u20A6 \u2022\u2022\u2022\u2022"}
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate("FundWallet")}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  paddingVertical: 13,
                  borderRadius: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="add" size={18} color={colors.white} />
                <Text
                  style={{
                    color: colors.white,
                    fontWeight: "800",
                    fontSize: 14,
                    marginLeft: 6,
                  }}
                >
                  Fund
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Toast.show({ type: "info", text1: "Coming Soon", text2: "P2P transfers will be available soon!" })}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  paddingVertical: 13,
                  borderRadius: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="send" size={18} color={colors.text} />
                <Text style={{ marginLeft: 6, color: colors.text, fontWeight: "700" }}>
                  Send
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "#ffffff12",
                  paddingVertical: 13,
                  borderRadius: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "#ffffff10",
                }}
              >
                <Ionicons name="arrow-down" size={18} color={colors.white} />
                <Text
                  style={{
                    color: colors.white,
                    fontWeight: "800",
                    fontSize: 14,
                    marginLeft: 6,
                  }}
                >
                  Withdraw
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Transactions */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 19,
                fontWeight: "900",
                color: colors.text,
                letterSpacing: -0.5,
              }}
            >
              Transactions
            </Text>
            <View
              style={{
                width: 30,
                height: 3.5,
                backgroundColor: colors.primary,
                borderRadius: 2,
              }}
            />
          </View>

          {transactions.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 18,
                padding: 36,
                alignItems: "center",
                borderWidth: 1.5,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 28,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Ionicons
                  name="receipt-outline"
                  size={24}
                  color={colors.textMuted}
                />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                No transactions yet
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  textAlign: "center",
                }}
              >
                Fund your wallet to get started.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
