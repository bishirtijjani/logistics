import React, { useEffect, useState } from "react";
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import api from "../../services/api";
import { useTheme } from "../../theme";
import Toast from "react-native-toast-message";

export default function SessionsScreen({ navigation }) {
  const { tokens } = useTheme();
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);

  const formatDate = (d) => {
    if (!d) return "-";
    const tag = i18n.language === "ha" ? "ha-NG" : "en-NG";
    return new Date(d).toLocaleString(tag, {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/sessions");
      setSessions(res?.data ?? []);
    } catch (_) {
      Toast.show({ type: "error", text1: t("errors.UNKNOWN_ERROR") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const revokeOne = (sessionId) => {
    Alert.alert(t("sessions.confirmSignOutTitle"), t("sessions.confirmSignOutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("sessions.signOut"),
        style: "destructive",
        onPress: async () => {
          try {
            setRevoking(sessionId);
            await api.delete(`/auth/sessions/${sessionId}`);
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            Toast.show({ type: "success", text1: t("sessions.signedOut") });
          } catch (_) {
            Toast.show({ type: "error", text1: "Failed to revoke session" });
          } finally {
            setRevoking(null);
          }
        },
      },
    ]);
  };

  const revokeOthers = () => {
    Alert.alert("Revoke All Other Sessions", "Sign out all other devices?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke All",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete("/auth/sessions/others");
            await load();
            Toast.show({ type: "success", text1: "Other sessions revoked" });
          } catch (_) {
            Toast.show({ type: "error", text1: "Failed to revoke sessions" });
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      <View style={{ height: 4, backgroundColor: tokens.brand.default }} />

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.back")}
        >
          <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "900", color: tokens.text.primary, marginLeft: 16, letterSpacing: -0.5 }}>
          {t("sessions.title")}
        </Text>
      </View>

      {sessions.length > 1 && (
        <TouchableOpacity
          onPress={revokeOthers}
          style={{ marginHorizontal: 20, marginTop: 8, marginBottom: 4, backgroundColor: tokens.status.errorSoft, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center" }}
        >
          <Ionicons name="log-out-outline" size={18} color={tokens.status.errorStrong} />
          <Text style={{ color: tokens.status.errorStrong, fontWeight: "700", fontSize: 13, marginLeft: 8 }}>Sign out all other devices</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color={tokens.brand.default} style={{ marginTop: 40 }} />
      ) : sessions.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: tokens.text.muted }}>No active sessions</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: tokens.bg.surface,
                borderRadius: 16,
                padding: 16,
                marginBottom: 10,
                borderWidth: item.isCurrent ? 1.5 : 0,
                borderColor: item.isCurrent ? tokens.brand.default : "transparent",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: item.isCurrent ? tokens.brand.default + "20" : tokens.border.default,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={20}
                    color={item.isCurrent ? tokens.brand.default : tokens.text.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary }}>
                      {item.deviceName || item.userAgent?.split(" ")[0] || "Unknown device"}
                    </Text>
                    {item.isCurrent && (
                      <View style={{ marginLeft: 8, backgroundColor: tokens.brand.default + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: tokens.brand.strong }}>THIS DEVICE</Text>
                      </View>
                    )}
                  </View>
                  {item.deviceModel ? (
                    <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>
                      {item.deviceModel}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 2 }}>
                    Last active: {formatDate(item.lastUsedAt || item.createdAt)}
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
