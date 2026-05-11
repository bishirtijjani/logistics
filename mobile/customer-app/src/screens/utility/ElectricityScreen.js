import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { colors } from "../../theme";
import PinBottomSheet from "../../components/PinBottomSheet";
import { payElectricity, fetchPlans, validateMeter, clearValidation } from "../../store/slices/utilitySlice";
import { usePlatformSetting } from "../../services/settings";

export default function ElectricityScreen({ navigation }) {
  const dispatch = useDispatch();
  const { balance } = useSelector((state) => state.wallet);
  const { plans, isLoading, isValidating, validationResult } = useSelector((state) => state.utility);

  const minAmount = Number(usePlatformSetting("utility.minElectricityAmount", 500));
  const quickAmountsSetting = usePlatformSetting("utility.electricityQuickAmounts", null);
  const QUICK_AMOUNTS = Array.isArray(quickAmountsSetting) && quickAmountsSetting.length > 0
    ? quickAmountsSetting.map(Number)
    : [1000, 2000, 5000, 10000, 20000];

  const discos = plans["ELECTRICITY"] || [];

  const [selectedDisco, setSelectedDisco] = useState(null);
  const [meterNumber, setMeterNumber] = useState("");
  const [meterType, setMeterType] = useState("PREPAID");
  const [meterValidated, setMeterValidated] = useState(false);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [showPinSheet, setShowPinSheet] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dispatch(fetchPlans({ type: "ELECTRICITY" }));
  }, [dispatch]);

  useEffect(() => {
    if (discos.length && !selectedDisco) setSelectedDisco(discos[0]);
  }, [discos]);

  const handleValidateMeter = async () => {
    if (!meterNumber.trim() || meterNumber.length < 11) { setError("Enter a valid meter number (min 11 digits)"); return; }
    if (!selectedDisco) { setError("Select a disco first"); return; }
    setError("");
    try {
      await dispatch(validateMeter({ meterNumber: meterNumber.trim(), discoId: selectedDisco.providerNetworkId, meterType })).unwrap();
      setMeterValidated(true);
    } catch {
      setError("Could not validate meter. Check the number and try again.");
      setMeterValidated(false);
    }
  };

  const handlePurchase = () => {
    if (!selectedDisco) { setError("Select a disco"); return; }
    if (!meterValidated) { setError("Please validate your meter first"); return; }
    if (!phone.trim() || phone.length < 10) { setError("Enter a valid phone number"); return; }
    if (!amount || Number(amount) < minAmount) { setError(`Minimum electricity payment is ₦${minAmount.toLocaleString()}`); return; }
    if (Number(amount) > Number(balance)) { setError("Insufficient wallet balance"); return; }
    setError("");
    setShowPinSheet(true);
  };

  const handlePinConfirm = async (pin) => {
    await dispatch(payElectricity({
      discoId: selectedDisco.providerNetworkId,
      meterNumber: meterNumber.trim(),
      meterType,
      amount: Number(amount),
      phone: phone.trim(),
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
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>Pay Electricity</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
        {error ? (
          <View style={{ backgroundColor: colors.error + "15", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="alert-circle" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.error, fontWeight: "500" }}>{error}</Text>
          </View>
        ) : null}

        {/* Disco Selection */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 12 }}>Select Distribution Company</Text>
        {isLoading && !discos.length ? (
          <ActivityIndicator color={colors.primary} style={{ marginBottom: 20 }} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
            {discos.map((d) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => { setSelectedDisco(d); setMeterValidated(false); dispatch(clearValidation()); setError(""); }}
                style={{
                  backgroundColor: selectedDisco?.id === d.id ? colors.primary : colors.surface,
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                  marginRight: 8, marginBottom: 8, borderWidth: 2,
                  borderColor: selectedDisco?.id === d.id ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: selectedDisco?.id === d.id ? colors.white : colors.text }}>{d.networkName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Meter Type */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 12 }}>Meter Type</Text>
        <View style={{ flexDirection: "row", marginBottom: 20 }}>
          {["PREPAID", "POSTPAID"].map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => { setMeterType(type); setMeterValidated(false); dispatch(clearValidation()); }}
              style={{
                flex: 1, marginRight: type === "PREPAID" ? 8 : 0,
                backgroundColor: meterType === type ? colors.primary : colors.surface,
                borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 2,
                borderColor: meterType === type ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: meterType === type ? colors.white : colors.text }}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Meter Number */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>Meter Number</Text>
        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, borderWidth: 2, borderColor: meterValidated ? "#22C55E" : colors.border, paddingHorizontal: 16, marginRight: 8 }}>
            <Ionicons name="flash-outline" size={20} color={colors.textMuted} />
            <TextInput
              value={meterNumber}
              onChangeText={(text) => { setMeterNumber(text.replace(/[^0-9]/g, "")); setMeterValidated(false); dispatch(clearValidation()); setError(""); }}
              placeholder="Enter meter number"
              placeholderTextColor={colors.textLight}
              keyboardType="number-pad"
              style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.text, paddingVertical: 16, marginLeft: 12 }}
            />
            {meterValidated && <Ionicons name="checkmark-circle" size={20} color="#22C55E" />}
          </View>
          <TouchableOpacity
            onPress={handleValidateMeter}
            disabled={isValidating}
            style={{ backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }}
          >
            {isValidating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Verify</Text>}
          </TouchableOpacity>
        </View>

        {validationResult && (
          <View style={{ backgroundColor: "#ECFDF5", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: "#059669", fontWeight: "600" }}>
              {validationResult.Customer_Name || validationResult.name || "Meter verified"}
            </Text>
            {validationResult.Address ? <Text style={{ fontSize: 12, color: "#059669", marginTop: 2 }}>{validationResult.Address}</Text> : null}
          </View>
        )}

        {/* Phone */}
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

        {/* Amount */}
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
              style={{ backgroundColor: Number(amount) === value ? colors.primary : colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginRight: 8, marginBottom: 8, borderWidth: 2, borderColor: Number(amount) === value ? colors.primary : colors.border }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: Number(amount) === value ? colors.white : colors.text }}>₦{value.toLocaleString()}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
        title="Confirm Payment"
        subtitle={`₦${Number(amount).toLocaleString()} electricity for meter ${meterNumber}`}
      />
    </SafeAreaView>
  );
}
