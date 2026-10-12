import React, { useCallback, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../store/slices/notificationsSlice";
import EmptyState from "../../components/EmptyState";
import ScreenHeader from "../../components/ScreenHeader";

const timeAgo = (iso) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

export default function NotificationsScreen() {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { list, isLoading, unreadCount } = useSelector((s) => s.notifications);

  const load = useCallback(() => {
    dispatch(fetchNotifications({ page: 1 }));
    dispatch(fetchUnreadCount());
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onPress = (n) => {
    if (!n.readAt) dispatch(markNotificationRead(n.id));

    // An order-scoped alert opens the native order detail directly.
    const requestId = n.requestId || n.data?.requestId;
    if (requestId) {
      navigation.navigate("OrderDetail", { requestId });
      return;
    }

    // Otherwise route by the server-supplied path. Merchant notifications
    // carry `data.route` (e.g. '/dashboard/orders', '/dashboard/support/...').
    const route = n.data?.route || n.route || "";
    if (/(support|ticket|dispute)/i.test(route)) {
      navigation.navigate("WebSection", {
        initialPath: route.startsWith("/") ? route : "/dashboard/support",
        title: t("merchant.sectionSupport", "Support"),
      });
      return;
    }
    if (/(menu|earnings|vtu|bills|analytics|marketing|settings)/i.test(route)) {
      const path = `/dashboard/${route.replace(/^\/?(dashboard\/)?/, "")}`;
      navigation.navigate("WebSection", { initialPath: path, title: t("merchant.moreTitle", "Manage") });
      return;
    }

    // New orders (and anything unrecognised) land on the native Orders tab.
    navigation.navigate("Orders");
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      <ScreenHeader
        title={t("tabs.notifications", "Alerts")}
        showBack
        showBell={false}
        right={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={() => dispatch(markAllNotificationsRead())} style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
              <Text style={{ color: tokens.brand.strong, fontWeight: "700", fontSize: 13 }}>
                {t("merchant.markAllRead", "Mark all read")}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {isLoading && list.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={tokens.brand.default} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor={tokens.brand.default} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onPress(item)}
              style={{
                backgroundColor: item.readAt ? tokens.bg.surface : tokens.brand.soft,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: item.readAt ? tokens.border.default : tokens.brand.softBorder,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                {!item.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.brand.default, marginRight: 8 }} /> : null}
                <Text style={{ fontWeight: "800", color: tokens.text.primary, flex: 1 }} numberOfLines={1}>
                  {item.title || "Notification"}
                </Text>
                <Text style={{ color: tokens.text.placeholder, fontSize: 11 }}>{timeAgo(item.createdAt)}</Text>
              </View>
              {item.body ? <Text style={{ color: tokens.text.muted, fontSize: 13 }} numberOfLines={2}>{item.body}</Text> : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title={t("merchant.noNotifications", "No notifications")}
              subtitle={t("merchant.noNotificationsSub", "Order updates and alerts will show here.")}
            />
          }
        />
      )}
    </View>
  );
}
