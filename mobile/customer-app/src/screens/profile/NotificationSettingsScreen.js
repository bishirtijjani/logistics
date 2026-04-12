import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

const INITIAL_SETTINGS = {
  pushEnabled: true,
  orderUpdates: true,
  promotions: true,
  walletAlerts: true,
  emailEnabled: true,
  emailPromotions: false,
  smsEnabled: false,
};

export default function NotificationSettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(INITIAL_SETTINGS);

  const toggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    // TODO: Persist to backend
  };

  const renderToggle = (icon, label, sub, key, parentKey) => {
    const disabled = parentKey && !settings[parentKey];
    return (
      <View
        key={key}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name={icon} size={19} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: colors.text,
              marginBottom: 1,
            }}
          >
            {label}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{sub}</Text>
        </View>
        <Switch
          value={settings[key]}
          onValueChange={() => !disabled && toggle(key)}
          disabled={disabled}
          trackColor={{ false: colors.border, true: "#FDBA74" }}
          thumbColor={settings[key] ? colors.primary : "#f4f3f4"}
        />
      </View>
    );
  };

  const renderSection = (title, children) => (
    <View style={{ marginHorizontal: 20, marginTop: 24 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: colors.textMuted,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 10,
          marginLeft: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        {children}
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: colors.text,
            letterSpacing: -0.5,
          }}
        >
          Notifications
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {renderSection("Push Notifications", [
          renderToggle(
            "notifications-outline",
            "Push Notifications",
            "Enable push notifications on this device",
            "pushEnabled",
          ),
          <View
            key="separator-1"
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginHorizontal: 16,
            }}
          />,
          renderToggle(
            "bag-check-outline",
            "Order Updates",
            "Delivery status, rider assignment",
            "orderUpdates",
            "pushEnabled",
          ),
          <View
            key="separator-2"
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginHorizontal: 16,
            }}
          />,
          renderToggle(
            "megaphone-outline",
            "Promotions",
            "Deals, discounts, and offers",
            "promotions",
            "pushEnabled",
          ),
          <View
            key="separator-3"
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginHorizontal: 16,
            }}
          />,
          renderToggle(
            "wallet-outline",
            "Wallet Alerts",
            "Credits, debits, low balance",
            "walletAlerts",
            "pushEnabled",
          ),
        ])}

        {renderSection("Email", [
          renderToggle(
            "mail-outline",
            "Email Notifications",
            "Receipts, account alerts",
            "emailEnabled",
          ),
          <View
            key="separator-4"
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginHorizontal: 16,
            }}
          />,
          renderToggle(
            "pricetag-outline",
            "Email Promotions",
            "Marketing emails and newsletters",
            "emailPromotions",
            "emailEnabled",
          ),
        ])}

        {renderSection("SMS", [
          renderToggle(
            "chatbubble-outline",
            "SMS Notifications",
            "Text messages for critical alerts",
            "smsEnabled",
          ),
        ])}

        <Text
          style={{
            fontSize: 12,
            color: colors.textLight,
            textAlign: "center",
            marginTop: 20,
            marginHorizontal: 20,
            lineHeight: 18,
          }}
        >
          You will always receive critical security notifications regardless of
          your preferences.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
