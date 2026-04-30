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
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 12 }}>
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 16, fontSize: 16, color: theme.colors.text.secondary }}>Loading order details...</Text>
      </View>
    );
  }

  if (!currentRequest) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.text.secondary} />
        <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8, color: theme.colors.text.primary }}>Order Not Found</Text>
        <Text style={{ fontSize: 14, marginBottom: 24, color: theme.colors.text.secondary }}>Unable to load order details</Text>
        <TouchableOpacity style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: theme.colors.primary }} onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const canCancel = ['REQUESTED', 'ACCEPTED', 'PROCESSING'].includes(currentRequest.status);
  const canRate = ['DELIVERED', 'SETTLED'].includes(currentRequest.status);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600', color: theme.colors.text.primary }}>Order Tracking</Text>
        <TouchableOpacity style={{ padding: 8 }}>
          <Ionicons name="call-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Status Timeline */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text.primary }}>Order Status</Text>
          <View style={{ borderRadius: 12, padding: 16, backgroundColor: theme.colors.surface }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center', color: theme.colors.primary }}>{STATUS_MESSAGES[currentRequest.status] || 'Processing'}</Text>
            <View style={{ paddingLeft: 8 }}>
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <View key={step.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ alignItems: 'center', marginRight: 12 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
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
                          style={{ width: 2, height: 24, marginTop: 4, backgroundColor: index < currentStepIndex ? theme.colors.primary : theme.colors.border }}
                        />
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 14,
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
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text.primary }}>Merchant</Text>
            <View style={{ borderRadius: 12, padding: 16, backgroundColor: theme.colors.surface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="storefront-outline" size={20} color={theme.colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: '600', marginLeft: 12, color: theme.colors.text.primary }}>{currentRequest.merchant.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="location-outline" size={20} color={theme.colors.text.secondary} />
                <Text style={{ fontSize: 14, marginLeft: 12, color: theme.colors.text.secondary }}>{currentRequest.pickupAddress}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Rider Info */}
        {currentRequest.rider && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text.primary }}>Rider</Text>
            <View style={{ borderRadius: 12, padding: 16, backgroundColor: theme.colors.surface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: '600', marginLeft: 12, color: theme.colors.text.primary }}>{currentRequest.rider.user.firstName} {currentRequest.rider.user.lastName}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="call-outline" size={20} color={theme.colors.text.secondary} />
                <Text style={{ fontSize: 14, marginLeft: 12, color: theme.colors.text.secondary }}>{currentRequest.rider.user.phone}</Text>
                <TouchableOpacity
                  style={{ marginLeft: 'auto', padding: 8, borderRadius: 20, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
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
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text.primary }}>Live Tracking</Text>
            <View style={{ height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.background }}>
              <MapView
                style={{ width: '100%', height: '100%' }}
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
                  <View style={{ borderRadius: 12, padding: 8, backgroundColor: theme.colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}>
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
                    <View style={{ borderRadius: 12, padding: 8, backgroundColor: theme.colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}>
                      <Ionicons name="home" size={24} color={theme.colors.error} />
                    </View>
                  </Marker>
                )}
              </MapView>
            </View>
          </View>
        )}

        {/* Order Details */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text.primary }}>Order Details</Text>
          <View style={{ borderRadius: 12, padding: 16, backgroundColor: theme.colors.surface }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>Order ID</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.text.primary }}>#{currentRequest.id.slice(0, 8)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>Total</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.text.primary }}>₦{Number(currentRequest.total).toLocaleString()}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>Delivery Address</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.text.primary }}>{currentRequest.dropoffAddress}</Text>
            </View>
            {currentRequest.specialInstructions && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                <Text style={{ fontSize: 14, color: theme.colors.text.secondary }}>Instructions</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.text.primary }}>{currentRequest.specialInstructions}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={{ marginBottom: 24 }}>
          {canCancel && (
            <TouchableOpacity
              style={{ paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12, backgroundColor: '#EF4444' }}
              onPress={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Cancel Order</Text>
              )}
            </TouchableOpacity>
          )}
          {canRate && (
            <TouchableOpacity
              style={{ paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12, backgroundColor: theme.colors.primary }}
              onPress={() => setShowRatingModal(true)}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Rate Order</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Rating Modal */}
      {showRatingModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ borderRadius: 16, padding: 24, width: '90%', maxWidth: 400, backgroundColor: theme.colors.surface }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center', color: theme.colors.text.primary }}>Rate Your Experience</Text>
            
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16, color: theme.colors.text.primary }}>Merchant Rating</Text>
            {renderStarRating(merchantRating, setMerchantRating)}
            <TextInput
              style={{ borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 16, backgroundColor: theme.colors.background, color: theme.colors.text.primary, borderWidth: 1, borderColor: theme.colors.border }}
              placeholder="Comment about merchant (optional)"
              value={merchantComment}
              onChangeText={setMerchantComment}
            />

            {currentRequest.rider && (
              <>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16, color: theme.colors.text.primary }}>Rider Rating</Text>
                {renderStarRating(riderRating, setRiderRating)}
                <TextInput
                  style={{ borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 16, backgroundColor: theme.colors.background, color: theme.colors.text.primary, borderWidth: 1, borderColor: theme.colors.border }}
                  placeholder="Comment about rider (optional)"
                  value={riderComment}
                  onChangeText={setRiderComment}
                />
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: theme.colors.border }}
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.primary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', backgroundColor: theme.colors.primary }}
                onPress={handleRate}
                disabled={isRating}
              >
                {isRating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Submit</Text>
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
