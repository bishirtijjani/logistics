/**
 * RequestTrackingScreen — Unified request tracking with status timeline
 * Displays request progress, provider/rider info, and actions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
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
  { key: 'ACCEPTED', label: 'Provider Accepted', icon: 'storefront-outline' },
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
  REQUESTED: 'Waiting for provider acceptance',
  ACCEPTED: 'Provider is preparing your order',
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

d   socketService.joinRequestRoom(requestId);

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
            providerScore: providerRating,
            riderScore: currentRequest.rider ? riderRating : null,
            providerComment,
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

  const renderStarRating = (rating, setRating) => {
    return (
      <View style={styles.starContainer}>
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (!currentRequest) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.text.secondary} />
        <Text style={styles.errorTitle}>Order Not Found</Text>
        <Text style={styles.errorText}>Unable to load order details</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const canCancel = ['REQUESTED', 'ACCEPTED', 'PROCESSING'].includes(currentRequest.status);
  const canRate = ['DELIVERED', 'SETTLED'].includes(currentRequest.status);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="call-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Status</Text>
          <View style={styles.statusCard}>
            <Text style={styles.statusMessage}>{STATUS_MESSAGES[currentRequest.status] || 'Processing'}</Text>
            <View style={styles.timeline}>
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <View key={step.key} style={styles.timelineStep}>
                    <View style={styles.timelineIconContainer}>
                      <Vi
         ewutton}
          onPress={() => {
            if (currentRequest.rider?.user?.phone) {
              handleCall(currentRequest.rider.user.phone);
            } else if (currentRequest.provider?.phone) {
              handleCall(crrenReques.provider.phe);
            }
          }
        
                        style={[
                          styles.timelineIcon,
                          isCompleted && styles.timelineIconCompleted,
                          isCurrent && styles.timelineIconCurrent,
                        ]}
                      >
                        <Ionicons
                          name={step.icon}
                          size={16}
                          color={isCompleted ? '#fff' : theme.colors.text.secondary}
                        />
                      </View>
                      {index < STATUS_STEPS.length - 1 && (
                        <View
                          style={[
                            styles.timelineLine,
                            index < currentStepIndex && styles.timelineLineCompleted,
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.timelineLabel,
                        isCompleted && styles.timelineLabelCompleted,
                        isCurrent && styles.timelineLabelCurrent,
                      ]}
                    >
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Provider Info */}
        {currentRequest.provider && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Provider</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="storefront-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.infoLabel}>{currentRequest.provider.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={20} color={theme.colors.text.secondary} />
                <Text style={styles.infoValue}>{currentRequest.pickupAddress}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Rider Info */}
        {currentRequest.rider && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rider</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.infoLabel}>{currentRequest.rider.user.firstName} {currentRequest.rider.user.lastName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={20} color={theme.colors.text.secondary} />
                <Text style={styles.infoValue}>{currentRequest.rider.user.phone}</Text>
                <TouchableOpacity
                  style={styles.callButton}
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Live Tracking</Text>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: currentRequest.riderLocation.lat,
                  longitude: currentRequest.riderLocation.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >()}</Text>
            </View>
            {currentRequest.distanceKm && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Distance</Text>
                <Text style={styles.detailValue}>{currentRequest.distanceKm.toFixed(1)} km</Text>
              </View>
            )}
            {currentRequest.distanceKm && calculateETA(currentRequest.distanceKm) && 
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Estimated Time</Text>
                <Text style={styles.detailValue}>{calculateETA(currentRequest.distanceKm min
                  {/*
            )} Rider marker */}
                <Marker
                  coordinate={{
                    latitude: currentRequest.riderLocation.lat,
                    longitude: currentRequest.riderLocation.lng,
                  }}
                  title="Rider"
                  description={`${currentRequest.rider.user.firstName} ${currentRequest.rider.user.lastName}`}
                >
                  <View style={styles.markerContainer}>
                    <Ionicons name="bicycle" size={24} color={theme.colors.primary} />
                  </View>
                </Marker>
                {/* Destination marker */}
                {currentRequest.dropoffLat && currentRequest.dropoffLng && (
                  <Marker
                    coordinate={{
                      latitude: currentRequest.dropoffLat,
                      longitude: currentRequest.dropoffLng,
                    }}
                    title="Destination"
                    description={currentRequest.dropoffAddress}
                  >
                    <View style={styles.markerContainer}>
                      <Ionicons name="home" size={24} color={theme.colors.error} />
                    </View>
                  </Marker>
                )}
              </MapView>
            </View>
          </View>
        )}

        {/* Order Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          <View style={styles.infoCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Order ID</Text>
              <Text style={styles.detailValue}>#{currentRequest.id.slice(0, 8)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total</Text>
              <Text style={styles.detailValue}>₦{Number(currentRequest.total).toLocaleString()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Delivery Address</Text>
              <Text style={styles.detailValue}>{currentRequest.dropoffAddress}</Text>
            </View>
            {currentRequest.specialInstructions && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Instructions</Text>
                <Text style={styles.detailValue}>{currentRequest.specialInstructions}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          {canCancel && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel Order</Text>
              )}
            </TouchableOpacity>
          )}
          {canRate && (
            <TouchableOpacity
              style={[styles.actionButton, styles.rateButton]}
              onPress={() => setShowRatingModal(true)}
            >
              <Text style={styles.rateButtonText}>Rate Order</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Rating Modal */}
      {showRatingModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rate Your Experience</Text>
            
            <Text style={styles.ratingLabel}>Provider Rating</Text>
            {renderStarRating(providerRating, setProviderRating)}
            <TextInput
              style={styles.commentInput}
              placeholder="Comment about provider (optional)"
              value={providerComment}
              onChangeText={setProviderComment}
            />

            {currentRequest.rider && (
              <>
                <Text style={styles.ratingLabel}>Rider Rating</Text>
                {renderStarRating(riderRating, setRiderRating)}
                <TextInput
                  style={styles.commentInput}
                  placeholder="Comment about rider (optional)"
                  value={riderComment}
                  onChangeText={setRiderComment}
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={handleRate}
                disabled={isRating}
              >
                {isRating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  statusMessage: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconCompleted: {
    backgroundColor: theme.colors.primary,
  },
  timelineIconCurrent: {
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.primary + '40',
  },
  timelineLine: {
    width: 2,
    height: 24,
    backgroundColor: theme.colors.border,
    marginTop: 4,
  },
  timelineLineCompleted: {
    backgroundColor: theme.colors.primary,
  },
  timelineLabel: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  timelineLabelCompleted: {
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  timelineLabelCurrent: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginLeft: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  rateButton: {
    backgroundColor: theme.colors.primary,
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  starContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  commentInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  modalButtonConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  callButton: {
    marginLeft: 'auto',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
