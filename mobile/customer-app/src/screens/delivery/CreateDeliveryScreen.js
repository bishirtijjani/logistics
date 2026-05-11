import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { colors } from "../../theme";
import { createRequest } from "../../store/slices/requestSlice";
import api from "../../services/api";
import Toast from "react-native-toast-message";

const PACKAGE_SIZES = [
  { id: "SMALL",  label: "Small",  icon: "document-outline",   description: "Documents, small items" },
  { id: "MEDIUM", label: "Medium", icon: "briefcase-outline",   description: "Groceries, clothing" },
  { id: "LARGE",  label: "Large",  icon: "cube-outline",        description: "Boxes, bulk items" },
];

export default function CreateDeliveryScreen({ navigation }) {
  const dispatch = useDispatch();
  const { balance } = useSelector((s) => s.wallet);
  const { isCreating } = useSelector((s) => s.request);

  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [packageSize, setPackageSize] = useState("SMALL");
  const [description, setDescription] = useState("");
  const [isFragile, setIsFragile] = useState(false);
  const [quote, setQuote] = useState(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState("");

  const fetchQuote = useCallback(async () => {
    if (!pickup || !dropoff) return;
    setIsQuoting(true);
    try {
      const { data } = await api.get("/requests/quote", {
        params: {
          type: "PACKAGE",
          pickupLat: pickup.latitude,
          pickupLng: pickup.longitude,
          dropoffLat: dropoff.latitude,
          dropoffLng: dropoff.longitude,
        },
      });
      if (data.success) setQuote(data.data);
    } catch {
      Toast.show({ type: "error", text1: "Could not calculate estimate" });
    } finally {
      setIsQuoting(false);
    }
  }, [pickup, dropoff]);

  useEffect(() => {
    if (pickup && dropoff) fetchQuote();
  }, [pickup, dropoff, fetchQuote]);

  const handleContinue = () => {
    if (!pickup || !dropoff) {
      Toast.show({ type: "error", text1: "Set pickup and drop-off locations" });
      return;
    }
    if (!quote) {
      Toast.show({ type: "error", text1: "Waiting for price estimate" });
      return;
    }
    if (Number(balance) < Number(quote.total)) {
      Toast.show({ type: "error", text1: "Insufficient wallet balance" });
      return;
    }
    setShowPin(true);
    setPin("");
    setPinError("");
  };

  const handlePinDigit = async (digit) => {
    const newPin = (pin + digit).slice(0, 6);
    setPin(newPin);
    setPinError("");
    if (newPin.length !== 6) return;

    const res = await dispatch(createRequest({
      type: "PACKAGE",
      pickupLat: pickup.latitude,
      pickupLng: pickup.longitude,
      pickupAddress: pickup.address,
      dropoffLat: dropoff.latitude,
      dropoffLng: dropoff.longitude,
      dropoffAddress: dropoff.address,
      package: {
        description: description || "Package delivery",
        size: packageSize,
        fragile: isFragile,
      },
      pin: newPin,
    }));

    if (createRequest.fulfilled.match(res)) {
      navigation.replace("RequestTracking", { requestId: res.payload.id });
    } else {
      const msg = res.payload || "Failed to create delivery";
      setPinError(msg.includes("PIN") || msg.includes("pin") ? "Incorrect PIN" : msg);
      setPin("");
    }
  };

  const pinDelete = () => setPin((p) => p.slice(0, -1));

  if (showPin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, marginBottom: 32 }}>
          <TouchableOpacity onPress={() => setShowPin(false)}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, marginLeft: 16 }}>Confirm Payment</Text>
        </View>

        <View style={{ alignItems: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: "100%", marginBottom: 28, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Delivery fee</Text>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>₦{Number(quote?.deliveryFee || 0).toLocaleString()}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Platform fee</Text>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>₦{Number(quote?.platformFee || 0).toLocaleString()}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>Total</Text>
              <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 18 }}>₦{Number(quote?.total || 0).toLocaleString()}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 24 }}>Enter your 6-digit PIN to confirm</Text>

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: i < pin.length ? colors.primary : colors.border }}
              />
            ))}
          </View>

          {pinError ? (
            <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>{pinError}</Text>
          ) : null}

          <View style={{ width: "100%", maxWidth: 300, marginTop: 16 }}>
            {[[1, 2, 3], [4, 5, 6], [7, 8, 9], ["", 0, "del"]].map((row, ri) => (
              <View key={ri} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                {row.map((key, ki) => (
                  <TouchableOpacity
                    key={ki}
                    onPress={() => {
                      if (key === "del") pinDelete();
                      else if (key !== "") handlePinDigit(String(key));
                    }}
                    disabled={isCreating}
                    style={{
                      width: 84,
                      height: 64,
                      borderRadius: 16,
                      backgroundColor: key === "" ? "transparent" : colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {key === "del" ? (
                      <Ionicons name="backspace-outline" size={24} color={colors.text} />
                    ) : key !== "" ? (
                      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>{key}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
          {isCreating && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ height: 4, backgroundColor: colors.primary }} />

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 28 }}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginLeft: 16, letterSpacing: -0.5 }}>
              Send a Package
            </Text>
          </View>

          {/* Balance chip */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 24, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 8 }}>
              Balance: <Text style={{ fontWeight: "800", color: colors.text }}>₦{Number(balance).toLocaleString()}</Text>
            </Text>
          </View>

          {/* Pickup */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 8, letterSpacing: 0.8 }}>PICKUP</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("LocationPicker", {
              title: "Set Pickup Location",
              onSelect: (loc) => setPickup(loc),
            })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 20,
              borderWidth: 1.5,
              borderColor: pickup ? colors.primary : colors.border,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#16A34A", marginRight: 12 }} />
            <Text style={{ flex: 1, fontSize: 14, color: pickup ? colors.text : colors.textMuted, fontWeight: pickup ? "600" : "400" }} numberOfLines={1}>
              {pickup?.address || "Select pickup location"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Dropoff */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 8, letterSpacing: 0.8 }}>DROP-OFF</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("LocationPicker", {
              title: "Set Drop-off Location",
              onSelect: (loc) => setDropoff(loc),
            })}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 24,
              borderWidth: 1.5,
              borderColor: dropoff ? colors.primary : colors.border,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginRight: 12 }} />
            <Text style={{ flex: 1, fontSize: 14, color: dropoff ? colors.text : colors.textMuted, fontWeight: dropoff ? "600" : "400" }} numberOfLines={1}>
              {dropoff?.address || "Select drop-off location"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Package size */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 12, letterSpacing: 0.8 }}>PACKAGE SIZE</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
            {PACKAGE_SIZES.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setPackageSize(s.id)}
                style={{
                  flex: 1,
                  backgroundColor: packageSize === s.id ? colors.primary + "15" : colors.surface,
                  borderRadius: 14,
                  padding: 14,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: packageSize === s.id ? colors.primary : colors.border,
                }}
              >
                <Ionicons name={s.icon} size={22} color={packageSize === s.id ? colors.primary : colors.textMuted} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: packageSize === s.id ? colors.primary : colors.text, marginTop: 6 }}>{s.label}</Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: "center", marginTop: 2 }}>{s.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, marginBottom: 8, letterSpacing: 0.8 }}>ITEM DESCRIPTION (OPTIONAL)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What are you sending?"
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 15,
              color: colors.text,
              borderWidth: 1.5,
              borderColor: colors.border,
              marginBottom: 20,
            }}
          />

          {/* Fragile toggle */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="warning-outline" size={18} color={colors.textMuted} />
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginLeft: 8 }}>Fragile item</Text>
            </View>
            <Switch
              value={isFragile}
              onValueChange={setIsFragile}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={isFragile ? colors.primary : colors.textMuted}
            />
          </View>

          {/* Estimate card */}
          {(isQuoting || quote) && (
            <View style={{ backgroundColor: colors.dark, borderRadius: 16, padding: 20, marginBottom: 28 }}>
              {isQuoting ? (
                <ActivityIndicator color={colors.white} />
              ) : quote ? (
                <>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 12 }}>Estimated Cost</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{quote.distanceKm} km · ~{quote.estimatedMinutes} min</Text>
                    <Text style={{ color: colors.white, fontSize: 13 }}>Fee: ₦{Number(quote.deliveryFee).toLocaleString()}</Text>
                  </View>
                  <Text style={{ color: colors.white, fontSize: 26, fontWeight: "900", letterSpacing: -1 }}>
                    ₦{Number(quote.total).toLocaleString()}
                  </Text>
                </>
              ) : null}
            </View>
          )}

          <TouchableOpacity
            onPress={handleContinue}
            disabled={!quote || isQuoting}
            style={{
              backgroundColor: !quote || isQuoting ? colors.textMuted : colors.primary,
              paddingVertical: 15,
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.white, fontWeight: "800", fontSize: 16 }}>
              {isQuoting ? "Calculating..." : "Continue"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
