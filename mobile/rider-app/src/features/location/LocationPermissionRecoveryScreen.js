import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  AppState,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as IntentLauncher from "expo-intent-launcher";
import { useTheme } from "../../theme";

/**
 * Full-screen recovery flow shown when the rider tries to go ONLINE but
 * location permission is denied OR device location services are off.
 *
 * Auto-rechecks on `active` AppState events so once the rider returns from
 * Settings the screen pops itself back via `navigation.goBack()`.
 */
export default function LocationPermissionRecoveryScreen({ navigation }) {
  const { tokens } = useTheme();
  const [check, setCheck] = useState({ permission: "denied", servicesEnabled: false });

  const recheck = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      const next = { permission: status, servicesEnabled };
      setCheck(next);
      if (next.permission === "granted" && next.servicesEnabled) {
        navigation.goBack();
      }
    } catch (_) {}
  }, [navigation]);

  useEffect(() => {
    recheck();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") recheck();
    });
    return () => sub.remove();
  }, [recheck]);

  const requestPermission = useCallback(async () => {
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.status !== "granted") {
        // If denied with `canAskAgain=false`, deep-link to settings.
        if (!res.canAskAgain) await openAppSettings();
      }
      recheck();
    } catch (_) {}
  }, [recheck]);

  const openAppSettings = useCallback(async () => {
    try {
      if (Platform.OS === "android") {
        await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
          data: "package:com.codeket.logistics.rider",
        });
      } else {
        await Linking.openSettings();
      }
    } catch (_) {
      await Linking.openSettings().catch(() => {});
    }
  }, []);

  const openDeviceLocation = useCallback(async () => {
    try {
      if (Platform.OS === "android") {
        await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS);
      } else {
        await Linking.openSettings();
      }
    } catch (_) {
      await Linking.openSettings().catch(() => {});
    }
  }, []);

  const needsPermission = check.permission !== "granted";
  const needsServices = !check.servicesEnabled;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg.canvas }}>
      <View style={{ height: 4, backgroundColor: tokens.status.warningStrong }} />
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 56 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ marginBottom: 24 }}
        >
          <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
        </TouchableOpacity>

        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: tokens.status.warningSoft,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Ionicons name="location-outline" size={40} color={tokens.status.warningStrong} />
        </View>

        <Text
          accessibilityRole="header"
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: tokens.text.primary,
            marginBottom: 8,
            letterSpacing: -0.5,
          }}
        >
          Turn on location to go online
        </Text>

        <Text style={{ fontSize: 15, color: tokens.text.muted, marginBottom: 24, lineHeight: 22 }}>
          iPrime Rider needs your location to find nearby jobs and let customers track their deliveries in real time.
        </Text>

        {needsPermission ? (
          <Step
            tokens={tokens}
            num="1"
            title="Allow location for iPrime Rider"
            body="Grant the app permission to use your phone's location."
            ctaLabel={check.permission === "denied" ? "Open app settings" : "Allow location"}
            onPress={check.permission === "denied" ? openAppSettings : requestPermission}
          />
        ) : (
          <StepDone tokens={tokens} num="1" title="App permission granted" />
        )}

        {needsServices ? (
          <Step
            tokens={tokens}
            num="2"
            title="Turn on Location on your device"
            body="Open your device's Location settings and enable Location services."
            ctaLabel="Open device location settings"
            onPress={openDeviceLocation}
          />
        ) : (
          <StepDone tokens={tokens} num="2" title="Device location is on" />
        )}

        <TouchableOpacity
          onPress={recheck}
          accessibilityRole="button"
          style={{
            marginTop: 24,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: tokens.border.default,
            alignItems: "center",
          }}
        >
          <Text style={{ color: tokens.text.muted, fontWeight: "600" }}>Recheck</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Step({ tokens, num, title, body, ctaLabel, onPress }) {
  return (
    <View
      style={{
        backgroundColor: tokens.bg.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.border.default,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: tokens.brand.default,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Text style={{ color: tokens.text.onBrand, fontWeight: "800", fontSize: 13 }}>{num}</Text>
        </View>
        <Text style={{ fontSize: 15, fontWeight: "700", color: tokens.text.primary, flex: 1 }}>
          {title}
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: tokens.text.muted, lineHeight: 18, marginBottom: 12 }}>
        {body}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        style={{
          backgroundColor: tokens.brand.default,
          paddingVertical: 12,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: tokens.text.onBrand, fontWeight: "700" }}>{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function StepDone({ tokens, num, title }) {
  return (
    <View
      style={{
        backgroundColor: tokens.status.successSoft,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: tokens.status.successStrong,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        <Ionicons name="checkmark" size={16} color="#fff" />
      </View>
      <Text style={{ fontSize: 14, fontWeight: "700", color: tokens.text.primary, flex: 1 }}>
        {num}. {title}
      </Text>
    </View>
  );
}
