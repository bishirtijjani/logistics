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
import { buyData, fetchDataPlans } from "../../store/slices/utilitySlice";

const MERCHANTS = [
  { id: "mtn", name: "MTN", color: "#FFCC00" },
  { id: "airtel", name: "Airtel", color: "#FF0000" },
  { id: "glo", name: "Glo", color: "#00AA00" },
  { id: "etisalat", name: "9mobile", color: "#0066CC" },
];

export default function DataScreen({ navigation }) {
  const dispatch = useDispatch();
  const { balance } = useSelector((state) => state.wallet);
  const { dataPlans, isLoading } = useSelector((state) => state.utility);

  const [merchant, setMerchant] = useState("mtn");
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPinSheet, setShowPinSheet] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dispatch(fetchDataPlans(merchant));
  }, [dispatch, merchant]);

  const handlePurchase = () => {
    if (!phone.trim() || phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }
    if (!selectedPlan) {
      setError("Please select a data plan");
      return;
    }
    if (Number(selectedPlan.amount) > Number(balance)) {
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
        buyData({
          merchant,
          phone: phone.trim(),
          planCode: selectedPlan.code,
          amount: selectedPlan.amount,
          pin,
        })
      ).unwrap();

      navigation.navigate("UtilityHistory");
    } catch (err) {
      setError(err.message || "Failed to purchase data. Please try again.");
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
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>Buy Data</Text>
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
              onPress={() => {
                setMerchant(p.id);
                setSelectedPlan(null);
              }}
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

        {/* Data Plans */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 12 }}>
          Select Data Plan
        </Text>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <View style={{ marginBottom: 20 }}>
            {dataPlans.map((plan) => (
              <TouchableOpacity
                key={plan.code}
                onPress={() => setSelectedPlan(plan)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: selectedPlan?.code === plan.code ? colors.primary + "10" : colors.surface,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 2,
                  borderColor: selectedPlan?.code === plan.code ? colors.primary : colors.border,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: selectedPlan?.code === plan.code ? colors.primary : colors.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 16,
                  }}
                >
                  <Ionicons
                    name="wifi"
                    size={24}
                    color={selectedPlan?.code === plan.code ? colors.white : colors.text}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                    {plan.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                    Validity: {plan.validity}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>
                  ₦{Number(plan.amount).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
          disabled={isLoading || !selectedPlan}
          style={{
            backgroundColor: selectedPlan ? colors.primary : colors.textLight,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>
              {selectedPlan
                ? `Pay ₦${Number(selectedPlan.amount).toLocaleString()}`
                : "Select a Plan"}
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
        subtitle={`You will be charged ₦${
          selectedPlan ? Number(selectedPlan.amount).toLocaleString() : 0
        } for ${selectedMerchant?.name} data`}
      />
    </SafeAreaView>
  );
}
