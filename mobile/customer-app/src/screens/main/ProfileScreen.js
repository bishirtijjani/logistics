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
import { colors } from "../../theme";

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const menuItems = [
    { icon: "person-outline", label: "Personal Information" },
    { icon: "location-outline", label: "Saved Addresses" },
    { icon: "notifications-outline", label: "Notifications" },
    { icon: "shield-checkmark-outline", label: "Security" },
    { icon: "help-circle-outline", label: "Help & Support" },
  ];

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
              backgroundColor: colors.dark,
              borderRadius: 20,
              padding: 18,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                backgroundColor: colors.primary,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 16,
              }}
            >
              <Text
                style={{ color: colors.white, fontSize: 22, fontWeight: "900" }}
              >
                {user?.firstName?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.white,
                  fontSize: 17,
                  fontWeight: "800",
                  marginBottom: 2,
                }}
              >
                {user?.firstName} {user?.lastName}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
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
              <Ionicons name="create-outline" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu */}
        <View style={{ marginHorizontal: 20, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 19,
              fontWeight: "900",
              color: colors.text,
              letterSpacing: -0.5,
              marginBottom: 14,
            }}
          >
            Settings
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
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                  borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
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
                  <Ionicons name={item.icon} size={20} color={colors.text} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.text,
                  }}
                >
                  {item.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
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
      </ScrollView>
    </SafeAreaView>
  );
}
