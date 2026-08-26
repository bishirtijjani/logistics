import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector, useStore } from "react-redux";
import Toast from "react-native-toast-message";
import { useTheme } from "../../theme";
import { useT } from "../../i18n/useT";
import api from "../../services/api";
import socketService from "../../services/socket";
import mapsNav from "../../services/mapsNav";
import { createGeofence } from "../../services/geofence";
import { decodePolyline } from "../../lib/polyline";
import { STATUS } from "../../lib/constants";
import {
  hydrateFromServer,
  patchStatus,
  drainStatusQueue,
  tripArrived,
  tripCallAttempted,
  tripCleared,
  hydratePodDraft,
  completeDelivery,
  setTripChatOpen,
} from "../../store/slices/tripSlice";
import { setOnDelivery } from "../../store/slices/riderSlice";
import { createTicketFromTrip } from "../../store/slices/supportSlice";
import StatusActionButton from "./StatusActionButton";
import PickupCard from "./PickupCard";
import DropoffCard from "./DropoffCard";
import ContactPartiesSheet from "./ContactPartiesSheet";
import ChatChannelPicker from "./ChatChannelPicker";
import ChatThread from "./ChatThread";
import CancelTripSheet from "./CancelTripSheet";
import WrongAddressSheet from "./WrongAddressSheet";
import TripCancelledOverlay from "./TripCancelledOverlay";
import PodCaptureSheet from "./PodCaptureSheet";
import SignaturePadSheet from "./SignaturePadSheet";
import DeliveryOtpInputSheet from "./DeliveryOtpInputSheet";

const PICKUP_STATUSES = [STATUS.RIDER_ASSIGNED, STATUS.RIDER_EN_ROUTE];
const DROPOFF_STATUSES = [STATUS.PICKED_UP, STATUS.IN_TRANSIT];
const ACTIVE_ROUTE_STATUSES = [
  STATUS.RIDER_ASSIGNED,
  STATUS.RIDER_EN_ROUTE,
  STATUS.PICKED_UP,
  STATUS.IN_TRANSIT,
];
const ROUTE_POLL_MS = 30_000;

// Labels resolve via t("trip.stage.<STATUS>") with these English fallbacks.
const STAGE_LABEL_FALLBACK = {
  [STATUS.RIDER_ASSIGNED]: "Heading to pickup",
  [STATUS.RIDER_EN_ROUTE]: "En route to pickup",
  [STATUS.PICKED_UP]: "Picked up",
  [STATUS.IN_TRANSIT]: "In transit",
  [STATUS.DELIVERED]: "Delivered",
  [STATUS.SETTLED]: "Settled",
};

