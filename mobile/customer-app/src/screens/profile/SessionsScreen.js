import React, { useEffect, useState } from "react";
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
import api from "../../services/api";
import { colors } from "../../theme";
import Toast from "react-native-toast-message";

function formatDate(d) {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionsScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/sessions");
      setSessions(res.data?.data ?? res.data ?? []);
    } catch (_) {
      Toast.show({ type: "error", text1: "Failed to load sessions" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const revokeOne = (sessionId) => {
    Alert.alert("Revoke Session", "Sign out this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          try {
            setRevoking(sessionId);
            await api.delete(`/auth/sessions/${sessionId}`);
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            Toast.show({ type: "success", text1: "Session revoked" });
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ height: 4, backgroundColor: colors.primary }} />

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginLeft: 16, letterSpacing: -0.5 }}>
          Active Sessions
        </Text>
      </View>

      {sessions.length > 1 && (
        <TouchableOpacity
          onPress={revokeOthers}
          style={{ marginHorizontal: 20, marginTop: 8, marginBottom: 4, backgroundColor: "#FEE2E2", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center" }}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 13, marginLeft: 8 }}>Sign out all other devices</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : sessions.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.textMuted }}>No active sessions</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginBottom: 10,
                borderWidth: item.isCurrent ? 1.5 : 0,
                borderColor: item.isCurrent ? colors.primary : "transparent",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: item.isCurrent ? colors.primary + "20" : colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={20}
                    color={item.isCurrent ? colors.primary : colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                      {item.deviceName || item.userAgent?.split(" ")[0] || "Unknown device"}
                    </Text>
                    {item.isCurrent && (
                      <View style={{ marginLeft: 8, backgroundColor: colors.primary + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.primary }}>THIS DEVICE</Text>
                      </View>
                    )}
                  </View>
                  {item.deviceModel ? (
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                      {item.deviceModel}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    Last active: {formatDate(item.lastUsedAt || item.createdAt)}
                  </Text>
                  {item.ipAddress ? (
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{item.ipAddress}</Text>
                  ) : null}
                </View>
                {!item.isCurrent && (
                  <TouchableOpacity
                    onPress={() => revokeOne(item.id)}
                    disabled={revoking === item.id}
                    style={{ padding: 4 }}
                  >
                    {revoking === item.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Ionicons name="close-circle-outline" size={22} color="#DC2626" />
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
