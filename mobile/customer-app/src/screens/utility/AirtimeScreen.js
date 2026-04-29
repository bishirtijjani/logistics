import React, { useState } from "react";
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
import { buyAirtime } from "../../store/slices/utilitySlice";

const MERCHANTS = [
  { id: "mtn", name: "MTN", color: "#FFCC00", icon: "cellular" },
  { id: "airtel", name: "Airtel", color: "#FF0000", icon: "cellular" },
  { id: "glo", name: "Glo", color: "#00AA00", icon: "cellular" },
  { id: "etisalat", name: "9mobile", color: "#0066CC", icon: "cellular" },
];

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export default function AirtimeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { balance } = useSelector((state) => state.wallet);
  const { isLoading } = useSelector((state) => state.utility);

  const [merchant, setMerchant] = useState("mtn");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [showPinSheet, setShowPinSheet] = useState(false);
  const [error, setError] = useState("");

  const handleAmountSelect = (value) => {
    setAmount(value.toString());
    setError("");
  };

  const handlePurchase = () => {
    if (!phone.trim() || phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }
    if (!amount || Number(amount) < 50) {
      setError("Minimum airtime amount is ₦50");
      return;
    }
    if (Number(amount) > Number(balance)) {
      setError("Insufficient wallet balance");
      return;
    }

    setError("");
    setShowPinSheet(true);
  };

  const handlePinConfirm = async (pin) => {
    setShowPinSheet(false);

    try {
      await dispatch(
        buyAirtime({
          merchant,
          phone: phone.trim(),
          amount: Number(amount),
          pin,
        })
      ).unwrap();

      // Navigate to success or history
      navigation.navigate("UtilityHistory");
    } catch (err) {
      setError(err.message || "Failed to purchase airtime. Please try again.");
    }
  };

  const selectedMerchant = MERCHANTS.find((p) => p.id === merchant);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>Buy Airtime</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
      >
        {/* Error */}
        {error ? (
          <View
            style={{
              backgroundColor: colors.error + "15",
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="alert-circle" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.error, fontWeight: "500" }}>
              {error}
            </Text>
          </View>
        ) : null}

        {/* Merchant Selection */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 12 }}>
          Select Merchant
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
          {MERCHANTS.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setMerchant(p.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: merchant === p.id ? colors.primary : colors.surface,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginRight: 8,
                marginBottom: 8,
                borderWidth: 2,
                borderColor: merchant === p.id ? colors.primary : colors.border,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: p.color,
                  marginRight: 8,
                }}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: merchant === p.id ? colors.white : colors.text,
                }}
              >
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phone Number */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
          Phone Number
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: colors.border,
            paddingHorizontal: 16,
            marginBottom: 20,
          }}
        >
          <Ionicons name="call-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={phone}
            onChangeText={(text) => {
              setPhone(text.replace(/[^0-9]/g, ""));
              setError("");
            }}
            placeholder="080XXXXXXXX"
            placeholderTextColor={colors.textLight}
            keyboardType="phone-pad"
            maxLength={11}
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: "600",
              color: colors.text,
              paddingVertical: 16,
              marginLeft: 12,
            }}
          />
        </View>

        {/* Amount */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
          Amount (₦)
        </Text>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: colors.border,
            paddingHorizontal: 16,
            marginBottom: 12,
          }}
        >
          <TextInput
            value={amount}
            onChangeText={(text) => {
              setAmount(text.replace(/[^0-9]/g, ""));
              setError("");
            }}
            placeholder="Enter amount"
            placeholderTextColor={colors.textLight}
            keyboardType="number-pad"
            style={{
              fontSize: 24,
              fontWeight: "700",
              color: colors.text,
              paddingVertical: 16,
            }}
          />
        </View>

        {/* Quick Amounts */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 24 }}>
          {QUICK_AMOUNTS.map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => handleAmountSelect(value)}
              style={{
                backgroundColor: Number(amount) === value ? colors.primary : colors.surface,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginRight: 8,
                marginBottom: 8,
                borderWidth: 2,
                borderColor: Number(amount) === value ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: Number(amount) === value ? colors.white : colors.text,
                }}
              >
                ₦{value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Card */}
        {amount ? (
          <View
            style={{
              backgroundColor: colors.primary + "10",
              borderRadius: 16,
              padding: 20,
              borderWidth: 2,
              borderColor: colors.primary + "30",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>Merchant</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                {selectedMerchant?.name}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>Phone</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                {phone || "---"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Total</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.primary }}>
                ₦{Number(amount).toLocaleString()}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom Button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.background,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 24,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={isLoading}
          style={{
            backgroundColor: amount ? colors.primary : colors.textLight,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
          }}
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

      {/* PIN Bottom Sheet */}
      <PinBottomSheet
        isVisible={showPinSheet}
        onClose={() => setShowPinSheet(false)}
        onConfirm={handlePinConfirm}
        title="Confirm Purchase"
        subtitle={`You will be charged ₦${Number(amount).toLocaleString()} for ${selectedMerchant?.name} airtime`}
      />
    </SafeAreaView>
  );
}
