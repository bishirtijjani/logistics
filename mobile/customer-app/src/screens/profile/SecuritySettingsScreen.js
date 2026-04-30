import React, { useState } from "react";
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
import Toast from "react-native-toast-message";
import { logout } from "../../store/slices/authSlice";
import { deleteAccount } from "../../store/slices/profileSlice";
import { colors } from "../../theme";

export default function SecuritySettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.profile);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChangePassword = () => {
    navigation.navigate("ForgotPassword");
  };

  const handleChangePin = () => {
    navigation.navigate("ChangePin");
  };

  const handleLogoutAllDevices = () => {
    Alert.alert(
      "Log Out All Devices",
      "This will sign you out of all active sessions. You will need to log in again on each device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out All",
          style: "destructive",
          onPress: () => dispatch(logout()),
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. All your data will be deleted.\n\n• Complete all active deliveries first\n• Withdraw your wallet balance\n• This cannot be reversed",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const result = await dispatch(deleteAccount());
            setDeleting(false);
            
            if (deleteAccount.fulfilled.match(result)) {
              Toast.show({
                type: "success",
                text1: "Account Deleted",
                text2: "Your account has been permanently deleted",
              });
              // Logout and navigate to login
              dispatch(logout());
            } else {
              Toast.show({
                type: "error",
                text1: "Cannot Delete Account",
                text2: result.payload || "Please complete deliveries and withdraw balance first",
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
      label: "Change Password",
      sub: "Update your login password",
      onPress: handleChangePassword,
    },
    {
      icon: "keypad-outline",
      label: "Change Transaction PIN",
      sub: "Update your 6-digit PIN",
      onPress: handleChangePin,
    },
  ];

  const sessionItems = [
    {
      icon: "phone-portrait-outline",
      label: "Active Sessions",
      sub: "View devices logged into your account",
      onPress: () => {},
    },
    {
      icon: "exit-outline",
      label: "Log Out All Devices",
      sub: "Sign out everywhere except here",
      onPress: handleLogoutAllDevices,
      danger: true,
    },
  ];

  const renderItem = (item, index, total) => (
    <TouchableOpacity
      key={item.label}
      onPress={item.onPress}
      activeOpacity={0.6}
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
          Security
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {renderSection("Authentication", securityItems)}

        {/* Biometric Toggle */}
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
            Biometrics
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
                Use fingerprint or Face ID to sign in
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
              trackColor={{ false: colors.border, true: "#FDBA74" }}
              thumbColor={biometricEnabled ? colors.primary : "#f4f3f4"}
            />
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
