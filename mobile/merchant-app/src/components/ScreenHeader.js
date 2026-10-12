import React, { useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTheme } from "../theme";
import { fetchUnreadCount } from "../store/slices/notificationsSlice";

/**
 * Shared top bar for every native page: title, an optional back chevron, the
 * notification bell (with unread badge) and the light/dark toggle. Keeps the
 * native chrome identical across pages so the app reads as one surface.
 */
export default function ScreenHeader({ title, showBack = false, showBell = true, right }) {
  const { tokens, isDark, setMode } = useTheme();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const unreadCount = useSelector((s) => s.notifications.unreadCount);

  useFocusEffect(
    useCallback(() => {
      if (showBell) dispatch(fetchUnreadCount());
    }, [dispatch, showBell]),
  );

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 8,
        gap: 4,
      }}
    >
      {showBack ? (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={{ padding: 6, marginLeft: -6 }}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={tokens.text.primary} />
        </TouchableOpacity>
      ) : null}

      <Text
        numberOfLines={1}
        style={{ flex: 1, fontSize: 22, fontWeight: "900", color: tokens.text.primary, marginLeft: showBack ? 2 : 0 }}
      >
        {title}
      </Text>

      {right}

      {showBell ? (
        <TouchableOpacity
          onPress={() => navigation.navigate("Notifications")}
          hitSlop={8}
          style={{ padding: 8 }}
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={tokens.text.muted} />
          {unreadCount > 0 ? (
            <View
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                paddingHorizontal: 4,
                backgroundColor: tokens.status.error,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={() => setMode(isDark ? "light" : "dark")}
        hitSlop={8}
        style={{ padding: 8 }}
        accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={22} color={tokens.text.muted} />
      </TouchableOpacity>
    </View>
  );
}
