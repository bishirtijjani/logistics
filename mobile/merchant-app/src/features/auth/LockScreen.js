import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import { authenticateWithBiometric } from "../../services/biometric";
import { logout } from "../../store/slices/authSlice";

export default function LockScreen({ onUnlock, onSignOut }) {
  const { tokens } = useTheme();
  const { t } = useT();
  const dispatch = useDispatch();
  const [error, setError] = useState("");

  const tryUnlock = useCallback(async () => {
    setError("");
    const ok = await authenticateWithBiometric(t("lock.prompt", "Unlock iPrime Merchant"));
    if (ok) onUnlock();
    else setError(t("lock.failed", "Couldn't verify. Try again."));
  }, [onUnlock, t]);

  useEffect(() => {
    tryUnlock();
  }, [tryUnlock]);

  const signOut = async () => {
    await dispatch(logout());
    onSignOut?.();
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 28,
          backgroundColor: tokens.brand.default,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <Ionicons name="lock-closed" size={40} color={tokens.text.onBrand} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "800", color: tokens.text.primary, marginBottom: 8 }}>
        {t("lock.title", "App locked")}
      </Text>
      <Text style={{ fontSize: 14, color: tokens.text.muted, textAlign: "center", marginBottom: 24 }}>
        {t("lock.subtitle", "Unlock with Face ID or fingerprint to continue.")}
      </Text>
      {error ? <Text style={{ color: tokens.status.error, marginBottom: 16, fontWeight: "600" }}>{error}</Text> : null}

      <TouchableOpacity
        onPress={tryUnlock}
        style={{ backgroundColor: tokens.brand.default, paddingVertical: 15, paddingHorizontal: 40, borderRadius: 14, marginBottom: 12 }}
      >
        <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 15 }}>{t("lock.unlock", "Unlock")}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={signOut} style={{ paddingVertical: 12 }}>
        <Text style={{ color: tokens.text.muted, fontWeight: "600" }}>{t("auth.signOut", "Sign out")}</Text>
      </TouchableOpacity>
    </View>
  );
}
