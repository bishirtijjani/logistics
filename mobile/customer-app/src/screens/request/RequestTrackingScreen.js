/**
 * RequestTrackingScreen — Unified request tracking with status timeline
 * Displays request progress, merchant/rider info, and actions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import socketService from '../../services/socket';
import theme from '../../theme';
import { fetchRequestById, cancelRequest, rateRequest, updateRequestFromSocket, updateRiderLocationFromSocket } from '../../store/slices/requestSlice';

const STATUS_STEPS = [
  { key: 'REQUESTED', label: 'Order Placed', icon: 'receipt-outline' },
  { key: 'ACCEPTED', label: 'Merchant Accepted', icon: 'storefront-outline' },
  { key: 'PROCESSING', label: 'Preparing', icon: 'restaurant-outline' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup', icon: 'cube-outline' },
  { key: 'RIDER_ASSIGNED', label: 'Rider Assigned', icon: 'person-outline' },
  { key: 'RIDER_EN_ROUTE', label: 'Rider En Route', icon: 'bicycle-outline' },
  { key: 'PICKED_UP', label: 'Picked Up', icon: 'checkmark-circle-outline' },
  { key: 'IN_TRANSIT', label: 'In Transit', icon: 'navigate-outline' },
  { key: 'DELIVERED', label: 'Delivered', icon: 'home-outline' },
  { key: 'SETTLED', label: 'Completed', icon: 'checkmark-done-circle-outline' },
];

const STATUS_MESSAGES = {
  REQUESTED: 'Waiting for merchant acceptance',
  ACCEPTED: 'Merchant is preparing your order',
  PROCESSING: 'Your order is being prepared',
  READY_FOR_PICKUP: 'Order ready, waiting for rider',
  RIDER_ASSIGNED: 'Rider assigned, on the way to pickup',
  RIDER_EN_ROUTE: 'Rider is on the way to you',
  PICKED_UP: 'Rider has picked up your order',
  IN_TRANSIT: 'Order is on the way',
  DELIVERED: 'Order delivered',
  SETTLED: 'Order completed',
  CANCELLED: 'Order cancelled',
};

const RequestTrackingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { requestId } = route.params;
  const { currentRequest, isLoading } = useSelector((state) => state.request);
  const [merchantRating, setMerchantRating] = useState(5);
  const [riderRating, setRiderRating] = useState(5);
  const [merchantComment, setMerchantComment] = useState('');
  const [riderComment, setRiderComment] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRating, setIsRating] = useState(false);

  useEffect(() => {
    socketService.joinRequestRoom(requestId);

    // Listen for socket events
    const unsubscribeStatus = socketService.onRequestStatusChanged((data) => {
      dispatch(updateRequestFromSocket(data));
    });

    const unsubscribeRiderAssigned = socketService.onRequestRiderAssigned((data) => {
      dispatch(updateRequestFromSocket(data));
    });

    const unsubscribeRiderLocation = socketService.onRequestRiderLocation((data) => {
      dispatch(updateRiderLocationFromSocket(data));
    });

    const unsubscribeCompleted = socketService.onRequestCompleted((data) => {
      dispatch(updateRequestFromSocket(data));
    });

    const unsubscribeCancelled = socketService.onRequestCancelled((data) => {
      dispatch(updateRequestFromSocket(data));
    });

    // Cleanup on unmount
    return () => {
      socketService.leaveRequestRoom(requestId);
      unsubscribeStatus();
      unsubscribeRiderAssigned();
      unsubscribeRiderLocation();
      unsubscribeCompleted();
      unsubscribeCancelled();
    };
  }, [dispatch, requestId]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? You will receive a refund.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(cancelRequest({ requestId, reason: 'Customer cancelled' })).unwrap();
              Toast.show({
                type: 'success',
                text1: 'Order Cancelled',
                text2: 'Your order has been cancelled and refunded',
              });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Cancellation Failed',
                text2: error.message || 'Failed to cancel order',
              });
            }
          },
        },
      ]
    );
  };

  const handleCall = (phoneNumber) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch((err) => {
      console.error('Error making call:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Unable to make call',
      });
    });
  };

  const handleRate = async () => {
    try {
      await dispatch(
        rateRequest({
          requestId,
          ratingData: {
            merchantScore: merchantRating,
            riderScore: currentRequest.rider ? riderRating : null,
            merchantComment,
            riderComment: currentRequest.rider ? riderComment : null,
          },
        })
      ).unwrap();
      setShowRatingModal(false);
      Toast.show({
        type: 'success',
        text1: 'Thank You!',
        text2: 'Your rating has been submitted',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Rating Failed',
        text2: error.message || 'Failed to submit rating',
      });
    }
  };

  const getCurrentStepIndex = () => {
    if (!currentRequest) return -1;
    return STATUS_STEPS.findIndex((step) => step.key === currentRequest.status);
  };

  const calculateETA = (distanceKm) => {
    const avgSpeed = 20; // km/h
    const minutes = (distanceKm / avgSpeed) * 60;
    if (minutes < 60) return `${Math.round(minutes)} min`;
    return `${Math.round(minutes / 60)} hr`;
  };

  const renderStarRating = (rating, setRating) => {
    return (
      <View className="flex-row justify-center mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setRating(star)}>
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={28}
              color={star <= rating ? '#FFA500' : theme.colors.border}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text className="mt-4 text-base" style={{ color: theme.colors.text.secondary }}>Loading order details...</Text>
      </View>
    );
  }

  if (!currentRequest) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.text.secondary} />
        <Text className="text-lg font-semibold mt-4 mb-2" style={{ color: theme.colors.text.primary }}>Order Not Found</Text>
        <Text className="text-sm mb-6" style={{ color: theme.colors.text.secondary }}>Unable to load order details</Text>
        <TouchableOpacity className="px-6 py-3 rounded-lg" style={{ backgroundColor: theme.colors.primary }} onPress={() => navigation.goBack()}>
          <Text className="text-sm font-semibold text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const canCancel = ['REQUESTED', 'ACCEPTED', 'PROCESSING'].includes(currentRequest.status);
  const canRate = ['DELIVERED', 'SETTLED'].includes(currentRequest.status);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }} edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-4" style={{ backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>Order Tracking</Text>
        <TouchableOpacity className="p-2">
          <Ionicons name="call-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Status Timeline */}
        <View className="mb-6">
          <Text className="text-base font-semibold mb-3" style={{ color: theme.colors.text.primary }}>Order Status</Text>
          <View className="rounded-xl p-4" style={{ backgroundColor: theme.colors.surface }}>
            <Text className="text-lg font-bold mb-5 text-center" style={{ color: theme.colors.primary }}>{STATUS_MESSAGES[currentRequest.status] || 'Processing'}</Text>
            <View className="pl-2">
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <View key={step.key} className="flex-row items-center mb-4">
                    <View className="items-center mr-3">
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{
                          backgroundColor: isCompleted ? theme.colors.primary : theme.colors.border,
                          borderWidth: isCurrent ? 2 : 0,
                          borderColor: isCurrent ? theme.colors.primary + '40' : undefined,
                        }}
                      >
                        <Ionicons
                          name={step.icon}
                          size={16}
                          color={isCompleted ? '#fff' : theme.colors.text.secondary}
                        />
                      </View>
                      {index < STATUS_STEPS.length - 1 && (
                        <View
                          className="w-0.5 h-6 mt-1"
                          style={{ backgroundColor: index < currentStepIndex ? theme.colors.primary : theme.colors.border }}
                        />
                      )}
                    </View>
                    <Text
                      className="text-sm"
                      style={{
                        color: isCompleted ? theme.colors.text.primary : theme.colors.text.secondary,
                        fontWeight: isCompleted ? '500' : 'normal',
                      }}
                    >
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Merchant Info */}
        {currentRequest.merchant && (
          <View className="mb-6">
            <Text className="text-base font-semibold mb-3" style={{ color: theme.colors.text.primary }}>Merchant</Text>
            <View className="rounded-xl p-4" style={{ backgroundColor: theme.colors.surface }}>
              <View className="flex-row items-center mb-3">
                <Ionicons name="storefront-outline" size={20} color={theme.colors.primary} />
                <Text className="text-sm font-semibold ml-3" style={{ color: theme.colors.text.primary }}>{currentRequest.merchant.name}</Text>
              </View>
              <View className="flex-row items-center mb-3">
                <Ionicons name="location-outline" size={20} color={theme.colors.text.secondary} />
                <Text className="text-sm ml-3" style={{ color: theme.colors.text.secondary }}>{currentRequest.pickupAddress}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Rider Info */}
        {currentRequest.rider && (
          <View className="mb-6">
            <Text className="text-base font-semibold mb-3" style={{ color: theme.colors.text.primary }}>Rider</Text>
            <View className="rounded-xl p-4" style={{ backgroundColor: theme.colors.surface }}>
              <View className="flex-row items-center mb-3">
                <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
                <Text className="text-sm font-semibold ml-3" style={{ color: theme.colors.text.primary }}>{currentRequest.rider.user.firstName} {currentRequest.rider.user.lastName}</Text>
              </View>
              <View className="flex-row items-center mb-3">
                <Ionicons name="call-outline" size={20} color={theme.colors.text.secondary} />
                <Text className="text-sm ml-3" style={{ color: theme.colors.text.secondary }}>{currentRequest.rider.user.phone}</Text>
                <TouchableOpacity
                  className="ml-auto p-2 rounded-full"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
                  onPress={() => handleCall(currentRequest.rider.user.phone)}
                >
                  <Ionicons name="call" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Map with Rider Location */}
        {currentRequest.rider && currentRequest.riderLocation && (
          <View className="mb-6">
            <Text className="text-base font-semibold mb-3" style={{ color: theme.colors.text.primary }}>Live Tracking</Text>
            <View className="h-50 rounded-xl overflow-hidden" style={{ backgroundColor: theme.colors.background }}>
              <MapView
                className="w-full h-full"
                initialRegion={{
                  latitude: currentRequest.riderLocation.lat,
                  longitude: currentRequest.riderLocation.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: currentRequest.riderLocation.lat,
                    longitude: currentRequest.riderLocation.lng,
                  }}
                  title="Rider"
                  description={`${currentRequest.rider.user.firstName} ${currentRequest.rider.user.lastName}`}
                >
                  <View className="rounded-xl p-2" style={{ backgroundColor: theme.colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}>
                    <Ionicons name="bicycle" size={24} color={theme.colors.primary} />
                  </View>
                </Marker>
                {currentRequest.dropoffLat && currentRequest.dropoffLng && (
                  <Marker
                    coordinate={{
                      latitude: currentRequest.dropoffLat,
                      longitude: currentRequest.dropoffLng,
                    }}
                    title="Destination"
                    description={currentRequest.dropoffAddress}
                  >
                    <View className="rounded-xl p-2" style={{ backgroundColor: theme.colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}>
                      <Ionicons name="home" size={24} color={theme.colors.error} />
                    </View>
                  </Marker>
                )}
              </MapView>
            </View>
          </View>
        )}

        {/* Order Details */}
        <View className="mb-6">
          <Text className="text-base font-semibold mb-3" style={{ color: theme.colors.text.primary }}>Order Details</Text>
          <View className="rounded-xl p-4" style={{ backgroundColor: theme.colors.surface }}>
            <View className="flex-row justify-between py-2" style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>Order ID</Text>
              <Text className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>#{currentRequest.id.slice(0, 8)}</Text>
            </View>
            <View className="flex-row justify-between py-2" style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>Total</Text>
              <Text className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>₦{Number(currentRequest.total).toLocaleString()}</Text>
            </View>
            <View className="flex-row justify-between py-2" style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>Delivery Address</Text>
              <Text className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>{currentRequest.dropoffAddress}</Text>
            </View>
            {currentRequest.specialInstructions && (
              <View className="flex-row justify-between py-2" style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>Instructions</Text>
                <Text className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>{currentRequest.specialInstructions}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        <View className="mb-6">
          {canCancel && (
            <TouchableOpacity
              className="py-4 rounded-xl items-center mb-3"
              style={{ backgroundColor: '#EF4444' }}
              onPress={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">Cancel Order</Text>
              )}
            </TouchableOpacity>
          )}
          {canRate && (
            <TouchableOpacity
              className="py-4 rounded-xl items-center mb-3"
              style={{ backgroundColor: theme.colors.primary }}
              onPress={() => setShowRatingModal(true)}
            >
              <Text className="text-base font-semibold text-white">Rate Order</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Rating Modal */}
      {showRatingModal && (
        <View className="absolute top-0 left-0 right-0 bottom-0" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View className="rounded-2xl p-6 w-[90%] max-w-[400px]" style={{ backgroundColor: theme.colors.surface }}>
            <Text className="text-lg font-bold mb-5 text-center" style={{ color: theme.colors.text.primary }}>Rate Your Experience</Text>
            
            <Text className="text-sm font-semibold mb-2 mt-4" style={{ color: theme.colors.text.primary }}>Merchant Rating</Text>
            {renderStarRating(merchantRating, setMerchantRating)}
            <TextInput
              className="rounded-lg p-3 text-sm mb-4"
              style={{ backgroundColor: theme.colors.background, color: theme.colors.text.primary, borderWidth: 1, borderColor: theme.colors.border }}
              placeholder="Comment about merchant (optional)"
              value={merchantComment}
              onChangeText={setMerchantComment}
            />

            {currentRequest.rider && (
              <>
                <Text className="text-sm font-semibold mb-2 mt-4" style={{ color: theme.colors.text.primary }}>Rider Rating</Text>
                {renderStarRating(riderRating, setRiderRating)}
                <TextInput
                  className="rounded-lg p-3 text-sm mb-4"
                  style={{ backgroundColor: theme.colors.background, color: theme.colors.text.primary, borderWidth: 1, borderColor: theme.colors.border }}
                  placeholder="Comment about rider (optional)"
                  value={riderComment}
                  onChangeText={setRiderComment}
                />
              </>
            )}

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                className="flex-1 py-3 rounded-lg items-center"
                style={{ backgroundColor: theme.colors.border }}
                onPress={() => setShowRatingModal(false)}
              >
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text.primary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-lg items-center"
                style={{ backgroundColor: theme.colors.primary }}
                onPress={handleRate}
                disabled={isRating}
              >
                {isRating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-sm font-semibold text-white">Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default RequestTrackingScreen;
