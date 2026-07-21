/**
 * RequestTrackingScreen - unified request tracking.
 *
 * Phase 4 features:
 *   - Status timeline (10 states + cancelled)
 *   - Searching-state UI with attempt counter
 *   - Live ETA chip refreshed by `request:rider:eta` socket
 *   - Polyline drawn from GET /requests/:id/route (decoded inline)
 *   - Cancel-with-fee preview modal (server-driven policy)
 *   - Call sender/recipient/merchant buttons
 *   - In-app chat sheet
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { goBackOr } from "../../lib/goBack";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import socketService from '../../services/socket';
import { useTheme } from '../../theme';
import {
  fetchRequestById,
  fetchActiveRoute,
  fetchCancellationQuote,
  cancelRequest,
  fetchMessages,
  postMessage,
  updateRequestFromSocket,
  updateRiderLocationFromSocket,
  setMatchingStatus,
  setRiderEta,
  appendMessageFromSocket,
  clearTrackingState,
} from '../../store/slices/requestSlice';
import { statusTimeline, statusDisplay, statusToneColors, STATUS, isActive, substitutionLabel } from '../../lib/requestStatus';
import { decodePolyline } from '../../lib/polyline';

const STEP_ICON = {
  [STATUS.REQUESTED]:        'receipt-outline',
  [STATUS.ACCEPTED]:         'storefront-outline',
  [STATUS.PROCESSING]:       'restaurant-outline',
  [STATUS.READY_FOR_PICKUP]: 'cube-outline',
  [STATUS.RIDER_ASSIGNED]:   'person-outline',
  [STATUS.RIDER_EN_ROUTE]:   'bicycle-outline',
  [STATUS.PICKED_UP]:        'checkmark-circle-outline',
  [STATUS.IN_TRANSIT]:       'navigate-outline',
  [STATUS.DELIVERED]:        'home-outline',
  [STATUS.SETTLED]:          'checkmark-done-circle-outline',
};

const money = (n) => `₦${Number(n || 0).toLocaleString()}`;

const formatEta = (seconds) => {
  if (seconds == null) return '-';
  if (seconds < 60) return '<1 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `~${h}h` : `~${h}h ${m}m`;
};

// REQUESTED means different things by type: PACKAGE deliveries start rider
// matching immediately at creation, so REQUESTED there really is "searching
// for a rider". MERCHANT_ORDER matching is deferred until the merchant marks
// the order ready (READY_FOR_PICKUP) - REQUESTED there just means "waiting
// for the merchant to accept", which used to render the identical "searching
// for a rider" banner. That was misleading (nobody is searching for a rider
// yet) and implied an auto-cancel timer that doesn't actually run at this
// stage for merchant orders - see the separate "awaiting merchant" banner below.
const RIDER_SEARCH_STATUSES = new Set([STATUS.READY_FOR_PICKUP]);
const ACTIVE_TRACK_STATUSES = new Set([
  STATUS.RIDER_ASSIGNED,
  STATUS.RIDER_EN_ROUTE,
  STATUS.PICKED_UP,
  STATUS.IN_TRANSIT,
]);

const RequestTrackingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens, isDark } = useTheme();
  const { requestId } = route.params;
  const {
    currentRequest, isLoading,
    route: activeRoute, matchingStatus, riderEta, messages,
  } = useSelector((state) => state.request);

  // Phase 5 - POD OTP banner. The rider taps "Send code" → the customer
  // gets a `notification:new` with `type=POD_OTP_GENERATED` carrying
  // `data.otp`. We surface the latest such notification for THIS request
  // as a prominent banner so the customer can read the code aloud at the
  // doorstep. Cleared automatically once the trip is DELIVERED.
  const podOtpFromNotifications = useSelector((state) => {
    const list = state.notifications?.list || [];
    for (const n of list) {
      if (n.type !== 'POD_OTP_GENERATED') continue;
      if (n.requestId && n.requestId !== requestId) continue;
      if (n.data?.requestId && n.data.requestId !== requestId) continue;
      const otp = n.data?.otp || n.otp;
      if (otp) return String(otp);
    }
    return null;
  });

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelQuote, setCancelQuote] = useState(null);
  const [cancelQuoteLoading, setCancelQuoteLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [chatVisible, setChatVisible] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatListRef = useRef(null);

  // Transient "Rider has arrived" flag from the request:rider:arrived socket
  // event (there's no ARRIVED status, so this is the only arrival signal the
  // customer gets between IN_TRANSIT and DELIVERED). 'pickup' | 'dropoff' | null.
  const [riderArrived, setRiderArrived] = useState(null);

  // Phase 5 - connection quality. We render the "Reconnecting…" banner only
  // after the socket has been down for >= 3s, to avoid flickering on transient
  // dis-reconnect cycles that happen on app foreground.
  const [showReconnect, setShowReconnect] = useState(false);
  const reconnectTimerRef = useRef(null);
  useEffect(() => {
    const unsub = socketService.onConnectionStateChange((isConnected) => {
      if (isConnected) {
        if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        setShowReconnect(false);
      } else {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => setShowReconnect(true), 3000);
      }
    });
    return () => {
      unsub();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  const polylinePoints = useMemo(
    () => decodePolyline(activeRoute?.polyline || ''),
    [activeRoute?.polyline],
  );

  // Boot - fetch the request, join its socket room, attach Phase 4 listeners.
  useEffect(() => {
    dispatch(fetchRequestById(requestId));
    socketService.joinRequestRoom(requestId);

    const unsubs = [
      socketService.onRequestStatusChanged((data) => {
        if (data?.requestId === requestId) dispatch(updateRequestFromSocket(data));
      }),
      socketService.onRequestRiderAssigned((data) => {
        if (data?.requestId === requestId) dispatch(updateRequestFromSocket(data));
      }),
      socketService.onRequestRiderLocation((data) => {
        if (data?.requestId === requestId) dispatch(updateRiderLocationFromSocket(data));
      }),
      socketService.onRequestRiderArrived((data) => {
        if (data?.requestId !== requestId) return;
        const phase = data.phase === 'pickup' ? 'pickup' : 'dropoff';
        setRiderArrived(phase);
        if (phase === 'dropoff') {
          Toast.show({ type: 'success', text1: t('request.tracking.riderArrivedTitle', 'Your rider has arrived') });
        }
      }),
      socketService.onRequestCompleted((data) => {
        if (data?.requestId === requestId) dispatch(updateRequestFromSocket(data));
      }),
      socketService.onRequestCancelled((data) => {
        if (data?.requestId === requestId) dispatch(updateRequestFromSocket(data));
      }),
      socketService.onRequestMatchingStatus((data) => {
        if (data?.requestId === requestId) dispatch(setMatchingStatus(data));
      }),
      socketService.onRequestRiderEta((data) => {
        if (data?.requestId === requestId) dispatch(setRiderEta(data));
      }),
      socketService.onRequestMessageNew((data) => {
        if (data?.requestId === requestId) dispatch(appendMessageFromSocket(data));
      }),
    ];

    return () => {
      socketService.leaveRequestRoom(requestId);
      unsubs.forEach((u) => u && u());
      dispatch(clearTrackingState());
    };
  }, [dispatch, requestId]);

  // Poll route + ETA every 30s while a rider is actively moving toward us.
  useEffect(() => {
    if (!currentRequest || !ACTIVE_TRACK_STATUSES.has(currentRequest.status)) return undefined;
    dispatch(fetchActiveRoute(requestId));
    const id = setInterval(() => {
      dispatch(fetchActiveRoute(requestId));
    }, 30 * 1000);
    return () => clearInterval(id);
  }, [dispatch, requestId, currentRequest?.status]);

  const openCancelModal = async () => {
    setCancelModalVisible(true);
    setCancelQuoteLoading(true);
    try {
      const action = await dispatch(fetchCancellationQuote(requestId));
      if (action.payload) setCancelQuote(action.payload);
      else setCancelQuote(null);
    } finally {
      setCancelQuoteLoading(false);
    }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await dispatch(cancelRequest({
        requestId,
        reason: 'Customer cancelled',
        cancelToken: cancelQuote?.cancelToken,
      })).unwrap();
      const fee = cancelQuote?.fee || 0;
      Toast.show({
        type: 'success',
        text1: 'Order cancelled',
        text2: fee > 0
          ? `₦${fee} fee applied; remainder refunded to your wallet.`
          : 'Refund credited to your wallet.',
      });
      setCancelModalVisible(false);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Cancellation failed', text2: typeof err === 'string' ? err : (err?.message || 'Try again') });
    } finally {
      setCancelling(false);
    }
  };

  const openChat = async () => {
    setChatVisible(true);
    try {
      await dispatch(fetchMessages({ requestId })).unwrap();
    } catch (_) {}
  };

  const sendChat = async () => {
    const body = chatDraft.trim();
    if (!body) return;
    setChatSending(true);
    try {
      await dispatch(postMessage({ requestId, body })).unwrap();
      setChatDraft('');
      setTimeout(() => chatListRef.current?.scrollToEnd?.({ animated: true }), 50);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Send failed', text2: typeof err === 'string' ? err : 'Try again' });
    } finally {
      setChatSending(false);
    }
  };

  const handleCall = (phoneNumber) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() =>
      Toast.show({ type: 'error', text1: 'Unable to make call' }),
    );
  };

  const openRate = () => navigation.navigate('RateRequest', { request: currentRequest });

  if (isLoading && !currentRequest) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.bg.canvas }}>
        <ActivityIndicator size="large" color={tokens.brand.default} accessibilityLabel={t('common.loading')} />
        <Text style={{ marginTop: 16, fontSize: 16, color: tokens.text.muted }}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!currentRequest) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Ionicons name="alert-circle-outline" size={64} color={tokens.text.muted} />
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8, color: tokens.text.primary }}>
          {t('errors.REQUEST_NOT_FOUND')}
        </Text>
        <Text style={{ fontSize: 14, marginBottom: 24, color: tokens.text.muted }}>{t('errors.NOT_FOUND')}</Text>
        <TouchableOpacity
          style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: tokens.brand.default }}
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: tokens.text.onBrand }}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Phase 8 - type-specific copy keyed off the merchant's admin-managed
  // category slug ('pharmacy', 'grocery', 'restaurant', ...). The slug is
  // included in /requests/:id by request.service.getRequestById.
  const categorySlug = currentRequest.merchant?.category?.slug || null;

  const timeline = statusTimeline(currentRequest.type).map((s) => ({
    key: s,
    icon: STEP_ICON[s] || 'ellipse-outline',
    label: statusDisplay(s, currentRequest.type, categorySlug).label,
  }));
  const currentStepIndex = timeline.findIndex((step) => step.key === currentRequest.status);
  const pill = statusDisplay(currentRequest.status, currentRequest.type, categorySlug);
  const pillColors = statusToneColors(pill.tone, tokens);

  const canCancelLocally = ['REQUESTED', 'ACCEPTED', 'PROCESSING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_EN_ROUTE'].includes(currentRequest.status);
  const canRate = ['DELIVERED', 'SETTLED'].includes(currentRequest.status) && !currentRequest.rating;
  const canReportIssue = ['DELIVERED', 'SETTLED', 'CANCELLED'].includes(currentRequest.status);
  const items = currentRequest.items || [];
  const pkg = currentRequest.packageDetails;

  const isPackage = currentRequest.type === 'PACKAGE';
  const showSearching = (
    (isPackage && currentRequest.status === STATUS.REQUESTED) ||
    RIDER_SEARCH_STATUSES.has(currentRequest.status)
  ) && !currentRequest.riderId;
  const showAwaitingMerchant = !isPackage && currentRequest.status === STATUS.REQUESTED && !currentRequest.riderId;
  const isPharmacy = categorySlug === 'pharmacy';
  const isGrocery = typeof categorySlug === 'string' && categorySlug.startsWith('grocery');
  const awaitingMerchantTitleKey = isPharmacy
    ? 'request.tracking.awaitingPharmacyTitle'
    : isGrocery
      ? 'request.tracking.awaitingStoreTitle'
      : 'request.tracking.awaitingMerchantTitle';
  const showChatButton = isActive(currentRequest.status) && (currentRequest.riderId || currentRequest.merchantId);
  const etaSeconds = riderEta?.etaSeconds ?? activeRoute?.etaSeconds ?? null;
  const showEtaChip = ACTIVE_TRACK_STATUSES.has(currentRequest.status) && etaSeconds != null;

  const riderLocation = currentRequest.riderLocation
    || (activeRoute?.riderLat != null ? { lat: activeRoute.riderLat, lng: activeRoute.riderLng } : null);

  // Split-view: once a rider is actively moving the order and we have a live
  // position, pin the map to the top half of the screen and drop the rest of
  // the tracking content into a scrollable bottom sheet - so the customer
  // watches the rider move without scrolling down to find the map.
  const splitView = ACTIVE_TRACK_STATUSES.has(currentRequest.status) && !!riderLocation;
  const showArrivedBanner = riderArrived === 'dropoff'
    && !['DELIVERED', 'SETTLED', 'CANCELLED'].includes(currentRequest.status);

  // Shared map element, rendered either pinned to the top half (split view) or
  // inline in its 240px card (non-split). Null until we have a rider position.
  const mapView = riderLocation ? (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: riderLocation.lat,
        longitude: riderLocation.lng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }}
    >
      {polylinePoints.length > 1 && (
        <Polyline
          coordinates={polylinePoints}
          strokeColor={tokens.brand.default}
          strokeWidth={4}
        />
      )}
      <Marker
        coordinate={{ latitude: riderLocation.lat, longitude: riderLocation.lng }}
        title={t('request.tracking.markerRider')}
        description={currentRequest.rider?.user
          ? `${currentRequest.rider.user.firstName} ${currentRequest.rider.user.lastName}`
          : undefined}
      >
        <View style={{ borderRadius: 12, padding: 8, backgroundColor: tokens.bg.surface, elevation: 4 }}>
          <Ionicons name="bicycle" size={22} color={tokens.brand.default} />
        </View>
      </Marker>
      {currentRequest.pickupLat && currentRequest.pickupLng && (
        <Marker
          coordinate={{ latitude: currentRequest.pickupLat, longitude: currentRequest.pickupLng }}
          title={t('request.tracking.markerPickup')}
          description={currentRequest.pickupAddress}
        >
          <View style={{ borderRadius: 12, padding: 6, backgroundColor: tokens.bg.surface, elevation: 4 }}>
            <Ionicons name="storefront" size={18} color={tokens.status.successStrong} />
          </View>
        </Marker>
      )}
      {currentRequest.dropoffLat && currentRequest.dropoffLng && (
        <Marker
          coordinate={{ latitude: currentRequest.dropoffLat, longitude: currentRequest.dropoffLng }}
          title={t('request.tracking.markerDropoff')}
          description={currentRequest.dropoffAddress}
        >
          <View style={{ borderRadius: 12, padding: 6, backgroundColor: tokens.bg.surface, elevation: 4 }}>
            <Ionicons name="home" size={18} color={tokens.status.error} />
          </View>
        </Marker>
      )}
    </MapView>
  ) : null;

  const arrivedBannerEl = showArrivedBanner ? (
    <View
      style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.status.successSoft, borderColor: tokens.status.successStrong, borderWidth: 1, borderRadius: 12, padding: 14 }}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="location" size={20} color={tokens.status.successStrong} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontWeight: '800', color: tokens.status.successStrong, fontSize: 14 }}>
          {t('request.tracking.riderArrivedTitle', 'Your rider has arrived')}
        </Text>
        <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
          {t('request.tracking.riderArrivedSub', 'Please head out to meet your rider.')}
        </Text>
      </View>
    </View>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: tokens.bg.surface, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          style={{ padding: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
        >
          <Ionicons name="arrow-back" size={24} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '600', color: tokens.text.primary }}>
          {t('request.tracking.title')}
        </Text>
        {showChatButton ? (
          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={openChat}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.openChat')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={tokens.brand.default} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Connection quality pill - only when socket has been down ≥3s. */}
      {showReconnect && (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: tokens.status.warningSoft, borderBottomWidth: 1, borderBottomColor: tokens.status.warning }}
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator size="small" color={tokens.status.warningStrong} />
          <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '700', color: tokens.status.warningStrong }}>
            {t('request.tracking.reconnecting')}
          </Text>
        </View>
      )}

      {/* Split view - live map pinned to the top half of the screen. */}
      {splitView && (
        <View style={{ flex: 1 }}>
          {mapView}
        </View>
      )}

      <ScrollView
        style={splitView
          ? {
              flex: 1,
              backgroundColor: tokens.bg.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              marginTop: -20,
              elevation: 8,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowOffset: { width: 0, height: -3 },
              shadowRadius: 8,
            }
          : { flex: 1, padding: 16 }}
        contentContainerStyle={splitView ? { padding: 16, paddingBottom: 32 } : undefined}
        showsVerticalScrollIndicator={false}
      >
        {/* Bottom-sheet grab handle (split view only). */}
        {splitView && (
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.border.default }} />
          </View>
        )}

        {arrivedBannerEl}

        {/* Awaiting-merchant banner - REQUESTED on a merchant order, before
            rider search has even begun. Distinct from the searching banner
            below so we don't claim a rider is being searched for, or promise
            an auto-cancel timer that isn't running yet at this stage. */}
        {showAwaitingMerchant && (
          <View style={{ marginBottom: 16, backgroundColor: tokens.status.infoSoft, borderColor: tokens.status.info, borderWidth: 1, borderRadius: 12, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color={tokens.status.info} />
              <Text style={{ marginLeft: 10, fontWeight: '700', color: tokens.status.info, fontSize: 14 }}>
                {t(awaitingMerchantTitleKey)}
              </Text>
            </View>
            <Text style={{ marginTop: 4, fontSize: 12, color: tokens.text.muted }}>
              {t('request.tracking.awaitingMerchantHint')}
            </Text>
          </View>
        )}

        {/* Searching banner */}
        {showSearching && (
          <View style={{ marginBottom: 16, backgroundColor: tokens.brand.soft, borderColor: tokens.brand.softBorder, borderWidth: 1, borderRadius: 12, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color={tokens.brand.default} />
              <Text style={{ marginLeft: 10, fontWeight: '700', color: tokens.brand.default, fontSize: 14 }}>
                {t('request.tracking.searchingTitle')}
              </Text>
            </View>
            {matchingStatus && (
              <Text style={{ marginTop: 6, fontSize: 12, color: tokens.brand.strong }}>
                {t('request.tracking.searchingAttempt', {
                  attempt: matchingStatus.attempt,
                  total: matchingStatus.totalAttempts,
                  km: matchingStatus.radiusKm,
                })}
                {matchingStatus.candidates != null
                  ? ` · ${t('request.tracking.searchingNearby', { count: matchingStatus.candidates })}`
                  : ''}
              </Text>
            )}
            <Text style={{ marginTop: 4, fontSize: 12, color: tokens.text.muted }}>
              {t('request.tracking.searchingHint')}
            </Text>
          </View>
        )}

        {/* Live ETA chip */}
        {showEtaChip && (
          <View style={{ marginBottom: 16, flexDirection: 'row' }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.status.successSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
              accessibilityLiveRegion="polite"
            >
              <Ionicons name="bicycle" size={14} color={tokens.status.successStrong} />
              <Text style={{ marginLeft: 6, color: tokens.status.successStrong, fontWeight: '700', fontSize: 13 }}>
                {t('request.tracking.etaArrives', { eta: formatEta(etaSeconds) })}
                {riderEta?.nextCheckpoint === 'PICKUP' ? ` ${t('request.tracking.etaPickup')}` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Cash-on-delivery reminder - shown while there's still cash to hand
            over (i.e. not cancelled or fully settled). */}
        {currentRequest.paymentMethod === 'CASH' && !['CANCELLED', 'SETTLED'].includes(currentRequest.status) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, padding: 14, borderRadius: 12, backgroundColor: tokens.status.warningSoft }}>
            <Ionicons name="cash-outline" size={20} color={tokens.status.warningStrong} />
            <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, color: tokens.status.warningStrong, fontWeight: '600' }}>
              {t('request.tracking.cashDueBanner', { amount: money(currentRequest.total) })}
            </Text>
          </View>
        ) : null}

        {/* Status Timeline */}
        <View style={{ marginBottom: 24 }}>
          <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: tokens.text.primary }}>
            {t('request.tracking.orderStatus')}
          </Text>
          <View style={{ borderRadius: 12, padding: 16, backgroundColor: tokens.bg.surface }}>
            <View style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: pillColors.bg, marginBottom: 18 }}>
              <Text style={{ color: pillColors.color, fontWeight: '700', fontSize: 14 }}>{pill.label}</Text>
            </View>
            {currentRequest.status === 'CANCELLED' ? (
              <View>
                <Text style={{ textAlign: 'center', color: tokens.text.muted }}>
                  {currentRequest.cancellationReason || t('errors.CANCELLED') || pill.label}
                </Text>
                {Number(currentRequest.cancellationFee) > 0 && (
                  <Text style={{ textAlign: 'center', color: tokens.text.muted, fontSize: 12, marginTop: 6 }}>
                    {t('request.tracking.cancelFeeLabel')}: ₦{Number(currentRequest.cancellationFee).toLocaleString()}
                  </Text>
                )}
              </View>
            ) : (
              <View style={{ paddingLeft: 8 }}>
                {timeline.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                    <View key={step.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ alignItems: 'center', marginRight: 12 }}>
                        <View
                          style={{
                            width: 32, height: 32, borderRadius: 16,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: isCompleted ? tokens.brand.default : tokens.border.default,
                            borderWidth: isCurrent ? 2 : 0,
                            borderColor: isCurrent ? tokens.brand.default + '40' : undefined,
                          }}
                        >
                          <Ionicons name={step.icon} size={16} color={isCompleted ? tokens.text.onBrand : tokens.text.muted} />
                        </View>
                        {index < timeline.length - 1 && (
                          <View style={{ width: 2, height: 24, marginTop: 4, backgroundColor: index < currentStepIndex ? tokens.brand.default : tokens.border.default }} />
                        )}
                      </View>
                      <Text style={{ fontSize: 14, color: isCompleted ? tokens.text.primary : tokens.text.muted, fontWeight: isCompleted ? '500' : 'normal' }}>
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Items */}
        {items.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: tokens.text.primary }}>
              {t('request.tracking.items')}
            </Text>
            <View style={{ borderRadius: 12, backgroundColor: tokens.bg.surface }}>
              {items.map((it, idx) => {
                const variantAttrs = it.variant?.attributes || {};
                const variantSummary = Object.values(variantAttrs).join(' / ') || it.variant?.packLabel || '';
                const groups = Array.isArray(it.selectedOptions) ? it.selectedOptions : [];
                const subText = substitutionLabel(it.substitution, t);
                return (
                  <View key={it.id} style={{ padding: 12, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: tokens.border.default }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ flex: 1, fontWeight: '600', color: tokens.text.primary }}>
                        {it.quantity}× {it.name}{variantSummary ? ` · ${variantSummary}` : ''}
                      </Text>
                      <Text style={{ color: tokens.text.primary, fontWeight: '600' }}>{money(it.lineTotal)}</Text>
                    </View>
                    {groups.map((g) => (
                      <Text key={g.groupId} style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                        {g.groupName}: {(g.items || []).map((i) => i.itemName).join(', ')}
                      </Text>
                    ))}
                    {it.specialInstructions ? (
                      <Text style={{ fontSize: 12, fontStyle: 'italic', color: tokens.text.muted, marginTop: 4 }}>
                        “{it.specialInstructions}”
                      </Text>
                    ) : null}
                    {/* Phase 8 - surface the substitution preference back to
                        the customer so they can recall what they asked for
                        when reading status updates. */}
                    {subText ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.category.groceries.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                          <Ionicons name="swap-horizontal" size={11} color={tokens.category.groceries.icon} />
                          <Text style={{ color: tokens.category.groceries.icon, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{subText}</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Phase 5 - POD OTP banner. Shown while the rider is between pickup
            and delivery and an OTP has been issued. Customer reads the code
            aloud to the rider at the doorstep. Hidden once DELIVERED. */}
        {podOtpFromNotifications && !['DELIVERED', 'SETTLED', 'CANCELLED'].includes(currentRequest.status) ? (
          <View
            style={{
              marginBottom: 24, padding: 14, borderRadius: 14,
              backgroundColor: tokens.status.infoSoft, borderWidth: 2, borderColor: tokens.status.infoSoftBorder,
            }}
            accessibilityLiveRegion="polite"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="key-outline" size={20} color={tokens.status.infoStrong} />
              <Text style={{ marginLeft: 8, fontWeight: '800', color: tokens.status.infoStrong, fontSize: 14 }}>
                {t('request.tracking.podOtpTitle')}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: tokens.status.infoStrong, marginBottom: 10 }}>
              {t('request.tracking.podOtpBody')}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: 10, backgroundColor: tokens.status.info,
              }}
            >
              <Text
                accessibilityLabel={t('request.tracking.podOtpCodeAria', { code: podOtpFromNotifications.split('').join(' ') })}
                style={{ fontSize: 30, fontWeight: '900', color: tokens.text.onBrand, letterSpacing: 6 }}
              >
                {podOtpFromNotifications}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Phase 5 - POD photo card (post-delivery). Shows the rider's
            doorstep proof so the customer can verify. */}
        {currentRequest.podPhotoUrl && ['DELIVERED', 'SETTLED'].includes(currentRequest.status) ? (
          <View style={{ marginBottom: 24, padding: 12, borderRadius: 12, backgroundColor: tokens.bg.surface, borderWidth: 1, borderColor: tokens.border.default }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="camera-outline" size={18} color={tokens.status.success} />
              <Text style={{ marginLeft: 8, fontWeight: '700', color: tokens.text.primary }}>
                {t('request.tracking.podPhotoTitle')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openURL(currentRequest.podPhotoUrl).catch(() => Toast.show({ type: 'error', text1: t('request.tracking.unableToOpen') }))}
              accessibilityRole="button"
              accessibilityLabel={t('request.tracking.podPhotoAria')}
              style={{ borderRadius: 10, overflow: 'hidden' }}
            >
              <View style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: tokens.bg.surfaceMuted }}>
                <Image
                  source={{ uri: currentRequest.podPhotoUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Phase 8 - prescription attached banner. Persisted on the Request
            row and visible to the customer for the lifetime of the order. */}
        {currentRequest.prescriptionUrl ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, padding: 12, borderRadius: 12, backgroundColor: tokens.status.warningSoft, borderWidth: 1, borderColor: tokens.status.warning }}>
            <Ionicons name="medkit" size={20} color={tokens.status.warningStrong} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontWeight: '700', color: tokens.status.warningStrong }}>{t('request.tracking.rxAttachedTitle')}</Text>
              <Text style={{ fontSize: 12, color: tokens.status.warningStrong, marginTop: 2 }}>
                {t('request.tracking.rxAttachedSub')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openURL(currentRequest.prescriptionUrl).catch(() => Toast.show({ type: 'error', text1: t('request.tracking.unableToOpen') }))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('request.tracking.view')}
            >
              <Text style={{ color: tokens.status.warningStrong, fontWeight: '800' }}>{t('request.tracking.view')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Package details */}
        {pkg && (
          <View style={{ marginBottom: 24 }}>
            <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: tokens.text.primary }}>
              {t('request.tracking.package')}
            </Text>
            <View style={{ borderRadius: 12, padding: 12, backgroundColor: tokens.bg.surface }}>
              <Text style={{ color: tokens.text.primary, fontWeight: '500' }}>
                {pkg.size} · {pkg.description || t('request.tracking.noDescription')}
              </Text>
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: tokens.text.muted, fontSize: 12, flex: 1 }}>
                  {t('request.tracking.from')} {pkg.senderName} ({pkg.senderPhone})
                </Text>
                <TouchableOpacity
                  onPress={() => handleCall(pkg.senderPhone)}
                  style={{ padding: 6, borderRadius: 18, backgroundColor: tokens.status.infoSoft }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('a11y.callMerchant')} ${pkg.senderName}`}
                >
                  <Ionicons name="call" size={16} color={tokens.brand.default} />
                </TouchableOpacity>
              </View>
              <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: tokens.text.muted, fontSize: 12, flex: 1 }}>
                  {t('request.tracking.to')} {pkg.recipientName} ({pkg.recipientPhone})
                </Text>
                <TouchableOpacity
                  onPress={() => handleCall(pkg.recipientPhone)}
                  style={{ padding: 6, borderRadius: 18, backgroundColor: tokens.status.infoSoft }}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('a11y.callMerchant')} ${pkg.recipientName}`}
                >
                  <Ionicons name="call" size={16} color={tokens.brand.default} />
                </TouchableOpacity>
              </View>
              {pkg.instructions ? (
                <Text style={{ color: tokens.text.muted, fontStyle: 'italic', fontSize: 12, marginTop: 6 }}>
                  “{pkg.instructions}”
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Merchant */}
        {currentRequest.merchant && (
          <View style={{ marginBottom: 24 }}>
            <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: tokens.text.primary }}>
              {t('request.tracking.merchant')}
            </Text>
            <View style={{ borderRadius: 12, padding: 16, backgroundColor: tokens.bg.surface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="storefront-outline" size={20} color={tokens.brand.default} />
                <Text style={{ fontSize: 14, fontWeight: '600', marginLeft: 12, color: tokens.text.primary, flex: 1 }}>{currentRequest.merchant.name}</Text>
                {currentRequest.merchant.phone ? (
                  <TouchableOpacity
                    onPress={() => handleCall(currentRequest.merchant.phone)}
                    style={{ padding: 8, borderRadius: 20, backgroundColor: tokens.status.infoSoft }}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11y.callMerchant')}
                  >
                    <Ionicons name="call" size={18} color={tokens.brand.default} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location-outline" size={18} color={tokens.text.muted} />
                <Text style={{ fontSize: 13, marginLeft: 8, color: tokens.text.muted, flex: 1 }}>{currentRequest.pickupAddress}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Rider */}
        {currentRequest.rider?.user && (
          <View style={{ marginBottom: 24 }}>
            <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: tokens.text.primary }}>
              {t('request.tracking.rider')}
            </Text>
            <View style={{ borderRadius: 12, padding: 16, backgroundColor: tokens.bg.surface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="person-outline" size={20} color={tokens.brand.default} />
                <Text style={{ fontSize: 14, fontWeight: '600', marginLeft: 12, color: tokens.text.primary }}>
                  {currentRequest.rider.user.firstName} {currentRequest.rider.user.lastName}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="call-outline" size={18} color={tokens.text.muted} />
                <Text style={{ fontSize: 13, marginLeft: 8, color: tokens.text.muted, flex: 1 }}>
                  {currentRequest.rider.user.phone}
                </Text>
                <TouchableOpacity
                  style={{ padding: 8, borderRadius: 20, backgroundColor: tokens.status.infoSoft }}
                  onPress={() => handleCall(currentRequest.rider.user.phone)}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.callRider')}
                >
                  <Ionicons name="call" size={18} color={tokens.brand.default} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Live map - inline only when NOT in split view (in split view the
            same map is pinned to the top half above this sheet). */}
        {!splitView && currentRequest.rider?.user && riderLocation && (
          <View style={{ marginBottom: 24 }}>
            <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: tokens.text.primary }}>
              {t('request.tracking.liveTracking')}
            </Text>
            <View style={{ height: 240, borderRadius: 12, overflow: 'hidden', backgroundColor: tokens.bg.canvas }}>
              {mapView}
            </View>
          </View>
        )}

        {/* Order Details */}
        <View style={{ marginBottom: 24 }}>
          <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, color: tokens.text.primary }}>
            {t('request.tracking.orderDetails')}
          </Text>
          <View style={{ borderRadius: 12, padding: 16, backgroundColor: tokens.bg.surface }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
              <Text style={{ fontSize: 14, color: tokens.text.muted }}>{t('request.tracking.orderIdLabel')}</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: tokens.text.primary }}>#{currentRequest.id.slice(0, 8)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
              <Text style={{ fontSize: 14, color: tokens.text.muted }}>{t('request.tracking.totalLabel')}</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: tokens.text.primary }}>{money(currentRequest.total)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
              <Text style={{ fontSize: 14, color: tokens.text.muted }}>{t('request.tracking.paymentLabel')}</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: tokens.text.primary }}>
                {currentRequest.paymentMethod === 'CASH'
                  ? t('request.tracking.payWithCash')
                  : t('request.tracking.payWithWallet')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ fontSize: 14, color: tokens.text.muted }}>{t('request.tracking.deliveryAddressLabel')}</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: tokens.text.primary, flex: 1, textAlign: 'right' }} numberOfLines={2}>
                {currentRequest.dropoffAddress}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={{ marginBottom: 24 }}>
          {canCancelLocally && (
            <TouchableOpacity
              style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12, backgroundColor: tokens.status.error }}
              onPress={openCancelModal}
              accessibilityRole="button"
              accessibilityLabel={t('request.tracking.cancel')}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.text.onBrand }}>{t('request.tracking.cancel')}</Text>
            </TouchableOpacity>
          )}
          {canRate && (
            <TouchableOpacity
              style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12, backgroundColor: tokens.brand.default }}
              onPress={openRate}
              accessibilityRole="button"
              accessibilityLabel={t('request.tracking.rateOrder')}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: tokens.text.onBrand }}>{t('request.tracking.rateOrder')}</Text>
            </TouchableOpacity>
          )}
          {canReportIssue && (
            <TouchableOpacity
              style={{
                paddingVertical: 13,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 12,
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderColor: tokens.border.default,
              }}
              onPress={() => navigation.navigate('CreateDispute', { requestId: currentRequest.id })}
              accessibilityRole="button"
              accessibilityLabel={t('support.reportIssue')}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: tokens.text.primary }}>
                {t('support.reportIssue')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Cancel-with-fee modal */}
      <Modal visible={cancelModalVisible} transparent animationType="fade" onRequestClose={() => setCancelModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: tokens.overlay.scrim, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tokens.bg.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22 }}>
            <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800', color: tokens.text.primary, marginBottom: 6 }}>
              {t('request.tracking.cancelTitle')}
            </Text>
            {cancelQuoteLoading ? (
              <ActivityIndicator color={tokens.brand.default} style={{ marginVertical: 24 }} accessibilityLabel={t('common.loading')} />
            ) : cancelQuote ? (
              <>
                {!cancelQuote.allowed ? (
                  <Text style={{ color: tokens.text.muted, marginBottom: 16 }}>
                    {t('request.tracking.cancelNotAllowed')}
                  </Text>
                ) : cancelQuote.fee > 0 ? (
                  <>
                    <Text style={{ color: tokens.text.muted, marginBottom: 14 }}>
                      {t('request.tracking.cancelFeeIntro')}
                    </Text>
                    <View style={{ backgroundColor: tokens.bg.surfaceMuted, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                      <Row label={t('request.tracking.cancelFeeLabel')} value={money(cancelQuote.fee)} tokens={tokens} />
                      <Row label={t('request.tracking.cancelRefundLabel')} value={money(cancelQuote.refundAmount)} bold tokens={tokens} />
                    </View>
                  </>
                ) : (
                  <Text style={{ color: tokens.text.muted, marginBottom: 16 }}>
                    {t('request.tracking.cancelFreeBody', { amount: money(cancelQuote.refundAmount) })}
                  </Text>
                )}

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setCancelModalVisible(false)}
                    style={{ flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: tokens.bg.surfaceMuted }}
                    accessibilityRole="button"
                    accessibilityLabel={t('request.tracking.keepOrder')}
                  >
                    <Text style={{ color: tokens.text.primary, fontWeight: '700' }}>{t('request.tracking.keepOrder')}</Text>
                  </TouchableOpacity>
                  {cancelQuote.allowed && (
                    <TouchableOpacity
                      onPress={confirmCancel}
                      disabled={cancelling}
                      style={{ flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: cancelling ? tokens.status.errorStrong : tokens.status.error }}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: cancelling, busy: cancelling }}
                      accessibilityLabel={cancelQuote.fee > 0 ? t('request.tracking.payFeeAndCancel') : t('request.tracking.cancel')}
                    >
                      <Text style={{ color: tokens.text.onBrand, fontWeight: '700' }}>
                        {cancelling
                          ? t('request.tracking.cancelling')
                          : cancelQuote.fee > 0
                            ? t('request.tracking.payFeeAndCancel')
                            : t('request.tracking.cancel')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <Text style={{ color: tokens.status.errorStrong, marginBottom: 14 }}>{t('request.tracking.cancelFailed')}</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* In-app chat sheet */}
      <Modal visible={chatVisible} transparent animationType="slide" onRequestClose={() => setChatVisible(false)}>
        <View style={{ flex: 1, backgroundColor: tokens.overlay.scrim, justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView
            behavior="padding"
            style={{ backgroundColor: tokens.bg.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
              <Ionicons name="chatbubble-ellipses" size={20} color={tokens.brand.default} />
              <Text accessibilityRole="header" style={{ marginLeft: 8, fontWeight: '800', color: tokens.text.primary, flex: 1 }}>
                {t('request.tracking.chatTitle')}
              </Text>
              <TouchableOpacity
                onPress={() => setChatVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={22} color={tokens.text.muted} />
              </TouchableOpacity>
            </View>
            <FlatList
              ref={chatListRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 14, paddingBottom: 20 }}
              renderItem={({ item }) => <ChatBubble message={item} currentUserId={currentRequest.customerId} tokens={tokens} />}
              onContentSizeChange={() => chatListRef.current?.scrollToEnd?.({ animated: false })}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: tokens.text.muted, marginTop: 24 }}>
                  {t('request.tracking.noMessagesYet')}
                </Text>
              }
            />
            <View style={{ flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: tokens.border.default, alignItems: 'center' }}>
              <TextInput
                value={chatDraft}
                onChangeText={setChatDraft}
                placeholder={t('request.tracking.messagePlaceholder')}
                accessibilityLabel={t('request.tracking.messagePlaceholder')}
                placeholderTextColor={tokens.text.placeholder}
                style={{ flex: 1, backgroundColor: tokens.bg.surfaceMuted, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: tokens.text.primary }}
                multiline
              />
              <TouchableOpacity
                disabled={!chatDraft.trim() || chatSending}
                onPress={sendChat}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.sendMessage')}
                accessibilityState={{ disabled: !chatDraft.trim() || chatSending, busy: chatSending }}
                style={{ marginLeft: 8, padding: 10, borderRadius: 22, backgroundColor: (!chatDraft.trim() || chatSending) ? tokens.border.default : tokens.brand.default }}
              >
                <Ionicons name="send" size={18} color={tokens.text.onBrand} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const ChatBubble = ({ message, currentUserId, tokens }) => {
  const isMine = message.fromUserId === currentUserId;
  return (
    <View style={{ flexDirection: 'row', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <View
        style={{
          maxWidth: '78%',
          backgroundColor: isMine ? tokens.brand.default : tokens.bg.surfaceMuted,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 14,
          borderBottomRightRadius: isMine ? 4 : 14,
          borderBottomLeftRadius: isMine ? 14 : 4,
        }}
      >
        {!isMine && message.fromUser && (
          <Text style={{ fontSize: 11, fontWeight: '700', color: tokens.text.muted, marginBottom: 2 }}>
            {message.fromUser.firstName} {message.fromUser.lastName?.[0] || ''}
          </Text>
        )}
        <Text style={{ color: isMine ? tokens.text.onBrand : tokens.text.primary, fontSize: 14 }}>{message.body}</Text>
      </View>
    </View>
  );
};

const Row = ({ label, value, bold, tokens }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
    <Text style={{ color: tokens.text.muted, fontWeight: bold ? '700' : '400' }}>{label}</Text>
    <Text style={{ color: tokens.text.primary, fontWeight: bold ? '700' : '500' }}>{value}</Text>
  </View>
);

export default RequestTrackingScreen;
