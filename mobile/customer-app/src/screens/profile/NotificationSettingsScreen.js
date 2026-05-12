import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { colors } from "../../theme";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "../../store/slices/profileSlice";

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
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { notificationPreferences, isLoading, isUpdating, error } = useSelector(
    (state) => state.profile
  );
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    dispatch(fetchNotificationPreferences());
  }, [dispatch]);

  // Update local state when preferences load from backend
  useEffect(() => {
    if (notificationPreferences) {
      setSettings({
        pushEnabled: notificationPreferences.pushEnabled ?? true,
        orderUpdates: notificationPreferences.orderUpdates ?? true,
        promotions: notificationPreferences.promotions ?? true,
        walletAlerts: notificationPreferences.walletAlerts ?? true,
        emailEnabled: notificationPreferences.emailEnabled ?? true,
        emailPromotions: notificationPreferences.emailPromotions ?? false,
        smsEnabled: notificationPreferences.smsEnabled ?? false,
      });
    }
  }, [notificationPreferences]);

  // Handle errors
  useEffect(() => {
    if (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error,
      });
    }
  }, [error]);

  // Warn about unsaved changes when leaving
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!hasUnsavedChanges) return;

      e.preventDefault();
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Save before leaving?",
        [
          { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
          { text: "Save", onPress: () => handleSave(navigation.dispatch(e.data.action)) },
          { text: "Cancel", style: "cancel" },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges, settings]);

  const toggle = (key) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [key]: !prev[key] };
      setHasUnsavedChanges(true);
      return newSettings;
    });
  };

  const handleSave = useCallback(
    async (afterSaveCallback) => {
      const result = await dispatch(updateNotificationPreferences(settings));
      
      if (updateNotificationPreferences.fulfilled.match(result)) {
        setHasUnsavedChanges(false);
        Toast.show({
          type: "success",
          text1: "Saved",
          text2: "Notification preferences updated",
        });
        if (afterSaveCallback) afterSaveCallback();
      } else {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: result.payload || "Failed to save preferences",
        });
      }
    },
    [dispatch, settings]
  );

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
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t("a11y.back")}
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
            accessibilityRole="header"
            style={{
              fontSize: 20,
              fontWeight: "900",
              color: colors.text,
              letterSpacing: -0.5,
            }}
          >
            {t("notifications2.title")}
          </Text>
        </View>
        {isUpdating ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <TouchableOpacity
            onPress={() => handleSave()}
            disabled={!hasUnsavedChanges}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: hasUnsavedChanges ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: hasUnsavedChanges ? "#fff" : colors.textMuted,
              }}
            >
              Save
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading && (
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

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
