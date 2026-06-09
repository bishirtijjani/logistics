import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { logout } from "../../store/slices/authSlice";
import { useTheme } from "../../theme";

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { tokens, isDark } = useTheme();

  const menuItems = [
    { icon: "person-outline", label: "Personal Information" },
    { icon: "location-outline", label: "Saved Addresses" },
    { icon: "notifications-outline", label: "Notifications" },
    { icon: "shield-checkmark-outline", label: "Security" },
    { icon: "help-circle-outline", label: "Help & Support" },
  ];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.bg.canvas }}
      edges={["top"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={tokens.bg.canvas}
      />
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

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
              color: tokens.text.primary,
              letterSpacing: -1,
              marginBottom: 24,
            }}
          >
            Profile
          </Text>

          {/* Avatar + Name */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: tokens.bg.elevated,
              borderRadius: 20,
              padding: 18,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                backgroundColor: tokens.brand.default,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 16,
              }}
            >
              <Text
                style={{ color: tokens.text.onElevated, fontSize: 22, fontWeight: "900" }}
              >
                {user?.firstName?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: tokens.text.onElevated,
                  fontSize: 17,
                  fontWeight: "800",
                  marginBottom: 2,
                }}
              >
                {user?.firstName} {user?.lastName}
              </Text>
              <Text style={{ color: tokens.text.muted, fontSize: 13 }}>
                {user?.email}
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: "#ffffff15",
                padding: 10,
                borderRadius: 12,
              }}
            >
              <Ionicons name="create-outline" size={18} color={tokens.text.onElevated} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu */}
        <View style={{ marginHorizontal: 20, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 19,
              fontWeight: "900",
              color: tokens.text.primary,
              letterSpacing: -0.5,
              marginBottom: 14,
            }}
          >
            Settings
          </Text>
          <View
            style={{
              backgroundColor: tokens.bg.surface,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: tokens.border.default,
              overflow: "hidden",
            }}
          >
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
                  borderBottomColor: tokens.border.default,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    backgroundColor: tokens.bg.surfaceMuted,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Ionicons name={item.icon} size={20} color={tokens.text.primary} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: "600",
                    color: tokens.text.primary,
                  }}
                >
                  {item.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={tokens.text.muted}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout */}
        <View style={{ marginHorizontal: 20, marginTop: 24 }}>
          <TouchableOpacity
            onPress={() => dispatch(logout())}
            style={{
              backgroundColor: tokens.status.errorSoft,
              paddingVertical: 16,
              borderRadius: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: tokens.status.errorSoftBorder,
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={tokens.status.error} />
            <Text
              style={{
                color: tokens.status.error,
                fontWeight: "800",
                fontSize: 15,
                marginLeft: 8,
              }}
            >
              Log Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