export default function TripCockpitScreen({ route }) {
  const { tokens } = useTheme();
  // Per-stage accent, resolved from reactive tokens so the status pill re-tones
  // in dark mode. Drives both the pill text color and its tinted background.
  const STAGE_COLORS = {
    [STATUS.RIDER_ASSIGNED]: tokens.brand.default,
    [STATUS.RIDER_EN_ROUTE]: tokens.brand.default,
    [STATUS.PICKED_UP]: tokens.category.groceries.icon,
    [STATUS.IN_TRANSIT]: tokens.category.groceries.icon,
    [STATUS.DELIVERED]: tokens.status.successStrong,
    [STATUS.SETTLED]: tokens.status.successStrong,
  };
  const { t } = useT();
  const dispatch = useDispatch();
  // We read POD URLs via store.getState() inside the submit flow because the
  // useSelector closure can be one render behind the dispatch that just
  // wrote them. The selectors below still drive render; getState is the
  // tiebreaker for synchronous reads from inside event handlers.
  const store = useStore();

  const paramRequestId = route?.params?.requestId || null;
  // Set when a REQUEST_MESSAGE notification deep-links here (see
  // notificationRoute.js's routeToScreen) - opens straight into that
  // channel's thread instead of leaving the rider to find it themselves.
  const paramChatChannel = route?.params?.chatChannel || null;
  const activeRequestId = useSelector((s) => s.trip.activeRequestId);
  const status = useSelector((s) => s.trip.status);
  const type = useSelector((s) => s.trip.type);
  const pickup = useSelector((s) => s.trip.pickup);
  const dropoff = useSelector((s) => s.trip.dropoff);
  const items = useSelector((s) => s.trip.items);
  const packageDetails = useSelector((s) => s.trip.packageDetails);
  const distanceKm = useSelector((s) => s.trip.distanceKm);
  const estimatedMinutes = useSelector((s) => s.trip.estimatedMinutes);
  const riderEarning = useSelector((s) => s.trip.riderEarning);
  const arrivedAt = useSelector((s) => s.trip.arrivedAt);
  const callAttempts = useSelector((s) => s.trip.callAttempts);
  const patching = useSelector((s) => s.trip.patching);
  const cancelling = useSelector((s) => s.trip.cancelling);
  const errorState = useSelector((s) => s.trip.error);
  const lastFix = useSelector((s) => s.rider.lastFix);
  const unreadCounts = useSelector((s) => s.trip.unreadCounts);
  const unreadTotal = (unreadCounts?.CUSTOMER_RIDER || 0) + (unreadCounts?.RIDER_MERCHANT || 0);

  const requestId = activeRequestId || paramRequestId;

  // Map / route polyline state.
  const [routePayload, setRoutePayload] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [autoCenter, setAutoCenter] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mapRef = useRef(null);

  // Admin-curated places (custom_places) shown as labelled markers on the map
  // so the rider can visually find the dropoff building by name.
  const [customPlaces, setCustomPlaces] = useState([]);
  const placesTimeout = useRef(null);
  const placesSeq = useRef(0);

  const fetchCustomPlaces = useCallback((reg) => {
    const latSpan = reg?.latitudeDelta ?? 0.03;
    const lngSpan = reg?.longitudeDelta ?? 0.03;
    if (Math.max(latSpan, lngSpan) > 0.08) {
      setCustomPlaces([]);
      return;
    }
    if (placesTimeout.current) clearTimeout(placesTimeout.current);
    placesTimeout.current = setTimeout(async () => {
      const seq = ++placesSeq.current;
      const half = Math.max(latSpan, lngSpan) / 2;
      try {
        const { data } = await api.get("/maps/custom-places", {
          params: {
            north: reg.latitude + half,
            south: reg.latitude - half,
            east: reg.longitude + half,
            west: reg.longitude - half,
          },
        });
        if (seq === placesSeq.current) setCustomPlaces(data || []);
      } catch {
        // Ignore - labels are a nicety, not a blocker.
      }
    }, 450);
  }, []);

  useEffect(() => {
    return () => {
      if (placesTimeout.current) clearTimeout(placesTimeout.current);
    };
  }, []);

  // Sheet state.
  const [contactVisible, setContactVisible] = useState(false);
  const [chatPickerVisible, setChatPickerVisible] = useState(false);
  const [chatChannel, setChatChannel] = useState(null); // null | 'CUSTOMER_RIDER' | 'RIDER_MERCHANT'
  const [cancelVisible, setCancelVisible] = useState(false);

  // Only consume once on arrival - not on every activeRequestId change, so
  // deliberately depends on paramChatChannel alone.
  useEffect(() => {
    if (paramChatChannel && activeRequestId === paramRequestId) {
      setChatChannel(paramChatChannel);
    }
  }, [paramChatChannel]);

  // Keep the trip slice in sync with the open chat thread so incoming
  // messages on that thread render live without being counted as unread.
  useEffect(() => {
    dispatch(setTripChatOpen(chatChannel));
  }, [chatChannel, dispatch]);
  const [wrongAddressStage, setWrongAddressStage] = useState(null);

  // ── Phase 5: POD sheet machine ─────────────────────────────────────────
  // `podStage` walks through 'photo' → 'signature' → 'otp' → 'submitting'.
  // Skips stages whose platform setting is off / threshold not crossed.
  const [podStage, setPodStage] = useState(null);
  const [podSubmitError, setPodSubmitError] = useState(null);
  const podPhotoUrl = useSelector((s) => s.trip.pod?.photoUrl);
  const podSignatureUrl = useSelector((s) => s.trip.pod?.signatureUrl);
  const podSubmitting = useSelector((s) => s.trip.podSubmitting);
  const cancelledBanner = useSelector((s) => s.trip.cancelled);
  const settings = useSelector((s) => s.settings?.values || {});
  const fareTotal = useSelector((s) => s.trip.fare);
  const paymentMethod = useSelector((s) => s.trip.paymentMethod);
  const collectAmount = useSelector((s) => s.trip.collectAmount);
  const isCashTrip = paymentMethod === "CASH";

  // If the trip is force-cancelled mid-POD (admin / customer), tear down any
  // open POD sheet so the cancellation overlay isn't covered by the camera.
  useEffect(() => {
    if (cancelledBanner && podStage) {
      setPodStage(null);
    }
  }, [cancelledBanner, podStage]);

  // Public settings: read with sane defaults that match the seed values, so
  // a cold-start cockpit before settings are hydrated still behaves correctly.
  // Settings come from `/settings/public` as raw JSON values; admins editing
  // through the dashboard may persist booleans as strings, so normalise.
  const truthy = (v, fallback = false) => {
    if (v === undefined) return fallback;
    return v === true || v === "true" || v === 1 || v === "1";
  };
  const requirePodPhoto = truthy(settings["delivery.requirePodPhoto"], true);
  const requireSignature = truthy(settings["delivery.requireSignature"], false);
  const otpThreshold = Number(settings["delivery.podOtpThresholdNgn"] ?? 50000);
  const requiresOtp = otpThreshold > 0 && Number(fareTotal || 0) >= otpThreshold;

  // Geofence (single-fence-at-a-time).
  const fenceRef = useRef(null);
  // Mounted guard - async work (route fetch, hydrate) can resolve after
  // unmount when the user pops the screen or kills the trip.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ─── Hydrate trip on mount (cold start with deep-link / persisted req) ───
  useEffect(() => {
    if (!requestId) return;
    // Always rehydrate from server when we land here - fixes stale state and
    // covers cold-start with only paramRequestId. Also restore the POD draft
    // (if any) so a kill-mid-upload preserves the captured photo / signature.
    dispatch(hydrateFromServer(requestId));
    dispatch(hydratePodDraft(requestId));
  }, [requestId, dispatch]);

  // ─── Socket lifecycle: ensure we're in the request room + drain queue ────
  useEffect(() => {
    if (!requestId) return;
    socketService.joinRequestRoom(requestId);
    return () => {
      // Leave the room when we unmount AND only if no other consumer needs it.
      // tripSlice handles this on tripCleared / cancel / hydrate-terminal.
    };
  }, [requestId]);

  // Drain pending status patches on socket reconnect.
  useEffect(() => {
    const unsub = socketService.onConnectionStateChange((connected) => {
      if (connected) dispatch(drainStatusQueue());
    });
    return () => unsub?.();
  }, [dispatch]);

  // ─── Route polyline - fetch on stage change + every 30s during the journey ─
  const loadRoute = useCallback(async () => {
    if (!requestId) return;
    if (!status || !ACTIVE_ROUTE_STATUSES.includes(status)) return;
    if (!isMountedRef.current) return;
    setRouteLoading(true);
    try {
      const envelope = await api.get(`/requests/${requestId}/route`);
      if (!isMountedRef.current) return;
      setRoutePayload(envelope?.data || envelope || null);
    } catch (_) {
      // Route is decorative - failure is non-fatal.
    } finally {
      if (isMountedRef.current) setRouteLoading(false);
    }
  }, [requestId, status]);

  // Re-fetch on foreground so we don't miss anything during a backgrounded gap.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && requestId) {
        dispatch(hydrateFromServer(requestId));
        loadRoute();
      }
    });
    return () => sub.remove();
  }, [requestId, dispatch, loadRoute]);

  useEffect(() => { loadRoute(); }, [loadRoute]);

  useEffect(() => {
    if (!requestId || !status) return;
    if (status === STATUS.DELIVERED || status === STATUS.SETTLED || status === STATUS.CANCELLED) return;
    const id = setInterval(loadRoute, ROUTE_POLL_MS);
    return () => clearInterval(id);
  }, [requestId, status, loadRoute]);

  // ─── Geofence wiring ─────────────────────────────────────────────────────
  // Pickup fence active during RIDER_EN_ROUTE (and only until pickup arrives).
  // Dropoff fence active during IN_TRANSIT.
  useEffect(() => {
    // Tear down any previous fence on stage change.
    if (fenceRef.current) {
      fenceRef.current.cancel();
      fenceRef.current = null;
    }
    if (!status) return;
    if (status === STATUS.RIDER_EN_ROUTE && pickup?.lat && pickup?.lng && !arrivedAt.pickup) {
      fenceRef.current = createGeofence({
        lat: pickup.lat,
        lng: pickup.lng,
        onEnter: () => {
          try { Vibration.vibrate(300); } catch (_) {}
          Toast.show({
            type: "success",
            text1: t("trip.geofence.arrivedPickupTitle", "Arrived at pickup"),
            text2: t("trip.geofence.arrivedPickupSub", "Tap Confirm pickup when you have the order."),
          });
          dispatch(tripArrived("pickup"));
        },
      });
    } else if (status === STATUS.IN_TRANSIT && dropoff?.lat && dropoff?.lng && !arrivedAt.dropoff) {
      fenceRef.current = createGeofence({
        lat: dropoff.lat,
        lng: dropoff.lng,
        onEnter: () => {
          try { Vibration.vibrate(300); } catch (_) {}
          Toast.show({
            type: "success",
            text1: t("trip.geofence.arrivedDropoffTitle", "Arrived at dropoff"),
            text2: t("trip.geofence.arrivedDropoffSub", "Tap Complete delivery to finish."),
          });
          dispatch(tripArrived("dropoff"));
        },
      });
    }
  }, [status, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, arrivedAt.pickup, arrivedAt.dropoff, dispatch, t]);

  // Tell the server the moment arrival is registered - by the geofence above or
  // by the manual "I've arrived" button, both of which set trip.arrivedAt. The
  // server relays it to the customer as a transient "Rider has arrived" banner.
  // Emit once per phase so a re-render doesn't spam the socket.
  const arrivedEmittedRef = useRef({ pickup: false, dropoff: false });
  useEffect(() => {
    if (arrivedAt.pickup && !arrivedEmittedRef.current.pickup) {
      arrivedEmittedRef.current.pickup = true;
      socketService.emitRiderArrived(requestId, "pickup");
    }
    if (arrivedAt.dropoff && !arrivedEmittedRef.current.dropoff) {
      arrivedEmittedRef.current.dropoff = true;
      socketService.emitRiderArrived(requestId, "dropoff");
    }
  }, [arrivedAt.pickup, arrivedAt.dropoff, requestId]);

  // Cancel any in-flight geofence + its fallback timer on unmount, otherwise
  // the timer fires after the cockpit is gone and `dispatch(tripArrived)` lands
  // into a stale trip slice (or stays alive until app exit).
  useEffect(() => {
    return () => {
      if (fenceRef.current) {
        fenceRef.current.cancel();
        fenceRef.current = null;
      }
    };
  }, []);

  // Feed new fixes into the active fence.
  useEffect(() => {
    if (!fenceRef.current || !lastFix) return;
    fenceRef.current.ingestFix(lastFix);
  }, [lastFix]);

  // ─── Map auto-center on rider while moving ───────────────────────────────
  useEffect(() => {
    if (!autoCenter || !mapRef.current || !lastFix) return;
    try {
      mapRef.current.animateCamera({
        center: { latitude: lastFix.lat, longitude: lastFix.lng },
        zoom: 15.5,
      }, { duration: 300 });
    } catch (_) {}
  }, [autoCenter, lastFix?.lat, lastFix?.lng]);

  // ─── Polyline decoding ───────────────────────────────────────────────────
  const polylinePoints = useMemo(
    () => decodePolyline(routePayload?.polyline || ""),
    [routePayload?.polyline],
  );

  // ─── Counterparty selection based on stage ───────────────────────────────
  const isPickupStage = PICKUP_STATUSES.includes(status);
  const isDropoffStage = DROPOFF_STATUSES.includes(status);
  const counterpart = isPickupStage ? pickup : isDropoffStage ? dropoff : null;
  const merchantUserId = useSelector((s) => s.trip.merchantUserId);
  const customerId = useSelector((s) => s.trip.customerId);
  const counterpartUserId = isPickupStage
    ? (merchantUserId || null)
    : (customerId || null);

  // Open Maps to the active stage location.
  const openMapsToStage = () => {
    const target = isPickupStage ? pickup : dropoff;
    if (!target?.lat || !target?.lng) return;
    mapsNav.openTo({ lat: target.lat, lng: target.lng, label: target.name || target.address });
  };

  // Call the active counterpart, with attempt tracking.
  const callCounterpart = async () => {
    if (!counterpart?.contactPhone) {
      Toast.show({ type: "error", text1: t("trip.contact.noPhoneToast", "No phone on file") });
      return;
    }
    const ok = await mapsNav.dial(counterpart.contactPhone);
    if (ok && counterpartUserId) {
      dispatch(tripCallAttempted(counterpartUserId));
    }
  };

  // Report customer unreachable → file a CUSTOMER_UNREACHABLE support ticket.
  const reportUnreachable = async () => {
    setContactVisible(false);
    const action = await dispatch(createTicketFromTrip({
      requestId,
      stage: isPickupStage ? "pickup" : "dropoff",
      counterpartName: counterpart?.contactName,
      counterpartPhone: counterpart?.contactPhone,
      callAttempts: counterpartUserId ? (callAttempts[counterpartUserId] || 0) : 0,
    }));
    if (action.meta.requestStatus === "fulfilled") {
      Toast.show({
        type: "success",
        text1: t("trip.support.notifiedTitle", "Support notified"),
        text2: t("trip.support.notifiedSub", "We'll be in touch shortly."),
      });
    } else {
      Toast.show({
        type: "error",
        text1: t("trip.support.notifyFailed", "Couldn't notify support"),
        text2: action.payload?.message || t("trip.support.notifyFailedFallback", "Try again."),
      });
    }
  };

  // StatusActionButton dispatcher.
  const handleAction = async (action) => {
    if (!requestId) return;
    if (action.kind === "patch") {
      const result = await dispatch(patchStatus({ requestId, nextStatus: action.nextStatus }));
      if (result.meta.requestStatus !== "fulfilled") {
        const code = result.payload?.code;
        if (code === "NETWORK_ERROR") {
          Toast.show({
            type: "info",
            text1: t("trip.offline.title", "You're offline"),
            text2: t("trip.offline.sub", "We'll retry as soon as the connection is back."),
          });
        }
      }
    } else if (action.kind === "arrive-pickup") {
      // Manual arrival (geofence can also auto-fire).
      try { Vibration.vibrate(120); } catch (_) {}
      dispatch(tripArrived("pickup"));
    } else if (action.kind === "arrive-dropoff") {
      try { Vibration.vibrate(120); } catch (_) {}
      dispatch(tripArrived("dropoff"));
    } else if (action.kind === "complete") {
      // Phase 5 - start the POD pipeline. Each stage that's gated off is
      // skipped automatically by `advancePodStage`. If everything's already
      // captured (e.g. user reopened after a force-close mid-submit),
      // jumps straight to the DELIVERED PATCH.
      setPodSubmitError(null);
      advancePodStage("photo");
    }
  };

  /**
   * Walk the POD sheet machine forward, skipping any stage the platform
   * settings have switched off OR a value already exists for. Reads URLs
   * from `store.getState()` rather than the closure-captured selectors so
   * the flow sees URLs that were dispatched in the SAME tick (a sheet's
   * onContinue fires synchronously after dispatching its uploaded URL).
   */
  const advancePodStage = (from) => {
    const order = ["photo", "signature", "otp", "submit"];
    const idx = order.indexOf(from);
    const sequence = idx >= 0 ? order.slice(idx) : order;
    const currentPod = store.getState().trip?.pod || null;
    for (const stage of sequence) {
      if (stage === "photo") {
        if (!requirePodPhoto) continue;
        if (currentPod?.photoUrl) continue;
        setPodStage("photo");
        return;
      }
      if (stage === "signature") {
        if (!requireSignature) continue;
        if (currentPod?.signatureUrl) continue;
        setPodStage("signature");
        return;
      }
      if (stage === "otp") {
        if (!requiresOtp) continue;
        setPodStage("otp");
        return;
      }
      submitDelivery();
      return;
    }
    submitDelivery();
  };

  const submitDelivery = async (otpFromSheet) => {
    if (!requestId) return;
    setPodSubmitError(null);
    // Same getState() pattern - fetch URLs at call time so we never send
    // undefined values that the sheet just resolved.
    const currentPod = store.getState().trip?.pod || null;
    const action = await dispatch(completeDelivery({
      requestId,
      podPhotoUrl: currentPod?.photoUrl || undefined,
      podSignatureUrl: currentPod?.signatureUrl || undefined,
      podDeliveryOtp: otpFromSheet || undefined,
    }));
    if (action.meta.requestStatus === "fulfilled") {
      setPodStage(null);
      Toast.show({
        type: "success",
        text1: t("trip.delivered.successToastTitle", "Delivered!"),
        text2: t("trip.delivered.successToastSub", "Earnings will land in your wallet shortly."),
      });
      return;
    }
    // Map server-side POD errors back to the corresponding sheet.
    const code = action.payload?.code;
    if (code === "POD_PHOTO_REQUIRED" || code === "POD_PHOTO_INVALID") {
      setPodStage("photo");
    } else if (code === "POD_SIGNATURE_REQUIRED" || code === "POD_SIGNATURE_INVALID") {
      setPodStage("signature");
    } else if (code === "POD_OTP_REQUIRED" || code === "POD_OTP_NOT_ISSUED" || code === "POD_OTP_MISMATCH") {
      setPodSubmitError(code);
      setPodStage("otp");
    } else if (code === "NETWORK_ERROR") {
      Toast.show({
        type: "info",
        text1: t("trip.offline.title", "You're offline"),
        text2: t("trip.offline.sub", "We'll retry as soon as the connection is back."),
      });
      setPodStage(null);
    } else {
      Toast.show({
        type: "error",
        text1: t("pod.submitFailed", "Couldn't complete the delivery"),
        text2: action.payload?.message || t("pod.submitTryAgain", "Try again."),
      });
      setPodStage(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(hydrateFromServer(requestId)),
        loadRoute(),
      ]);
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  };

  // Auto-clear on terminal status. Flip the GPS cadence back to idle so
  // the rider's stream isn't pinned at 3 s after the trip ends. We hold the
  // "Delivered!" success state for ~8 s so the settlement worker (which
  // fires after a 5-second BullMQ delay) has time to credit the wallet and
  // emit `wallet:balance:updated` - that flips the success card to show
  // the actual earned amount before we tear the cockpit down.
  useEffect(() => {
    if (status === STATUS.DELIVERED || status === STATUS.SETTLED) {
      dispatch(setOnDelivery(false)).catch?.(() => {});
      const id = setTimeout(() => { dispatch(tripCleared()); }, 8000);
      return () => clearTimeout(id);
    }
  }, [status, dispatch]);

  // ── Phase 5: settlement animation - watch for `wallet:balance:updated`
  // with a RIDER_EARNING transaction tagged for THIS trip. When it arrives,
  // surface the actual amount + extend the cockpit slightly so the rider
  // sees the earnings before auto-clear. The local state is enough - the
  // walletSlice / earningsSlice handle the durable updates.
  const [creditedAmount, setCreditedAmount] = useState(null);
  useEffect(() => {
    if (status !== STATUS.DELIVERED && status !== STATUS.SETTLED) return undefined;
    const unsub = socketService.onWalletBalanceUpdated((data) => {
      const tx = data?.transaction;
      if (!tx) return;
      if (tx.type !== "RIDER_EARNING") return;
      // The settlement transaction metadata carries requestId; the live
      // socket nudge may not (the nudge from settle worker is structural).
      // Either way, if the rider sees a RIDER_EARNING land while this
      // delivery is in DELIVERED/SETTLED state, it's almost certainly this
      // trip's settlement.
      if (typeof tx.amount === "number") setCreditedAmount(tx.amount);
    });
    return () => unsub?.();
  }, [status]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!requestId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="bicycle-outline" size={48} color={tokens.text.muted} />
        <Text style={{ marginTop: 12, fontSize: 15, color: tokens.text.muted }}>
          {t("trip.noActive", "No active trip.")}
        </Text>
      </SafeAreaView>
    );
  }

  if (!status) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={tokens.brand.default} />
        <Text style={{ marginTop: 12, fontSize: 13, color: tokens.text.muted }}>
          {t("trip.loading", "Loading trip…")}
        </Text>
      </SafeAreaView>
    );
  }

  const riderHere = lastFix
    ? { latitude: lastFix.lat, longitude: lastFix.lng }
    : null;
  const initialRegion = pickup?.lat && pickup?.lng
    ? {
        latitude: pickup.lat,
        longitude: pickup.lng,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={["top"]}>
      {/* Status pill header */}
      <View
        style={{
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 16, paddingVertical: 12,
          backgroundColor: tokens.bg.surface,
          borderBottomWidth: 1, borderBottomColor: tokens.border.default,
        }}
      >
        <View
          style={{
            paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: (STAGE_COLORS[status] || tokens.brand.default) + "22",
            marginRight: 10,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: STAGE_COLORS[status] || tokens.brand.default }}>
            {t(`trip.stage.${status}`, STAGE_LABEL_FALLBACK[status] || status)}
          </Text>
        </View>
        <Text style={{ flex: 1, fontSize: 12, color: tokens.text.muted, fontWeight: "600" }} numberOfLines={1}>
          #{requestId.slice(0, 8)}
        </Text>
        <TouchableOpacity
          onPress={() => setChatPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={unreadTotal > 0
            ? t("trip.openChat", "Open chat") + ` · ${unreadTotal} ${t("trip.unread", "unread")}`
            : t("trip.openChat", "Open chat")}
          hitSlop={8}
          style={{ paddingHorizontal: 6, paddingVertical: 6, position: "relative" }}
        >
          <Ionicons name="chatbubbles-outline" size={22} color={tokens.brand.default} />
          {unreadTotal > 0 && (
            <View
              style={{
                position: "absolute", top: 0, right: 0,
                minWidth: 16, height: 16, paddingHorizontal: 4,
                borderRadius: 9, backgroundColor: tokens.status.error,
                alignItems: "center", justifyContent: "center",
                borderWidth: 2, borderColor: tokens.bg.surface,
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Text style={{ color: tokens.text.onBrand, fontSize: 9, fontWeight: "800" }}>
                {unreadTotal > 99 ? "99+" : unreadTotal}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Pending retry banner */}
      {errorState?.phase === "patchStatus" && errorState?.retriable ? (
        <View style={{ backgroundColor: tokens.status.warningSoft, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="cloud-offline-outline" size={16} color={tokens.status.warningStrong} />
          <Text style={{ marginLeft: 8, fontSize: 12, color: tokens.status.warningStrong, fontWeight: "700", flex: 1 }}>
            {t("trip.offline.banner", "Connection issue. We'll retry your update.")}
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.brand.default} />}
      >
        {/* Top map - 280 px */}
        <View style={{ position: "relative", height: 280 }}>
          {initialRegion ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={{ flex: 1 }}
              initialRegion={initialRegion}
              onRegionChangeComplete={(reg) => {
                if (!reg) return;
                // A user pan/tilt ends auto-following; label fetch is harmless.
                fetchCustomPlaces(reg);
              }}
              onPanDrag={() => setAutoCenter(false)}
              showsCompass={false}
              showsUserLocation={false}
              showsMyLocationButton={false}
              toolbarEnabled={false}
            >
              {pickup?.lat && pickup?.lng ? (
                <Marker
                  coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View
                    style={{
                      width: 30, height: 30, borderRadius: 15,
                      backgroundColor: tokens.brand.default,
                      borderWidth: 3, borderColor: "#fff",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Ionicons name="storefront" size={14} color="#fff" />
                  </View>
                </Marker>
              ) : null}
              {dropoff?.lat && dropoff?.lng ? (
                <Marker
                  coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View
                    style={{
                      width: 30, height: 30, borderRadius: 15,
                      backgroundColor: tokens.status.success,
                      borderWidth: 3, borderColor: "#fff",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Ionicons name="flag" size={14} color="#fff" />
                  </View>
                </Marker>
              ) : null}
              {riderHere ? (
                <Marker coordinate={riderHere} anchor={{ x: 0.5, y: 0.5 }}>
                  <View
                    style={{
                      width: 34, height: 34, borderRadius: 17,
                      backgroundColor: "#1D4ED8",
                      borderWidth: 3, borderColor: "#fff",
                      alignItems: "center", justifyContent: "center",
                      shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
                    }}
                  >
                    <Ionicons name="bicycle" size={16} color="#fff" />
                  </View>
                </Marker>
              ) : null}

              {polylinePoints.length > 1 ? (
                <Polyline
                  coordinates={polylinePoints}
                  strokeColor={tokens.brand.default}
                  strokeWidth={4}
                />
              ) : pickup?.lat && pickup?.lng && dropoff?.lat && dropoff?.lng ? (
                <Polyline
                  coordinates={[
                    { latitude: pickup.lat, longitude: pickup.lng },
                    { latitude: dropoff.lat, longitude: dropoff.lng },
                  ]}
                  strokeColor={tokens.brand.default}
                  strokeWidth={3}
                  lineDashPattern={[6, 4]}
                />
              ) : null}

              {/* Admin-curated places as subtle labelled markers. */}
              {customPlaces.map((p) => (
                <TripPlaceMarker key={p.id} place={p} />
              ))}
            </MapView>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.bg.surfaceMuted }}>
              <ActivityIndicator color={tokens.brand.default} />
            </View>
          )}

          {/* Recenter FAB */}
          {!autoCenter && riderHere ? (
            <TouchableOpacity
              onPress={() => setAutoCenter(true)}
              accessibilityRole="button"
              accessibilityLabel={t("trip.recenterAria", "Recenter on me")}
              style={{
                position: "absolute", right: 14, bottom: 14,
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: tokens.bg.surface,
                alignItems: "center", justifyContent: "center",
                borderWidth: 1, borderColor: tokens.border.default,
                shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
              }}
            >
              <Ionicons name="locate" size={18} color={tokens.brand.default} />
            </TouchableOpacity>
          ) : null}

          {/* Route loading dot */}
          {routeLoading ? (
            <View style={{ position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: tokens.bg.surface }}>
              <ActivityIndicator size="small" color={tokens.brand.default} />
            </View>
          ) : null}
        </View>

        {/* Bottom sheet contents */}
        <View style={{ padding: 14 }}>
          {/* Cash-on-delivery: standing reminder of the amount to collect, shown
              through every active stage so it's in front of the rider at handover. */}
          {isCashTrip && (isPickupStage || isDropoffStage) ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: tokens.status.successSoft || tokens.brand.soft,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginBottom: 12,
              }}
            >
              <Ionicons name="cash-outline" size={20} color={tokens.status.successStrong || tokens.brand.strong} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: tokens.status.successStrong || tokens.brand.strong, fontWeight: "800", fontSize: 14 }}>
                  {t("trip.cashCollect", "Collect ₦{{amount}} cash", { amount: Number(collectAmount || fareTotal || 0).toLocaleString("en-NG") })}
                </Text>
                <Text style={{ color: tokens.text.muted, fontSize: 12, marginTop: 2 }}>
                  {t("trip.cashCollectSub", "The platform fee is deducted from your wallet on completion.")}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Stage card */}
          {isPickupStage ? (
            <PickupCard
              pickup={pickup}
              items={items}
              packageDetails={packageDetails}
              type={type}
              earning={riderEarning}
              distanceKm={distanceKm}
              estimatedMinutes={estimatedMinutes}
              onOpenInMaps={openMapsToStage}
              onContactRow={() => setContactVisible(true)}
              onWrongAddress={() => setWrongAddressStage("pickup")}
            />
          ) : isDropoffStage ? (
            <DropoffCard
              dropoff={dropoff}
              earning={riderEarning}
              distanceKm={distanceKm}
              estimatedMinutes={estimatedMinutes}
              onOpenInMaps={openMapsToStage}
              onContactRow={() => setContactVisible(true)}
              onWrongAddress={() => setWrongAddressStage("dropoff")}
            />
          ) : status === STATUS.DELIVERED || status === STATUS.SETTLED ? (
            <View style={{ alignItems: "center", padding: 16 }}>
              <Ionicons
                name="checkmark-circle"
                size={creditedAmount != null ? 48 : 40}
                color={tokens.status.success}
              />
              <Text style={{ fontSize: 18, fontWeight: "800", color: tokens.text.primary, marginTop: 8 }}>
                {t("trip.delivered.title", "Delivered!")}
              </Text>
              {creditedAmount != null ? (
                <Text style={{ fontSize: 22, fontWeight: "900", color: tokens.status.successStrong, marginTop: 10 }}>
                  +₦{Number(creditedAmount).toLocaleString("en-NG")}
                </Text>
              ) : null}
              <Text style={{ fontSize: 13, color: tokens.text.muted, marginTop: 4, textAlign: "center" }}>
                {creditedAmount != null
                  ? t("trip.delivered.subSettled", "Credited to your wallet.")
                  : t("trip.delivered.sub", "Earnings will land in your wallet within a minute.")}
              </Text>
            </View>
          ) : null}

          {/* Status timeline */}
          <View style={{ marginTop: 14 }}>
            <Timeline status={status} type={type} t={t} />
          </View>

          {/* Action button */}
          <View style={{ marginTop: 16 }}>
            <StatusActionButton
              status={status}
              arrivedPickup={!!arrivedAt.pickup}
              arrivedDropoff={!!arrivedAt.dropoff}
              patching={patching || cancelling || podSubmitting}
              onAction={handleAction}
            />
          </View>

          {/* Cancel link */}
          {[STATUS.RIDER_ASSIGNED, STATUS.RIDER_EN_ROUTE, STATUS.PICKED_UP].includes(status) ? (
            <TouchableOpacity
              onPress={() => setCancelVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t("trip.cancelLinkAria", "Cancel trip")}
              style={{ alignSelf: "center", padding: 12, marginTop: 4 }}
              disabled={cancelling}
            >
              <Text style={{ color: tokens.status.errorStrong, fontSize: 13, fontWeight: "700" }}>
                {t("trip.cancelLink", "Cancel trip")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <ContactPartiesSheet
        visible={contactVisible}
        onClose={() => setContactVisible(false)}
        counterpartName={counterpart?.contactName}
        counterpartPhone={counterpart?.contactPhone}
        callAttempts={counterpartUserId ? (callAttempts[counterpartUserId] || 0) : 0}
        onCall={callCounterpart}
        onChat={() => {
          setContactVisible(false);
          setChatChannel(isPickupStage ? "RIDER_MERCHANT" : "CUSTOMER_RIDER");
        }}
        onReportUnreachable={reportUnreachable}
      />

      <ChatChannelPicker
        visible={chatPickerVisible}
        hasMerchant={!!merchantUserId}
        unreadCustomer={unreadCounts?.CUSTOMER_RIDER || 0}
        unreadMerchant={unreadCounts?.RIDER_MERCHANT || 0}
        onClose={() => setChatPickerVisible(false)}
        onPickCustomer={() => { setChatPickerVisible(false); setChatChannel("CUSTOMER_RIDER"); }}
        onPickMerchant={() => { setChatPickerVisible(false); setChatChannel("RIDER_MERCHANT"); }}
      />

      <ChatThread
        visible={!!chatChannel}
        channel={chatChannel}
        counterpartLabel={chatChannel === "RIDER_MERCHANT" ? (pickup?.contactName || t("trip.chatPicker.merchant", "Message merchant")) : (dropoff?.contactName || t("trip.chatPicker.customer", "Message customer"))}
        onClose={() => setChatChannel(null)}
      />

      <CancelTripSheet
        visible={cancelVisible}
        onClose={() => setCancelVisible(false)}
      />

      <WrongAddressSheet
        visible={!!wrongAddressStage}
        stage={wrongAddressStage}
        onClose={() => setWrongAddressStage(null)}
      />

      {/* Conditional render so the camera + signature WebView unmount
          immediately when the stage changes - keeps battery + memory in
          check rather than relying on Modal-hidden cleanup. */}
      {podStage === "photo" ? (
        <PodCaptureSheet
          visible
          requestId={requestId}
          onClose={() => setPodStage(null)}
          onContinue={() => advancePodStage("signature")}
        />
      ) : null}

      {podStage === "signature" ? (
        <SignaturePadSheet
          visible
          requestId={requestId}
          onClose={() => setPodStage(null)}
          onContinue={() => advancePodStage("otp")}
        />
      ) : null}

      {podStage === "otp" ? (
        <DeliveryOtpInputSheet
          visible
          requestId={requestId}
          submitting={podSubmitting}
          errorCode={podSubmitError}
          onClose={() => setPodStage(null)}
          onSubmit={(otp) => submitDelivery(otp)}
        />
      ) : null}

      <TripCancelledOverlay />
    </SafeAreaView>
  );
}

function Timeline({ status, type, t }) {
  const { tokens } = useTheme();
  const steps = type === "PACKAGE"
    ? [STATUS.RIDER_ASSIGNED, STATUS.RIDER_EN_ROUTE, STATUS.PICKED_UP, STATUS.IN_TRANSIT, STATUS.DELIVERED]
    : [STATUS.RIDER_ASSIGNED, STATUS.RIDER_EN_ROUTE, STATUS.PICKED_UP, STATUS.IN_TRANSIT, STATUS.DELIVERED];
  const currentIdx = steps.indexOf(status);
  const labels = {
    [STATUS.RIDER_ASSIGNED]: t("trip.timeline.assigned", "Assigned"),
    [STATUS.RIDER_EN_ROUTE]: t("trip.timeline.toPickup", "To pickup"),
    [STATUS.PICKED_UP]: t("trip.timeline.pickedUp", "Picked up"),
    [STATUS.IN_TRANSIT]: t("trip.timeline.toDropoff", "To dropoff"),
    [STATUS.DELIVERED]: t("trip.timeline.delivered", "Delivered"),
  };
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: tokens.bg.surface,
        borderWidth: 1,
        borderColor: tokens.border.default,
        borderRadius: 12,
        padding: 12,
      }}
    >
      {steps.map((s, idx) => {
        const done = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <View key={s} style={{ flex: 1, alignItems: "center" }}>
            <View
              style={{
                width: 14, height: 14, borderRadius: 7,
                backgroundColor: done ? tokens.brand.default : tokens.border.strong,
                borderWidth: isCurrent ? 3 : 0,
                borderColor: tokens.brand.softBorder,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                marginTop: 6,
                fontSize: 10,
                fontWeight: done ? "700" : "500",
                color: done ? tokens.text.primary : tokens.text.muted,
              }}
            >
              {labels[s]}
            </Text>
            {idx < steps.length - 1 ? (
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: -50,
                  width: 100,
                  height: 2,
                  backgroundColor: idx < currentIdx ? tokens.brand.default : tokens.border.default,
                  zIndex: -1,
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// Admin-curated place label - a small neutral pill under a dot, styled to read
// like a native map POI label. Renders on native via react-native-maps Marker
// children and on web via the react-native-maps.web shim (OverlayView).
function TripPlaceMarker({ place }) {
  return (
    <Marker
      coordinate={{ latitude: place.lat, longitude: place.lng }}
      title={place.name}
      zIndex={1}
    >
      <View
        style={{
          alignItems: "center",
          transform: [{ translateY: -24 }],
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.94)",
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 2,
            maxWidth: 150,
          }}
        >
          <Text
            style={{ fontSize: 11, fontWeight: "600", color: "#52525B" }}
            numberOfLines={1}
          >
            {place.name}
          </Text>
        </View>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginTop: 2,
            backgroundColor: "#A1A1AA",
            borderWidth: 1,
            borderColor: "#FFFFFF",
          }}
        />
      </View>
    </Marker>
  );
}
