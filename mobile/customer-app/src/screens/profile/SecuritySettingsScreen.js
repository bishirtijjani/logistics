import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { logout } from "../../store/slices/authSlice";
import { deleteAccount } from "../../store/slices/profileSlice";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled as persistBiometricEnabled,
  authenticateWithBiometric,
} from "../../services/biometric";
import { colors } from "../../theme";

export default function SecuritySettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { isLoading } = useSelector((state) => state.profile);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Hydrate the toggle from device hardware + persisted preference.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [available, enabled] = await Promise.all([
        isBiometricAvailable(),
        isBiometricEnabled(),
      ]);
      if (cancelled) return;
      setBiometricAvailable(available);
      // If the user disabled biometrics on the OS after enabling in-app, fall
      // back to disabled so the toggle reflects reality.
      setBiometricEnabled(available && enabled);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBiometricToggle = async (next) => {
    if (biometricBusy) return;
    if (next && !biometricAvailable) {
      Toast.show({
        type: "error",
        text1: t("security.biometricUnavailable"),
        text2: t("security.biometricUnavailableSub"),
      });
      return;
    }
    setBiometricBusy(true);
    try {
      const ok = await authenticateWithBiometric(
        next ? t("security.biometricEnablePrompt") : t("security.biometricDisablePrompt"),
      );
      if (!ok) return;

      await persistBiometricEnabled(next);
      setBiometricEnabled(next);
      Toast.show({
        type: "success",
        text1: next ? t("security.biometricEnabled") : t("security.biometricDisabled"),
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("security.biometricUpdateFailed"),
        text2: err?.message || t("common.retry"),
      });
    } finally {
      setBiometricBusy(false);
    }
  };

  const handleChangePassword = () => {
    navigation.navigate("ForgotPassword");
  };

  const handleChangePin = () => {
    navigation.navigate("ChangePin");
  };

  const handleLogoutAllDevices = () => {
    Alert.alert(
      t("security.logoutAllTitle"),
      t("security.logoutAllBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("security.logoutAllCta"),
          style: "destructive",
          onPress: () => dispatch(logout()),
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("security.deleteAccountTitle"),
      t("security.deleteAccountBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("security.deleteAccountCta"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const result = await dispatch(deleteAccount());
            setDeleting(false);

            if (deleteAccount.fulfilled.match(result)) {
              Toast.show({
                type: "success",
                text1: t("security.deleteSuccess"),
                text2: t("security.deleteSuccessSub"),
              });
              dispatch(logout());
            } else {
              Toast.show({
                type: "error",
                text1: t("security.deleteFailed"),
                text2: result.payload || t("security.deleteFailedSub"),
              });
            }
          },
        },
      ],
    );
  };

  const securityItems = [
    {
      icon: "key-outline",
      label: t("security.password"),
      sub: t("security.passwordSub"),
      onPress: handleChangePassword,
    },
    {
      icon: "keypad-outline",
      label: t("security.pin"),
      sub: t("security.pinSub"),
      onPress: handleChangePin,
    },
    {
      icon: "call-outline",
      label: t("security.phone"),
      sub: t("security.phoneSub"),
      onPress: () => navigation.navigate("PhoneChange"),
    },
  ];

  const sessionItems = [
    {
      icon: "phone-portrait-outline",
      label: t("security.sessions"),
      sub: t("security.sessionsSub"),
      onPress: () => navigation.navigate("Sessions"),
    },
    {
      icon: "exit-outline",
      label: t("security.logoutAll"),
      sub: t("security.logoutAllSub"),
      onPress: handleLogoutAllDevices,
      danger: true,
    },
  ];

  const renderItem = (item, index, total) => (
    <TouchableOpacity
      key={item.label}
      onPress={item.onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityHint={item.sub}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: index < total - 1 ? 1 : 0,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          backgroundColor: item.danger ? "#FEE2E2" : colors.surfaceMuted,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        }}
      >
        <Ionicons
          name={item.icon}
          size={19}
          color={item.danger ? colors.error : colors.text}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: "600",
            color: item.danger ? colors.error : colors.text,
            marginBottom: 1,
          }}
        >
          {item.label}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          {item.sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.textLight} />
    </TouchableOpacity>
  );

  const renderSection = (title, items) => (
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
        {items.map((item, index) => renderItem(item, index, items.length))}
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
          {t("security.title")}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {renderSection(t("security.sectionAuth"), securityItems)}

        {/* Biometric Toggle */}
        <View style={{ marginHorizontal: 20, marginTop: 24 }}>
          <Text
            accessibilityRole="header"
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
            {t("security.sectionBiometrics")}
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 14,
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
              <Ionicons
                name="finger-print-outline"
                size={19}
                color={colors.text}
              />
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
                Biometric Login
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {biometricAvailable
                  ? "Use fingerprint or Face ID to sign in"
                  : "No biometrics enrolled on this device"}
              </Text>
            </View>
            {biometricBusy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricAvailable}
                trackColor={{ false: colors.border, true: "#FDBA74" }}
                thumbColor={biometricEnabled ? colors.primary : "#f4f3f4"}
              />
            )}
          </View>
        </View>

        {renderSection("Sessions", sessionItems)}

        {/* Danger Zone */}
        <View style={{ marginHorizontal: 20, marginTop: 32 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: colors.error,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 10,
              marginLeft: 4,
            }}
          >
            Danger Zone
          </Text>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            activeOpacity={0.6}
            style={{
              backgroundColor: "#FEE2E2",
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: "#FECACA",
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                backgroundColor: "#FEE2E2",
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
              }}
            >
              <Ionicons name="trash-outline" size={19} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.error,
                  marginBottom: 1,
                }}
              >
                Delete Account
              </Text>
              <Text style={{ fontSize: 12, color: "#F87171" }}>
                Permanently delete your account and data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.error} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
