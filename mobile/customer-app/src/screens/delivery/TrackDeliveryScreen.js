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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textMuted }}>Loading delivery...</Text>
      </View>
    );
  }

  if (error || !delivery) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={{ marginTop: 16, textAlign: 'center', color: colors.text }}>
            {error || "Delivery not found"}
          </Text>
          <TouchableOpacity
            onPress={fetchDelivery}
            style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStep = getCurrentStepIndex();
  const canCancel = ["REQUESTED", "MATCHED"].includes(delivery.status);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
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
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: colors.success, borderColor: colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 }}>
            <Ionicons name="cube" size={16} color={colors.white} />
          </View>
        </Marker>

        {/* Dropoff Marker */}
        <Marker
          coordinate={{ latitude: delivery.dropoffLat, longitude: delivery.dropoffLng }}
          title="Dropoff"
          description={delivery.dropoffAddress}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: colors.primary, borderColor: colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 }}>
            <Ionicons name="flag" size={16} color={colors.white} />
          </View>
        </Marker>

        {/* Rider Marker */}
        {riderLocation && delivery.status !== "DELIVERED" && delivery.status !== "CANCELLED" && (
          <Marker coordinate={riderLocation} title="Rider">
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: colors.dark, borderColor: colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 }}>
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
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, zIndex: 10 }} edges={["top"]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.primary }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.white, textTransform: 'capitalize' }}>{delivery.status.replace("_", " ")}</Text>
        </View>
      </SafeAreaView>

      {/* Bottom Sheet */}
      <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 8 }} edges={["bottom"]}>
        {/* Status Timeline */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentStep;
            const isCurrent = index === currentStep;

            return (
              <View key={step.key} style={{ alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isCompleted ? colors.success : colors.surfaceMuted,
                    borderColor: isCurrent ? colors.primary : "transparent",
                    borderWidth: isCurrent ? 3 : 0,
                  }}
                >
                  {isCompleted && <Ionicons name="checkmark" size={12} color={colors.white} />}
                </View>
                <Text
                  style={{ fontSize: 12, fontWeight: '600', marginTop: 4, color: isCurrent ? colors.text : colors.textMuted }}
                >
                  {step.label}
                </Text>
                {index < STATUS_STEPS.length - 1 && (
                  <View
                    style={{ position: 'absolute', top: 12, right: '50%', left: '50%', height: 2, width: '100%', zIndex: -10, backgroundColor: index < currentStep ? colors.success : colors.border }}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Rider Card (if assigned) */}
        {delivery.rider && delivery.status !== "REQUESTED" && delivery.status !== "CANCELLED" && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: colors.primary }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.white }}>
                  {(delivery.rider.user?.firstName?.[0] || "") +
                    (delivery.rider.user?.lastName?.[0] || "")}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.white }}>
                  {delivery.rider.user?.firstName} {delivery.rider.user?.lastName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={{ marginLeft: 4, fontSize: 12, color: colors.textMuted }}>
                    {delivery.rider.averageRating?.toFixed(1) || "4.5"}
                  </Text>
                  <Text style={{ marginLeft: 12, fontSize: 12, color: colors.textMuted }}>
                    {delivery.rider.vehicleType} • {delivery.rider.plateNumber}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={handleCallRider} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success }}>
              <Ionicons name="call" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Details */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="cube-outline" size={18} color={colors.textMuted} />
            <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: colors.text }}>Order #{delivery.id.slice(-6)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="cash-outline" size={18} color={colors.textMuted} />
            <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: colors.text }}>₦{delivery.fare?.toLocaleString()}</Text>
          </View>
        </View>

        {/* Cancel Button (if eligible) */}
        {canCancel && (
          <TouchableOpacity
            onPress={handleCancel}
            disabled={cancelling}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 14, backgroundColor: colors.error + "15", opacity: cancelling ? 0.6 : 1 }}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Ionicons name="close-circle" size={18} color={colors.error} />
                <Text style={{ marginLeft: 8, fontWeight: '700', fontSize: 16, color: colors.error }}>Cancel Delivery</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Rating Modal (shown on completion) */}
      {showRatingModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 100 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: "center", width: width - 48 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 8, color: colors.text }}>Delivery Complete!</Text>
            <Text style={{ fontSize: 14, marginBottom: 24, textAlign: "center", color: colors.textMuted }}>How was your delivery experience?</Text>
            <TouchableOpacity
              onPress={() => {
                setShowRatingModal(false);
                navigation.replace("RateDelivery", { orderId, riderId: delivery.riderId });
              }}
              style={{ backgroundColor: '#EA580C', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: "center", marginBottom: 12 }}
            >
              <Text style={{ color: colors.white, fontWeight: '800', fontSize: 16 }}>Rate Rider</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowRatingModal(false);
                navigation.goBack();
              }}
              style={{ paddingVertical: 12 }}
            >
              <Text style={{ fontWeight: '600', color: colors.textMuted }}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
