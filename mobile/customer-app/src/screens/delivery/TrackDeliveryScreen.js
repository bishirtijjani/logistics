import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { colors } from "../../theme";
import socketService from "../../services/socket";
import { fetchDeliveryById, updateDeliveryStatus } from "../../store/slices/deliverySlice";

const { width, height } = Dimensions.get("window");

const STATUS_STEPS = [
  { key: "REQUESTED", label: "Requested", icon: "cube-outline" },
  { key: "MATCHED", label: "Matched", icon: "checkmark-circle-outline" },
  { key: "PICKED_UP", label: "Picked Up", icon: "bag-check-outline" },
  { key: "IN_TRANSIT", label: "In Transit", icon: "bicycle-outline" },
  { key: "DELIVERED", label: "Delivered", icon: "flag-outline" },
];

export default function TrackDeliveryScreen({ navigation, route }) {
  const { orderId } = route.params;
  const dispatch = useDispatch();
  const mapRef = useRef(null);

  const [delivery, setDelivery] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [riderLocation, setRiderLocation] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const fetchDelivery = useCallback(async () => {
    try {
      const result = await dispatch(fetchDeliveryById(orderId)).unwrap();
      setDelivery(result);
    } catch (err) {
      setError(err.message || "Failed to load delivery");
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, orderId]);

  useEffect(() => {
    fetchDelivery();
  }, [fetchDelivery]);

  // Socket connection for real-time updates
  useEffect(() => {
    if (!delivery) return;

    // Join delivery room
    socketService.joinDeliveryRoom(orderId);

    // Listen for events
    const unsubscribeStatus = socketService.onDeliveryStatusChanged((data) => {
      if (data.orderId === orderId) {
        setDelivery((prev) => ({ ...prev, status: data.status }));
        if (data.status === "DELIVERED") {
          setShowRatingModal(true);
        }
      }
    });

    const unsubscribeRider = socketService.onRiderLocationUpdate((data) => {
      if (data.orderId === orderId) {
        setRiderLocation({ latitude: data.lat, longitude: data.lng });
      }
    });

    const unsubscribeAssigned = socketService.onRiderAssigned((data) => {
      if (data.orderId === orderId) {
        fetchDelivery(); // Refresh to get rider details
      }
    });

    return () => {
      socketService.leaveDeliveryRoom(orderId);
      unsubscribeStatus?.();
      unsubscribeRider?.();
      unsubscribeAssigned?.();
    };
  }, [delivery?.id, orderId, fetchDelivery]);

  // Fit map to show all markers
  useEffect(() => {
    if (!delivery || !mapRef.current) return;

    const coordinates = [
      { latitude: delivery.pickupLat, longitude: delivery.pickupLng },
      { latitude: delivery.dropoffLat, longitude: delivery.dropoffLng },
    ];

    if (riderLocation) {
      coordinates.push(riderLocation);
    }

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
      animated: true,
    });
  }, [delivery, riderLocation]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await dispatch(
        updateDeliveryStatus({ orderId, status: "CANCELLED", reason: "Customer cancelled" })
      ).unwrap();
      navigation.goBack();
    } catch (err) {
      setError(err.message || "Failed to cancel delivery");
    } finally {
      setCancelling(false);
    }
  };

  const handleCallRider = () => {
    if (delivery?.rider?.user?.phone) {
      Linking.openURL(`tel:${delivery.rider.user.phone}`);
    }
  };

  const getCurrentStepIndex = () => {
    const statusIndex = STATUS_STEPS.findIndex((s) => s.key === delivery?.status);
    return statusIndex >= 0 ? statusIndex : 0;
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4" style={{ color: colors.textMuted }}>Loading delivery...</Text>
      </View>
    );
  }

  if (error || !delivery) {
    return (
      <SafeAreaView className="flex-1 p-5" style={{ backgroundColor: colors.background }} edges={["top"]}>
        <View className="flex-1 justify-center items-center">
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text className="mt-4 text-center" style={{ color: colors.text }}>
            {error || "Delivery not found"}
          </Text>
          <TouchableOpacity
            onPress={fetchDelivery}
            className="mt-5 px-6 py-3 rounded-xl"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-white font-bold" style={{ color: colors.white }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStep = getCurrentStepIndex();
  const canCancel = ["REQUESTED", "MATCHED"].includes(delivery.status);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Map */}
      <MapView
        ref={mapRef}
        className="absolute inset-0"
        merchant={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: delivery.pickupLat,
          longitude: delivery.pickupLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Pickup Marker */}
        <Marker
          coordinate={{ latitude: delivery.pickupLat, longitude: delivery.pickupLng }}
          title="Pickup"
          description={delivery.pickupAddress}
        >
          <View className="w-9 h-9 rounded-full items-center justify-center border-2" style={{ backgroundColor: colors.success, borderColor: colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 }}>
            <Ionicons name="cube" size={16} color={colors.white} />
          </View>
        </Marker>

        {/* Dropoff Marker */}
        <Marker
          coordinate={{ latitude: delivery.dropoffLat, longitude: delivery.dropoffLng }}
          title="Dropoff"
          description={delivery.dropoffAddress}
        >
          <View className="w-9 h-9 rounded-full items-center justify-center border-2" style={{ backgroundColor: colors.primary, borderColor: colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 }}>
            <Ionicons name="flag" size={16} color={colors.white} />
          </View>
        </Marker>

        {/* Rider Marker */}
        {riderLocation && delivery.status !== "DELIVERED" && delivery.status !== "CANCELLED" && (
          <Marker coordinate={riderLocation} title="Rider">
            <View className="w-9 h-9 rounded-full items-center justify-center border-2" style={{ backgroundColor: colors.dark, borderColor: colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 }}>
              <Ionicons name="bicycle" size={16} color={colors.primary} />
            </View>
          </Marker>
        )}

        {/* Route Line */}
        {riderLocation && delivery.status !== "DELIVERED" && (
          <>
            <Polyline
              coordinates={[
                riderLocation,
                { latitude: delivery.pickupLat, longitude: delivery.pickupLng },
              ]}
              strokeColor={colors.textLight}
              strokeWidth={3}
              strokeDasharray={[5, 5]}
            />
            <Polyline
              coordinates={[
                { latitude: delivery.pickupLat, longitude: delivery.pickupLng },
                { latitude: delivery.dropoffLat, longitude: delivery.dropoffLng },
              ]}
              strokeColor={colors.primary}
              strokeWidth={4}
            />
          </>
        )}
      </MapView>

      {/* Top Bar */}
      <SafeAreaView className="absolute top-0 left-0 right-0 flex-row items-center justify-between px-4 pt-2 z-10" edges={["top"]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-sm"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.primary }}>
          <Text className="text-xs font-bold text-white capitalize" style={{ color: colors.white }}>{delivery.status.replace("_", " ")}</Text>
        </View>
      </SafeAreaView>

      {/* Bottom Sheet */}
      <SafeAreaView className="absolute bottom-0 left-0 right-0 bg-white rounded-t-6 px-5 pt-5 pb-4 shadow-lg" edges={["bottom"]}>
        {/* Status Timeline */}
        <View className="flex-row justify-between mb-5">
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentStep;
            const isCurrent = index === currentStep;

            return (
              <View key={step.key} className="items-center flex-1">
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center ${isCurrent ? 'border-3' : ''}`}
                  style={{
                    backgroundColor: isCompleted ? colors.success : colors.surfaceMuted,
                    borderColor: isCurrent ? colors.primary : "transparent",
                    borderWidth: isCurrent ? 3 : 0,
                  }}
                >
                  {isCompleted && <Ionicons name="checkmark" size={12} color={colors.white} />}
                </View>
                <Text
                  className="text-xs font-semibold mt-1"
                  style={{ color: isCurrent ? colors.text : colors.textMuted }}
                >
                  {step.label}
                </Text>
                {index < STATUS_STEPS.length - 1 && (
                  <View
                    className="absolute top-3 right-1/2 left-1/2 h-0.5 w-full -z-10"
                    style={{ backgroundColor: index < currentStep ? colors.success : colors.border }}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Rider Card (if assigned) */}
        {delivery.rider && delivery.status !== "REQUESTED" && delivery.status !== "CANCELLED" && (
          <View className="flex-row items-center bg-gray-900 rounded-xl p-4 mb-4">
            <View className="flex-1 flex-row items-center">
              <View className="w-12 h-12 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.primary }}>
                <Text className="text-lg font-extrabold" style={{ color: colors.white }}>
                  {(delivery.rider.user?.firstName?.[0] || "") +
                    (delivery.rider.user?.lastName?.[0] || "")}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold" style={{ color: colors.white }}>
                  {delivery.rider.user?.firstName} {delivery.rider.user?.lastName}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text className="ml-1 text-xs" style={{ color: colors.textMuted }}>
                    {delivery.rider.averageRating?.toFixed(1) || "4.5"}
                  </Text>
                  <Text className="ml-3 text-xs" style={{ color: colors.textMuted }}>
                    {delivery.rider.vehicleType} • {delivery.rider.plateNumber}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={handleCallRider} className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: colors.success }}>
              <Ionicons name="call" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Details */}
        <View className="bg-white rounded-xl p-4 mb-3">
          <View className="flex-row items-center mb-2">
            <Ionicons name="cube-outline" size={18} color={colors.textMuted} />
            <Text className="ml-2 text-sm font-semibold" style={{ color: colors.text }}>Order #{delivery.id.slice(-6)}</Text>
          </View>
          <View className="flex-row items-center mb-2">
            <Ionicons name="cash-outline" size={18} color={colors.textMuted} />
            <Text className="ml-2 text-sm font-semibold" style={{ color: colors.text }}>₦{delivery.fare?.toLocaleString()}</Text>
          </View>
        </View>

        {/* Cancel Button (if eligible) */}
        {canCancel && (
          <TouchableOpacity
            onPress={handleCancel}
            disabled={cancelling}
            className={`flex-row items-center justify-center rounded-xl py-3.5 ${cancelling ? 'opacity-60' : ''}`}
            style={{ backgroundColor: colors.error + "15" }}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Ionicons name="close-circle" size={18} color={colors.error} />
                <Text className="ml-2 font-bold text-base" style={{ color: colors.error }}>Cancel Delivery</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Rating Modal (shown on completion) */}
      {showRatingModal && (
        <View className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 100 }}>
          <View className="bg-white rounded-3xl p-6 items-center" style={{ width: width - 48 }}>
            <Text className="text-xl font-extrabold mb-2" style={{ color: colors.text }}>Delivery Complete!</Text>
            <Text className="text-sm mb-6 text-center" style={{ color: colors.textMuted }}>How was your delivery experience?</Text>
            <TouchableOpacity
              onPress={() => {
                setShowRatingModal(false);
                navigation.replace("RateDelivery", { orderId, riderId: delivery.riderId });
              }}
              className="bg-orange-600 rounded-xl py-4 px-8 w-full items-center mb-3"
            >
              <Text className="text-white font-extrabold text-base" style={{ color: colors.white }}>Rate Rider</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowRatingModal(false);
                navigation.goBack();
              }}
              className="py-3"
            >
              <Text className="font-semibold" style={{ color: colors.textMuted }}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
