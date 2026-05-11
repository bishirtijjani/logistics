import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { colors } from "../../theme";
import PinBottomSheet from "../../components/PinBottomSheet";
import { buyAirtime, fetchPlans } from "../../store/slices/utilitySlice";
import { usePlatformSetting } from "../../services/settings";

const NETWORK_COLORS = { MTN: "#FFCC00", GLO: "#00AA00", "9MOBILE": "#0066CC", AIRTEL: "#FF0000", SMILE: "#1E90FF" };

export default function AirtimeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { balance } = useSelector((state) => state.wallet);
  const { plans, isLoading } = useSelector((state) => state.utility);

  const minAmount = Number(usePlatformSetting("utility.minAirtimeAmount", 50));
  const quickAmountsSetting = usePlatformSetting("utility.airtimeQuickAmounts", null);
  const QUICK_AMOUNTS = Array.isArray(quickAmountsSetting) && quickAmountsSetting.length > 0
    ? quickAmountsSetting.map(Number)
    : [100, 200, 500, 1000, 2000, 5000];

  const networks = plans["AIRTIME"] || [];

  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [showPinSheet, setShowPinSheet] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dispatch(fetchPlans({ type: "AIRTIME" }));
  }, [dispatch]);

  useEffect(() => {
    if (networks.length && !selectedNetwork) setSelectedNetwork(networks[0]);
  }, [networks]);

  const handlePurchase = () => {
    if (!selectedNetwork) { setError("Please select a network"); return; }
    if (!phone.trim() || phone.length < 10) { setError("Enter a valid phone number"); return; }
    if (!amount || Number(amount) < minAmount) { setError(`Minimum airtime is ₦${minAmount.toLocaleString()}`); return; }
    if (Number(amount) > Number(balance)) { setError("Insufficient wallet balance"); return; }
    setError("");
    setShowPinSheet(true);
  };

  const handlePinConfirm = async (pin) => {
    // Don't close the sheet here — let PinBottomSheet handle 423/401 errors
    // (lockout countdown, attempts-remaining message). Close on success only.
    await dispatch(buyAirtime({
      networkId: selectedNetwork.providerNetworkId,
      phone: phone.trim(),
      amount: Number(amount),
      pin,
    })).unwrap();
    setShowPinSheet(false);
    navigation.navigate("UtilityHistory");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>Buy Airtime</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
        {error ? (
          <View style={{ backgroundColor: colors.error + "15", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="alert-circle" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.error, fontWeight: "500" }}>{error}</Text>
          </View>
        ) : null}

        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 12 }}>Select Network</Text>
        {isLoading && !networks.length ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
            {networks.map((n) => (
              <TouchableOpacity
                key={n.id}
                onPress={() => setSelectedNetwork(n)}
                style={{
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: selectedNetwork?.id === n.id ? colors.primary : colors.surface,
                  borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                  marginRight: 8, marginBottom: 8, borderWidth: 2,
                  borderColor: selectedNetwork?.id === n.id ? colors.primary : colors.border,
                }}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: NETWORK_COLORS[n.networkName] || "#999", marginRight: 8 }} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: selectedNetwork?.id === n.id ? colors.white : colors.text }}>
                  {n.networkName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>Phone Number</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 16, marginBottom: 20 }}>
          <Ionicons name="call-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={phone}
            onChangeText={(text) => { setPhone(text.replace(/[^0-9]/g, "")); setError(""); }}
            placeholder="080XXXXXXXX"
            placeholderTextColor={colors.textLight}
            keyboardType="phone-pad"
            maxLength={11}
            style={{ flex: 1, fontSize: 16, fontWeight: "600", color: colors.text, paddingVertical: 16, marginLeft: 12 }}
          />
        </View>

        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>Amount (₦)</Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 16, marginBottom: 12 }}>
          <TextInput
            value={amount}
            onChangeText={(text) => { setAmount(text.replace(/[^0-9]/g, "")); setError(""); }}
            placeholder="Enter amount"
            placeholderTextColor={colors.textLight}
            keyboardType="number-pad"
            style={{ fontSize: 24, fontWeight: "700", color: colors.text, paddingVertical: 16 }}
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24 }}>
          {QUICK_AMOUNTS.map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setAmount(value.toString())}
              style={{ backgroundColor: Number(amount) === value ? colors.primary : colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, marginBottom: 8, borderWidth: 2, borderColor: Number(amount) === value ? colors.primary : colors.border }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: Number(amount) === value ? colors.white : colors.text }}>₦{value}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {amount ? (
          <View style={{ backgroundColor: colors.primary + "10", borderRadius: 16, padding: 20, borderWidth: 2, borderColor: colors.primary + "30" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>Network</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{selectedNetwork?.networkName || "—"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>Phone</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{phone || "—"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Total</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.primary }}>₦{Number(amount).toLocaleString()}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={isLoading}
          style={{ backgroundColor: amount ? colors.primary : colors.textLight, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>
              {amount ? `Pay ₦${Number(amount).toLocaleString()}` : "Enter Amount"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <PinBottomSheet
        isVisible={showPinSheet}
        onClose={() => setShowPinSheet(false)}
        onConfirm={handlePinConfirm}
        onForgotPin={() => { setShowPinSheet(false); navigation.navigate("ChangePin"); }}
        title="Confirm Purchase"
        subtitle={`₦${Number(amount).toLocaleString()} airtime for ${selectedNetwork?.networkName}`}
      />
    </SafeAreaView>
  );
}
