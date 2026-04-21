import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { colors } from "../../theme";
import PinBottomSheet from "../../components/PinBottomSheet";
import { createDelivery } from "../../store/slices/deliverySlice";

const PACKAGE_SIZES = [
  { id: "SMALL", label: "Small", icon: "cube-outline", description: "Documents, small items" },
  { id: "MEDIUM", label: "Medium", icon: "briefcase-outline", description: "Groceries, boxes" },
  { id: "LARGE", label: "Large", icon: "bicycle-outline", description: "Furniture, bulk items" },
];

export default function CreateDeliveryScreen({ navigation }) {
  const dispatch = useDispatch();
  const { balance } = useSelector((state) => state.wallet);

  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [packageSize, setPackageSize] = useState("SMALL");
  const [itemDescription, setItemDescription] = useState("");
  const [estimate, setEstimate] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPinSheet, setShowPinSheet] = useState(false);
  const [error, setError] = useState("");

  // Get fare estimate when both locations are set
  const getEstimate = useCallback(async () => {
    if (!pickup || !dropoff) return;

    setIsEstimating(true);
    setError("");

    try {
      const { default: api } = await import("../../services/api");
      const { data } = await api.get("/delivery/estimate", {
        params: {
          pickupLat: pickup.latitude,
          pickupLng: pickup.longitude,
          dropoffLat: dropoff.latitude,
          dropoffLng: dropoff.longitude,
        },
      });

      if (data.success) {
        setEstimate(data.data);
      }
    } catch (err) {
      setError("Unable to calculate fare. Please try again.");
    } finally {
      setIsEstimating(false);
    }
  }, [pickup, dropoff]);

  // Request estimate when locations change
  React.useEffect(() => {
    if (pickup && dropoff) {
      getEstimate();
    }
  }, [pickup, dropoff, getEstimate]);

  const handleLocationSelect = (type) => {
    navigation.navigate("LocationPicker", {
      onSelect: (location) => {
        if (type === "pickup") {
          setPickup(location);
        } else {
          setDropoff(location);
        }
      },
    });
  };

  const handleCreateOrder = () => {
    if (!pickup || !dropoff) {
      setError("Please select pickup and dropoff locations");
      return;
    }
    if (!itemDescription.trim()) {
      setError("Please describe the item(s) being delivered");
      return;
    }
    if (!estimate) {
      setError("Unable to calculate fare. Please try again.");
      return;
    }
    if (Number(balance) < estimate.fare) {
      setError(`Insufficient balance. Delivery costs ₦${estimate.fare.toLocaleString()}`);
      return;
    }

    setShowPinSheet(true);
  };

  const handlePinConfirm = async (pin) => {
    setShowPinSheet(false);
    setIsCreating(true);

    try {
      const orderData = {
        pickupAddress: pickup.address,
        pickupLat: pickup.latitude,
        pickupLng: pickup.longitude,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.latitude,
        dropoffLng: dropoff.longitude,
        itemDescription: itemDescription.trim(),
        packageSize,
      };

      const result = await dispatch(createDelivery({ orderData, pin })).unwrap();

      // Navigate to tracking screen
      navigation.replace("TrackDelivery", { orderId: result.id });
    } catch (err) {
      setError(err.message || "Failed to create delivery. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const renderLocationCard = (type, location, icon) => (
    <TouchableOpacity
      onPress={() => handleLocationSelect(type)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: location ? colors.success : colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: location ? colors.success + "20" : colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons
            name={location ? "checkmark" : icon}
            size={20}
            color={location ? colors.success : colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 4 }}>
            {type === "pickup" ? "Pickup Location" : "Dropoff Location"}
          </Text>
          {location ? (
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }} numberOfLines={2}>
              {location.address}
            </Text>
          ) : (
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.primary }}>
              Tap to select location
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text }}>New Delivery</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
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

          {/* Locations */}
          {renderLocationCard("pickup", pickup, "locate-outline")}
          {renderLocationCard("dropoff", dropoff, "location-outline")}

          {/* Package Size */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginTop: 8, marginBottom: 12 }}>
            Package Size
          </Text>
          <View style={{ flexDirection: "row", marginBottom: 20 }}>
            {PACKAGE_SIZES.map((size) => (
              <TouchableOpacity
                key={size.id}
                onPress={() => setPackageSize(size.id)}
                style={{
                  flex: 1,
                  backgroundColor: packageSize === size.id ? colors.primary : colors.surface,
                  borderRadius: 14,
                  padding: 12,
                  marginRight: size.id !== "LARGE" ? 8 : 0,
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: packageSize === size.id ? colors.primary : colors.border,
                }}
              >
                <Ionicons
                  name={size.icon}
                  size={24}
                  color={packageSize === size.id ? colors.white : colors.text}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: packageSize === size.id ? colors.white : colors.text,
                    marginTop: 6,
                  }}
                >
                  {size.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Item Description */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 8 }}>
            Item Description
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: colors.border,
              padding: 12,
              marginBottom: 20,
            }}
          >
            <TextInput
              value={itemDescription}
              onChangeText={setItemDescription}
              placeholder="What are you sending? (e.g., Documents, groceries)"
              placeholderTextColor={colors.textLight}
              multiline
              numberOfLines={3}
              style={{
                fontSize: 15,
                color: colors.text,
                fontWeight: "500",
                minHeight: 60,
                textAlignVertical: "top",
              }}
            />
          </View>

          {/* Fare Estimate */}
          {isEstimating ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 20,
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ marginTop: 8, fontSize: 13, color: colors.textMuted }}>
                Calculating fare...
              </Text>
            </View>
          ) : estimate ? (
            <View
              style={{
                backgroundColor: colors.primary + "10",
                borderRadius: 16,
                padding: 20,
                borderWidth: 2,
                borderColor: colors.primary + "30",
                marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>Distance</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                  {estimate.distanceKm} km
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>Est. Time</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                  ~{estimate.estimatedTimeMinutes} mins
                </Text>
              </View>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Total Fare</Text>
                <Text style={{ fontSize: 24, fontWeight: "900", color: colors.primary }}>
                  ₦{estimate.fare.toLocaleString()}
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
            onPress={handleCreateOrder}
            disabled={isCreating || isEstimating || !estimate}
            style={{
              backgroundColor: isCreating || isEstimating || !estimate ? colors.textLight : colors.primary,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={{ color: colors.white, fontSize: 16, fontWeight: "800" }}>
                {estimate ? `Request Delivery • ₦${estimate.fare.toLocaleString()}` : "Request Delivery"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* PIN Bottom Sheet */}
      <PinBottomSheet
        isVisible={showPinSheet}
        onClose={() => setShowPinSheet(false)}
        onConfirm={handlePinConfirm}
        title="Confirm Delivery"
        subtitle={`You will be charged ₦${estimate?.fare?.toLocaleString() || 0} for this delivery`}
      />
    </SafeAreaView>
  );
}
