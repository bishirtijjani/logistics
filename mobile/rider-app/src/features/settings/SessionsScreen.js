/**
 * SessionsScreen - list active sessions, revoke individual devices,
 * "Sign out all other devices" CTA.
 */

import React, { useCallback, useEffect, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import api from "../../services/api";
import { useTheme } from "../../theme";

export default function SessionsScreen() {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revoking, setRevoking] = useState(null);

  const formatDate = (d) => {
    if (!d) return "-";
    const tag = i18n.language === "ha" ? "ha-NG" : "en-NG";
    return new Date(d).toLocaleString(tag, {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const load = useCallback(async () => {
    try {
      const res = await api.get("/auth/sessions");
      setSessions(res?.data ?? []);
    } catch (_) {
      Toast.show({ type: "error", text1: t("sessions.loadFailed", "Couldn't load sessions") });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const revokeOne = (sessionId) => {
    Alert.alert(
      t("sessions.confirmSignOutTitle", "Sign out this device?"),
      t("sessions.confirmSignOutBody", "You can sign back in any time."),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("sessions.signOut", "Sign out"),
          style: "destructive",
          onPress: async () => {
            try {
              setRevoking(sessionId);
              await api.delete(`/auth/sessions/${sessionId}`);
              setSessions((prev) => prev.filter((s) => s.id !== sessionId));
              Toast.show({ type: "success", text1: t("sessions.signedOut", "Signed out") });
            } catch (_) {
              Toast.show({ type: "error", text1: t("sessions.revokeFailed", "Failed to revoke session") });
            } finally {
              setRevoking(null);
            }
          },
        },
      ],
    );
  };

  const revokeOthers = () => {
    Alert.alert(
      t("sessions.confirmAllTitle", "Sign out other devices?"),
      t("sessions.confirmAllBody", "You'll stay signed in here. All other devices will need to log in again."),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("sessions.signOutOthers", "Sign out other devices"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/auth/sessions/others");
              await load();
              Toast.show({ type: "success", text1: t("sessions.othersSignedOut", "Other sessions revoked") });
            } catch (_) {
              Toast.show({ type: "error", text1: t("sessions.revokeFailed", "Failed to revoke sessions") });
            }
          },
        },
      ],
    );
  };

  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 14, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <TouchableOpacity onPress={() => goBackOr(navigation)} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ marginLeft: 10, fontSize: 17, fontWeight: "800", color: tokens.text.primary }}>
          {t("sessions.title", "Active Sessions")}
        </Text>
      </View>

      {otherCount > 0 && (
        <TouchableOpacity
          onPress={revokeOthers}
          style={{
            marginHorizontal: 14, marginTop: 12,
            backgroundColor: tokens.status.errorSoft,
            borderRadius: 12, padding: 12,
            flexDirection: "row", alignItems: "center", gap: 8,
          }}
        >
          <Ionicons name="log-out-outline" size={18} color={tokens.status.errorStrong} />
          <Text style={{ color: tokens.status.errorStrong, fontWeight: "700", fontSize: 13 }}>
            {t("sessions.signOutAllCta", "Sign out from all other devices")}
          </Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color={tokens.brand.default} style={{ marginTop: 40 }} />
      ) : sessions.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: tokens.text.muted }}>{t("sessions.noOther", "No other devices are signed in.")}</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand.default} />
          }
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: tokens.bg.surface,
                borderRadius: 14, padding: 14, marginBottom: 10,
                borderWidth: item.isCurrent ? 1.5 : 1,
                borderColor: item.isCurrent ? tokens.brand.default : tokens.border.default,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 42, height: 42, borderRadius: 21,
                    backgroundColor: item.isCurrent ? tokens.brand.soft : tokens.bg.surfaceMuted,
                    alignItems: "center", justifyContent: "center", marginRight: 12,
                  }}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={20}
                    color={item.isCurrent ? tokens.brand.default : tokens.text.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>
                      {item.deviceName || item.userAgent?.split(" ")[0] || t("sessions.unknownDevice", "Unknown device")}
                    </Text>
                    {item.isCurrent && (
                      <View style={{ marginLeft: 8, backgroundColor: tokens.brand.soft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: tokens.brand.strong }}>
                          {t("sessions.thisDevice", "THIS DEVICE")}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.deviceModel ? (
                    <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>{item.deviceModel}</Text>
                  ) : null}
                  <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>
                    {t("sessions.lastUsed", "Last used {{when}}", { when: formatDate(item.lastUsedAt || item.createdAt) })}
                  </Text>
                  {item.ipAddress ? (
                    <Text style={{ fontSize: 11, color: tokens.text.muted }}>{item.ipAddress}</Text>
                  ) : null}
                </View>
                {!item.isCurrent && (
                  <TouchableOpacity
                    onPress={() => revokeOne(item.id)}
                    disabled={revoking === item.id}
                    style={{ padding: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("sessions.signOut", "Sign out")}
                  >
                    {revoking === item.id ? (
                      <ActivityIndicator size="small" color={tokens.status.errorStrong} />
                    ) : (
                      <Ionicons name="close-circle-outline" size={22} color={tokens.status.errorStrong} />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
