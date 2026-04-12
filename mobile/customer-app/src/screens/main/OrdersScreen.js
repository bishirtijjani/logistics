import React from "react";
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

export default function OrdersScreen() {
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
          style={{
            paddingHorizontal: 20,
            paddingTop: 22,
            paddingBottom: 16,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: colors.text,
              letterSpacing: -1,
            }}
          >
            My Orders
          </Text>
          <View
            style={{
              backgroundColor: colors.dark,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 0.5,
              }}
            >
              ACTIVE: 0
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: 20,
            marginBottom: 24,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 14,
            padding: 4,
          }}
        >
          {["Active", "Completed", "Cancelled"].map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 11,
                alignItems: "center",
                backgroundColor: i === 0 ? colors.dark : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: i === 0 ? colors.white : colors.textMuted,
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Empty State */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: colors.surface,
            borderRadius: 22,
            padding: 40,
            alignItems: "center",
            borderWidth: 1.5,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              backgroundColor: colors.surfaceMuted,
              borderRadius: 32,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
          </View>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "800",
              color: colors.text,
              marginBottom: 6,
            }}
          >
            No active orders
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.textMuted,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Place an order and track it here in real time.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 20,
              backgroundColor: colors.primary,
              paddingHorizontal: 28,
              paddingVertical: 13,
              borderRadius: 14,
            }}
          >
            <Text
              style={{ color: colors.white, fontWeight: "800", fontSize: 14 }}
            >
              Start an Order
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
