import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { colors } from "../../theme";
import PinBottomSheet from "../../components/PinBottomSheet";
import { buyCable, fetchPlans, validateIuc, clearValidation } from "../../store/slices/utilitySlice";

// providerNetworkId: GOTV=1, DSTV=2, STARTIME=3
const PROVIDERS = [
  { id: 1, name: "GOTV", color: "#00A650" },
  { id: 2, name: "DSTV", color: "#0066CC" },
  { id: 3, name: "STARTIME", color: "#E8003D" },
];

export default function CableScreen({ navigation }) {
  const dispatch = useDispatch();
  const { balance } = useSelector((state) => state.wallet);
  const { plans, isLoading, isValidating, validationResult } = useSelector((state) => state.utility);

  const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0]);
  const [smartCard, setSmartCard] = useState("");
  const [smartCardValidated, setSmartCardValidated] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPinSheet, setShowPinSheet] = useState(false);
  const [error, setError] = useState("");

  const plansKey = `CABLE-${selectedProvider.id}`;
  const cablePlans = plans[plansKey] || [];

  useEffect(() => {
    dispatch(fetchPlans({ type: "CABLE", networkId: selectedProvider.id }));
    setSelectedPlan(null);
    setSmartCardValidated(false);
    dispatch(clearValidation());
  }, [selectedProvider.id]);

  const handleValidateIuc = async () => {
    if (!smartCard.trim()) { setError("Enter smart card number"); return; }
    setError("");
    try {
      await dispatch(validateIuc({ smartCardNumber: smartCard.trim(), cableNameId: selectedProvider.id })).unwrap();
      setSmartCardValidated(true);
    } catch {
      setError("Could not validate smart card. Check the number and try again.");
      setSmartCardValidated(false);
    }
  };

  const handlePurchase = () => {
    if (!smartCardValidated) { setError("Please validate your smart card first"); return; }
    if (!selectedPlan) { setError("Please select a plan"); return; }
    if (Number(selectedPlan.sellingPrice) > Number(balance)) { setError("Insufficient wallet balance"); return; }
    setError("");
    setShowPinSheet(true);
  };

  const handlePinConfirm = async (pin) => {
    await dispatch(buyCable({ planId: selectedPlan.id, smartCardNumber: smartCard.trim(), pin })).unwrap();
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
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>Cable TV</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
        {error ? (
          <View style={{ backgroundColor: colors.error + "15", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="alert-circle" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.error, fontWeight: "500" }}>{error}</Text>
          </View>
        ) : null}

        {/* Provider Selection */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 12 }}>Select Provider</Text>
        <View style={{ flexDirection: "row", marginBottom: 20 }}>
          {PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => { setSelectedProvider(p); setSmartCardValidated(false); dispatch(clearValidation()); }}
              style={{
                flex: 1, marginRight: p.id !== PROVIDERS[PROVIDERS.length - 1].id ? 8 : 0,
                backgroundColor: selectedProvider.id === p.id ? colors.primary : colors.surface,
                borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 2,
                borderColor: selectedProvider.id === p.id ? colors.primary : colors.border,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginBottom: 6 }} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: selectedProvider.id === p.id ? colors.white : colors.text }}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Smart Card */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>Smart Card / IUC Number</Text>
        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: smartCardValidated ? colors.success || "#22C55E" : colors.border, paddingHorizontal: 16, marginRight: 8 }}>
            <Ionicons name="tv-outline" size={20} color={colors.textMuted} />
            <TextInput
              value={smartCard}
              onChangeText={(text) => { setSmartCard(text); setSmartCardValidated(false); dispatch(clearValidation()); setError(""); }}
              placeholder="Enter IUC number"
              placeholderTextColor={colors.textLight}
              keyboardType="number-pad"
              style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.text, paddingVertical: 16, marginLeft: 12 }}
            />
            {smartCardValidated && <Ionicons name="checkmark-circle" size={20} color="#22C55E" />}
          </View>
          <TouchableOpacity
            onPress={handleValidateIuc}
            disabled={isValidating}
            style={{ backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }}
          >
            {isValidating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Verify</Text>}
          </TouchableOpacity>
        </View>

        {validationResult && (
          <View style={{ backgroundColor: "#ECFDF5", borderRadius: 12, padding: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 13, color: "#059669", fontWeight: "600" }}>
              {validationResult.Customer_Name || validationResult.name || "Verified"}
            </Text>
          </View>
        )}

        {/* Plans */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 12 }}>Select Plan</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <View style={{ marginBottom: 20 }}>
            {cablePlans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                onPress={() => setSelectedPlan(plan)}
                style={{
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: selectedPlan?.id === plan.id ? colors.primary + "10" : colors.surface,
                  borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2,
                  borderColor: selectedPlan?.id === plan.id ? colors.primary : colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{plan.name}</Text>
                  {plan.validity ? <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{plan.validity}</Text> : null}
                </View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>₦{Number(plan.sellingPrice).toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
            {!cablePlans.length && <Text style={{ color: colors.textMuted, textAlign: "center", marginVertical: 20 }}>No plans available</Text>}
          </View>
        )}
      </ScrollView>

      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={isLoading || !selectedPlan}
          style={{ backgroundColor: selectedPlan ? colors.primary : colors.textLight, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>
              {selectedPlan ? `Pay ₦${Number(selectedPlan.sellingPrice).toLocaleString()}` : "Select a Plan"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <PinBottomSheet
        isVisible={showPinSheet}
        onClose={() => setShowPinSheet(false)}
        onConfirm={handlePinConfirm}
        onForgotPin={() => { setShowPinSheet(false); navigation.navigate("ChangePin"); }}
        title="Confirm Subscription"
        subtitle={selectedPlan ? `${selectedPlan.name} — ₦${Number(selectedPlan.sellingPrice).toLocaleString()}` : ""}
      />
    </SafeAreaView>
  );
}
