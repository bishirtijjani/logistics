import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { logout } from "../../store/slices/authSlice";
import { fetchProfile } from "../../store/slices/profileSlice";
import { colors } from "../../theme";

const KYC_BADGE = {
  NONE: { label: "Not Verified", color: "#6B7280", bg: "#F3F4F6" },
  PENDING: { label: "Pending", color: "#D97706", bg: "#FEF3C7" },
  VERIFIED: { label: "Verified", color: "#059669", bg: "#D1FAE5" },
  FAILED: { label: "Failed", color: "#EF4444", bg: "#FEE2E2" },
};

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { profile, isLoading } = useSelector((state) => state.profile);

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  const p = profile || user || {};
  const kyc = KYC_BADGE[p.kycStatus] || KYC_BADGE.NONE;
  const initials = (p.firstName?.[0] || "") + (p.lastName?.[0] || "");

  const accountItems = [
    {
      icon: "person-outline",
      label: "Personal Information",
      sub: "Name, email, phone, address",
      screen: "EditProfile",
    },
    {
      icon: "image-outline",
      label: "Profile Photo",
      sub: p.profilePicture ? "Change photo" : "Add a photo",
      screen: "ProfilePhoto",
    },
  ];

  const verificationItems = [
    {
      icon: "shield-checkmark-outline",
      label: "Identity Verification (KYC)",
      sub: kyc.label,
      badgeColor: kyc.color,
      badgeBg: kyc.bg,
      screen: "BvnVerification",
      disabled: p.kycStatus === "VERIFIED",
    },
    {
      icon: "keypad-outline",
      label: "Transaction PIN",
      sub: p.hasPinSet ? "Change your PIN" : "Set up your PIN",
      screen: p.hasPinSet ? "ChangePin" : "SetPin",
    },
  ];

  const settingsItems = [
    {
      icon: "lock-closed-outline",
      label: "Security",
      sub: "Password, sessions",
      screen: "SecuritySettings",
    },
    {
      icon: "notifications-outline",
      label: "Notifications",
      sub: "Push, email, SMS",
      screen: "NotificationSettings",
    },
    {
      icon: "location-outline",
      label: "Saved Addresses",
      sub: "Home, work, favourites",
      screen: "SavedAddresses",
    },
  ];

  const supportItems = [
    {
      icon: "help-circle-outline",
      label: "Help & Support",
      sub: "FAQ, contact us",
      screen: "HelpSupport",
    },
    {
      icon: "document-text-outline",
      label: "Legal",
      sub: "Terms, privacy policy",
      screen: "Legal",
    },
    {
      icon: "information-circle-outline",
      label: "About",
      sub: "Version 1.0.0",
      screen: "About",
    },
  ];

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
        {items.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => {
              if (!item.disabled && item.screen) {
                navigation.navigate(item.screen);
              }
            }}
            activeOpacity={item.disabled ? 1 : 0.6}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: index < items.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
              opacity: item.disabled ? 0.5 : 1,
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
              <Ionicons name={item.icon} size={19} color={colors.text} />
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
                {item.label}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {item.sub}
              </Text>
            </View>
            {item.badgeColor ? (
              <View
                style={{
                  backgroundColor: item.badgeBg,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: item.badgeColor,
                  }}
                >
                  {item.sub}
                </Text>
              </View>
            ) : null}
            <Ionicons
              name="chevron-forward"
              size={17}
              color={colors.textLight}
            />
          </TouchableOpacity>
        ))}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Header */}
        <View
          style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 4 }}
        >
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: colors.text,
              letterSpacing: -1,
              marginBottom: 20,
            }}
          >
            Profile
          </Text>

          {/* Avatar Card */}
          <TouchableOpacity
            onPress={() => navigation.navigate("EditProfile")}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.dark,
              borderRadius: 20,
              padding: 18,
            }}
          >
            {p.profilePicture ? (
              <Image
                source={{ uri: p.profilePicture }}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  marginRight: 16,
                  borderWidth: 2,
                  borderColor: colors.primary,
                }}
              />
            ) : (
              <View
                style={{
                  width: 58,
                  height: 58,
                  backgroundColor: colors.primary,
                  borderRadius: 29,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 16,
                }}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontSize: 22,
                    fontWeight: "900",
                  }}
                >
                  {initials.toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.white,
                  fontSize: 18,
                  fontWeight: "800",
                  marginBottom: 2,
                }}
              >
                {p.firstName} {p.lastName}
              </Text>
              <Text
                style={{ color: colors.textMuted, fontSize: 13 }}
                numberOfLines={1}
              >
                {p.email}
              </Text>
              {p.phone ? (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {p.phone}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <View
                style={{
                  backgroundColor: kyc.bg,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 8,
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: kyc.color,
                  }}
                >
                  {kyc.label}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </View>
          </TouchableOpacity>

          {/* KYC Prompt Banner */}
          {p.kycStatus !== "VERIFIED" && (
            <TouchableOpacity
              onPress={() => navigation.navigate("BvnVerification")}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#FFF7ED",
                borderRadius: 14,
                padding: 14,
                marginTop: 14,
                borderWidth: 1,
                borderColor: "#FED7AA",
              }}
            >
              <Ionicons
                name="alert-circle"
                size={22}
                color={colors.primary}
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: colors.text,
                    marginBottom: 1,
                  }}
                >
                  Complete your verification
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Verify your BVN to unlock full features
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* PIN Prompt Banner */}
          {!p.hasPinSet && (
            <TouchableOpacity
              onPress={() => navigation.navigate("SetPin")}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#EFF6FF",
                borderRadius: 14,
                padding: 14,
                marginTop: 10,
                borderWidth: 1,
                borderColor: "#BFDBFE",
              }}
            >
              <Ionicons
                name="keypad"
                size={22}
                color="#2563EB"
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: colors.text,
                    marginBottom: 1,
                  }}
                >
                  Set your transaction PIN
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Required for payments and transfers
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#2563EB" />
            </TouchableOpacity>
          )}
        </View>

        {renderSection("Account", accountItems)}
        {renderSection("Verification", verificationItems)}
        {renderSection("Settings", settingsItems)}
        {renderSection("Support", supportItems)}

        {/* Logout */}
        <View style={{ marginHorizontal: 20, marginTop: 28, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => dispatch(logout())}
            style={{
              backgroundColor: "#FEE2E2",
              paddingVertical: 16,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: "#FECACA",
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text
              style={{
                color: colors.error,
                fontWeight: "800",
                fontSize: 15,
                marginLeft: 8,
              }}
            >
              Log Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <Text
          style={{
            textAlign: "center",
            color: colors.textLight,
            fontSize: 12,
            marginTop: 12,
          }}
        >
          Version 1.0.0
        </Text>
      </ScrollView>

      {isLoading && (
        <View
          style={{
            position: "absolute",
            top: 60,
            alignSelf: "center",
          }}
        >
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}
