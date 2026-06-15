/**
 * CheckoutScreen - review cart, pick address, fetch server-truth quote, submit.
 *
 * Phase 4 contract:
 *   - POST /requests/quote → returns { ...pricing, quoteToken, validUntil }
 *   - Quote is valid 5 min. UI shows a live countdown and auto-disables
 *     submission once expired.
 *   - POST /requests submits with the matching quoteToken; server re-verifies
 *     signature + TTL + locked numbers before persisting.
 *   - PIN bottom sheet before submit.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { goBackOr } from "../../lib/goBack";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { appendUploadFile } from '../../lib/uploadFile';
import { chooseImageSource } from '../../lib/chooseImageSource';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { useTheme } from '../../theme';
import { createRequest } from '../../store/slices/requestSlice';
import { fetchWallet } from '../../store/slices/walletSlice';
import { clearCart, selectCart } from '../../store/slices/cartSlice';
import { toServerItems } from '../../lib/cart';
import PinBottomSheet from '../../components/PinBottomSheet';
import { usePinGuard } from '../../lib/usePinGuard';
import { substitutionLabel } from '../../lib/requestStatus';

const money = (n) => `₦${Number(n || 0).toLocaleString()}`;

const QUOTE_TTL_MS = 5 * 60 * 1000;
const QUOTE_WARN_MS = 30 * 1000;

export default function CheckoutScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  // Cart, merchant identity, and pickup metadata all come from Redux now.
  // The previous shape (route.params.cart/merchantId/pickupLat/...) is dead.
  const cartState = useSelector(selectCart);
  const cart = cartState.lines;
  const merchantId = cartState.merchantId;
  const merchantSnapshot = cartState.merchant;
  const pickupLat = merchantSnapshot?.lat ?? 0;
  const pickupLng = merchantSnapshot?.lng ?? 0;
  const pickupAddress = merchantSnapshot?.address || 'Merchant Location';
  const pickupName = merchantSnapshot?.name;
  const { balance } = useSelector((s) => s.wallet);
  const { isCreating } = useSelector((s) => s.request);
  const requirePin = usePinGuard();

  const [selectedAddress, setSelectedAddress] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteFetchedAt, setQuoteFetchedAt] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Phase 8 - prescription upload state. `rxRequired` is derived from the
  // cart; `rxUrl` is set once the Cloudinary upload succeeds; `rxUploading`
  // gates the upload button while the signed POST is in flight.
  const rxRequired = useMemo(() => cart.some((l) => l.requiresPrescription), [cart]);
  const [rxUrl, setRxUrl] = useState(null);
  const [rxUploading, setRxUploading] = useState(false);

  // Drop a stale prescription if the customer went back to MerchantMenu and
  // removed every Rx line - otherwise we'd ship an Rx URL for a non-Rx order
  // and confuse the merchant + persist a dangling audit reference.
  useEffect(() => {
    if (!rxRequired && rxUrl) setRxUrl(null);
  }, [rxRequired, rxUrl]);

  useEffect(() => { dispatch(fetchWallet()); }, [dispatch]);

  // If we land here with no cart (stale route / cleared cart elsewhere /
  // logout-then-back), bounce to the Cart tab so the user sees an empty
  // state in the right place instead of a half-broken Checkout. The ref
  // suppresses the bounce in the brief window between dispatch(clearCart())
  // and navigation.replace('RequestTracking') after a successful submit.
  const justSubmittedRef = useRef(false);
  useEffect(() => {
    if (justSubmittedRef.current) return;
    if (!merchantId || cart.length === 0) {
      navigation.replace('MainTabs', { screen: 'CartTab' });
    }
  }, [merchantId, cart.length, navigation]);

  const itemsForServer = useMemo(() => toServerItems(cart), [cart]);

  const quotePayload = useMemo(() => {
    if (!selectedAddress) return null;
    return {
      type: 'MERCHANT_ORDER',
      merchantId,
      pickupLat, pickupLng,
      dropoffLat: selectedAddress.lat || selectedAddress.latitude || 0,
      dropoffLng: selectedAddress.lng || selectedAddress.longitude || 0,
      items: itemsForServer,
    };
  }, [selectedAddress?.id, merchantId, pickupLat, pickupLng, itemsForServer]); // eslint-disable-line

  // Refetch quote whenever the dropoff changes.
  const fetchQuote = async () => {
    if (!quotePayload) return;
    setQuoting(true);
    try {
      const r = await api.post('/requests/quote', quotePayload);
      setQuote(r?.data);
      setQuoteFetchedAt(Date.now());
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: t('request.toast.quoteFailed'),
        text2: err?.message,
      });
    } finally {
      setQuoting(false);
    }
  };

  useEffect(() => {
    if (!quotePayload) {
      setQuote(null);
      setQuoteFetchedAt(null);
      return undefined;
    }
    let alive = true;
    (async () => {
      setQuoting(true);
      try {
        const r = await api.post('/requests/quote', quotePayload);
        if (!alive) return;
        setQuote(r?.data);
        setQuoteFetchedAt(Date.now());
      } catch (err) {
        if (!alive) return;
        Toast.show({ type: 'error', text1: t('request.toast.quoteFailed'), text2: err?.message });
      } finally {
        if (alive) setQuoting(false);
      }
    })();
    return () => { alive = false; };
  }, [quotePayload]); // eslint-disable-line

  // Auto-refresh on focus if the quote is older than ~1 minute or expired.
  useFocusEffect(
    React.useCallback(() => {
      if (!quotePayload || !quoteFetchedAt) return;
      const age = Date.now() - quoteFetchedAt;
      if (age >= 60_000) fetchQuote();
    }, [quotePayload, quoteFetchedAt]) // eslint-disable-line
  );

  // Tick the countdown only while a quote is loaded.
  useEffect(() => {
    if (!quote) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [quote]);

  const expiresAt = quoteFetchedAt ? quoteFetchedAt + QUOTE_TTL_MS : null;
  const msUntilExpiry = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const quoteExpired = quote && msUntilExpiry === 0;

  const pickAddress = () => {
    navigation.navigate('SavedAddresses', {
      onSelect: (address) => setSelectedAddress(address),
    });
  };

  // Phase 8 - prescription upload. Two-step flow mirrors ProfilePhotoScreen:
  //   1. POST /auth/upload-signature with kind=prescription → signed params.
  //   2. POST multipart form to Cloudinary; persist the returned secure URL.
  const uploadPrescriptionFromSource = async (source) => {
    try {
      if (Platform.OS !== 'web') {
        const permission = source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            t('errors.FORBIDDEN'),
            source === 'camera'
              ? t('request.checkout.rxPermissionCamera')
              : t('request.checkout.rxPermissionLibrary'),
          );
          return;
        }
      }
      const launcher = (source === 'camera' && Platform.OS !== 'web')
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;
      const result = await launcher({
        mediaTypes: ['images'],
        // Pharmacist needs the whole scrip - don't crop. Reasonable quality
        // keeps the upload small without sacrificing legibility of handwriting.
        allowsEditing: false,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setRxUploading(true);
      const uri = result.assets[0].uri;

      const sigResp = await api.post('/auth/upload-signature', { kind: 'prescription' });
      const sig = sigResp?.data;
      if (!sig?.signature) throw new Error('No upload signature returned');

      const filename = uri.split('/').pop() || 'rx.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const mime = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

      const form = new FormData();
      await appendUploadFile(form, uri, { name: filename, type: mime });
      form.append('api_key', sig.apiKey);
      form.append('timestamp', String(sig.timestamp));
      form.append('signature', sig.signature);
      form.append('folder', sig.folder);
      form.append('public_id', sig.publicId);

      const upload = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: 'POST', body: form, headers: { Accept: 'application/json' } },
      );
      if (!upload.ok) {
        const text = await upload.text();
        throw new Error(`Upload failed: ${text}`);
      }
      const data = await upload.json();
      setRxUrl(data.secure_url);
      Toast.show({ type: 'success', text1: t('request.checkout.rxAttached') });
    } catch (err) {
      Toast.show({ type: 'error', text1: t('request.checkout.rxUploadFailed'), text2: err?.message || t('common.retry') });
    } finally {
      setRxUploading(false);
    }
  };

  const openPrescriptionPicker = () => {
    chooseImageSource(
      () => uploadPrescriptionFromSource('camera'),
      () => uploadPrescriptionFromSource('gallery'),
      {
        title: t('request.checkout.rxSectionTitle'),
        message: t('request.checkout.rxChoose'),
        camera: t('request.checkout.rxFromCamera'),
        gallery: t('request.checkout.rxFromGallery'),
        cancel: t('common.cancel'),
      },
    );
  };

  const openPin = () => {
    if (!selectedAddress) return Toast.show({ type: 'error', text1: t('request.checkout.addressRequired') });
    if (!quote) return Toast.show({ type: 'error', text1: t('request.checkout.waitingQuote') });
    if (quoteExpired) return Toast.show({ type: 'error', text1: t('request.toast.quoteExpired'), text2: t('request.toast.quoteExpiredSub') });
    if (rxRequired && !rxUrl) {
      return Toast.show({
        type: 'error',
        text1: t('errors.PRESCRIPTION_REQUIRED'),
        text2: t('request.checkout.rxBlockingCta'),
      });
    }
    if (Number(balance) < Number(quote.total)) {
      return Toast.show({
        type: 'error',
        text1: t('errors.INSUFFICIENT_BALANCE'),
        text2: t('request.toast.insufficientBalanceSub', { need: money(quote.total), have: money(balance) }),
      });
    }
    if (!requirePin()) return;
    setPinVisible(true);
  };

  const submitWithPin = async (pin) => {
    setConfirming(true);
    try {
      const result = await dispatch(
        createRequest({
          ...quotePayload,
          pickupAddress, pickupName,
          dropoffAddress: selectedAddress.address,
          dropoffName: selectedAddress.label || 'Home',
          paymentMethod: 'WALLET',
          quoteToken: quote.quoteToken,
          pin,
          // Phase 8 - only ship the URL when the order actually needs one,
          // so a stale upload (Rx item removed mid-checkout) never lands on
          // a non-Rx order. Server enforces presence when required.
          ...(rxRequired && rxUrl ? { prescriptionUrl: rxUrl } : {}),
        })
      ).unwrap();
      setPinVisible(false);
      // Order is now the backend's responsibility - the cart has done its
      // job. Wipe Redux + AsyncStorage so a tab-back to Cart shows empty
      // state and a returning shopper doesn't see stale items.
      justSubmittedRef.current = true;
      dispatch(clearCart());
      Toast.show({ type: 'success', text1: t('request.toast.requestPlaced') });
      navigation.replace('RequestTracking', { requestId: result.id });
    } catch (err) {
      // Forward the full structured error so PinBottomSheet sees the right
      // status (423 lockout, 401 wrong-PIN) and errors payload.
      const wrapped = new Error(err?.message || (typeof err === 'string' ? err : 'Try again'));
      wrapped.status = err?.status ?? null;
      wrapped.data = err?.data ?? null;
      throw wrapped;
    } finally {
      setConfirming(false);
    }
  };

  if (isCreating || confirming) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.bg.canvas }}>
        <ActivityIndicator size="large" color={tokens.brand.default} accessibilityLabel={t('common.loading')} />
        <Text style={{ marginTop: 12, color: tokens.text.muted }}>{t('request.checkout.placingOrder')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: tokens.bg.surface, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
        <TouchableOpacity
          onPress={() => goBackOr(navigation)}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: tokens.text.primary }}>
          {t('request.checkout.title')}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Cart */}
        <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '600', color: tokens.text.primary, marginBottom: 8 }}>
          {t('request.checkout.summary')}
        </Text>
        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, padding: 12, marginBottom: 16 }}>
          {cart.map((line) => (
            <View key={line.lineId} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ flex: 1, fontWeight: '500', color: tokens.text.primary }}>
                  {line.quantity}× {line.name}
                  {line.variantSummary ? ` · ${line.variantSummary}` : ''}
                </Text>
                <Text style={{ color: tokens.text.primary, fontWeight: '600' }}>{money(line.lineTotal)}</Text>
              </View>
              {(line.selectedOptions || []).map((g) => (
                <Text key={g.groupId} style={{ fontSize: 12, color: tokens.text.muted }}>
                  {g.groupName}: {g.items.map((i) => i.itemName).join(', ')}
                </Text>
              ))}
              {line.specialInstructions ? (
                <Text style={{ fontSize: 12, fontStyle: 'italic', color: tokens.text.muted }}>
                  “{line.specialInstructions}”
                </Text>
              ) : null}
              {/* Phase 8 - per-line markers in checkout review. */}
              {(line.substitution || line.requiresPrescription) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                  {line.substitution ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.category.groceries.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginRight: 6 }}>
                      <Ionicons name="swap-horizontal" size={11} color={tokens.category.groceries.icon} />
                      <Text style={{ color: tokens.category.groceries.icon, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>
                        {substitutionLabel(line.substitution, t)}
                      </Text>
                    </View>
                  ) : null}
                  {line.requiresPrescription ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.status.warningSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                      <Ionicons name="medkit-outline" size={11} color={tokens.status.warningStrong} />
                      <Text style={{ color: tokens.status.warningStrong, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>{t('merchant.rx')}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Phase 8 - prescription upload. Shown only when at least one cart
            line is flagged requiresPrescription. Server re-validates the URL
            at order-create time, so this is UX gating, not authoritative. */}
        {rxRequired && (
          <>
            <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '600', color: tokens.text.primary, marginBottom: 8 }}>
              {t('request.checkout.rxSectionTitle')}
            </Text>
            <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              {rxUrl ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image
                    source={{ uri: rxUrl }}
                    style={{ width: 56, height: 56, borderRadius: 8, marginRight: 12, backgroundColor: tokens.bg.surfaceMuted }}
                    accessibilityLabel={t('request.checkout.rxAttached')}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: tokens.text.primary }}>{t('request.checkout.rxAttached')}</Text>
                    <Text style={{ fontSize: 12, color: tokens.text.muted, marginTop: 2 }}>
                      {t('request.checkout.rxSectionHint')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={openPrescriptionPicker}
                    disabled={rxUploading}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('request.checkout.rxReplace')}
                    accessibilityState={{ disabled: rxUploading, busy: rxUploading }}
                  >
                    <Text style={{ color: tokens.brand.default, fontWeight: '700' }}>
                      {rxUploading ? t('request.checkout.rxUploading') : t('request.checkout.rxReplace')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={openPrescriptionPicker}
                  disabled={rxUploading}
                  accessibilityRole="button"
                  accessibilityLabel={t('request.checkout.rxUpload')}
                  accessibilityState={{ disabled: rxUploading, busy: rxUploading }}
                  style={{ alignItems: 'center', paddingVertical: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: tokens.status.warningStrong, borderRadius: 10, backgroundColor: tokens.status.warningSoft }}
                >
                  {rxUploading ? (
                    <ActivityIndicator color={tokens.status.warningStrong} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={24} color={tokens.status.warningStrong} />
                      <Text style={{ marginTop: 6, fontWeight: '700', color: tokens.status.warningStrong }}>{t('request.checkout.rxUpload')}</Text>
                      <Text style={{ fontSize: 12, color: tokens.status.warningStrong, marginTop: 2 }}>
                        {t('request.checkout.rxSectionHint')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Address */}
        <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '600', color: tokens.text.primary, marginBottom: 8 }}>
          {t('request.checkout.deliverTo')}
        </Text>
        <TouchableOpacity
          onPress={pickAddress}
          style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel={t('request.checkout.deliverTo')}
          accessibilityHint={selectedAddress?.address || t('request.pickAddress')}
        >
          <Ionicons name={selectedAddress ? 'location' : 'add-circle-outline'} size={22} color={tokens.brand.default} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            {selectedAddress ? (
              <>
                <Text style={{ fontWeight: '600', color: tokens.text.primary }}>{selectedAddress.label || t('request.addAddress')}</Text>
                <Text style={{ color: tokens.text.muted, fontSize: 12 }} numberOfLines={1}>{selectedAddress.address}</Text>
              </>
            ) : (
              <Text style={{ color: tokens.brand.strong, fontWeight: '600' }}>{t('request.pickAddress')}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={tokens.text.muted} />
        </TouchableOpacity>

        {/* Quote breakdown */}
        <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '600', color: tokens.text.primary, marginBottom: 8 }}>
          {t('request.checkout.costBreakdown')}
        </Text>
        <View style={{ backgroundColor: tokens.bg.surface, borderRadius: 12, padding: 14 }}>
          {!selectedAddress ? (
            <Text style={{ color: tokens.text.muted, textAlign: 'center', paddingVertical: 10 }}>
              {t('request.checkout.needAddress')}
            </Text>
          ) : quoting || !quote ? (
            <ActivityIndicator color={tokens.brand.default} accessibilityLabel={t('common.loading')} />
          ) : (
            <>
              <Row label={t('request.checkout.subtotal')} value={money(quote.subtotal)} />
              <Row label={t('request.checkout.deliveryFee')} value={money(quote.deliveryFee)} />
              <Row label={t('request.checkout.platformFee')} value={money(quote.platformFee)} />
              {Number(quote.tax) > 0 && <Row label={t('request.checkout.tax')} value={money(quote.tax)} />}
              <View style={{ borderTopWidth: 1, borderTopColor: tokens.border.default, paddingTop: 10, marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: tokens.text.primary }}>{t('request.checkout.total')}</Text>
                <Text style={{ fontWeight: '700', color: tokens.brand.default }}>{money(quote.total)}</Text>
              </View>
              <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 6 }}>
                {t('request.checkout.etaLine', { minutes: quote.estimatedMinutes, km: quote.distanceKm })}
              </Text>
              <QuoteCountdown
                msUntilExpiry={msUntilExpiry}
                expired={quoteExpired}
                refreshing={quoting}
                onRefresh={fetchQuote}
              />
            </>
          )}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: tokens.bg.surface, borderTopWidth: 1, borderTopColor: tokens.border.default }}>
        <TouchableOpacity
          onPress={openPin}
          disabled={!quote || !selectedAddress || quoting || quoteExpired || (rxRequired && !rxUrl)}
          accessibilityRole="button"
          accessibilityLabel={t('request.checkout.place')}
          accessibilityState={{ disabled: !quote || !selectedAddress || quoting || quoteExpired || (rxRequired && !rxUrl) }}
          style={{
            backgroundColor: !quote || !selectedAddress || quoting || quoteExpired || (rxRequired && !rxUrl) ? tokens.border.default : tokens.brand.default,
            paddingVertical: 14, borderRadius: 12, alignItems: 'center',
          }}
        >
          <Text style={{ color: tokens.text.onBrand, fontWeight: '700', fontSize: 16 }}>
            {quoteExpired
              ? t('request.checkout.quoteExpired')
              : rxRequired && !rxUrl
                ? t('request.checkout.rxBlockingCta')
                : quote
                  ? t('request.checkout.placeWithTotal', { amount: money(quote.total) })
                  : t('request.checkout.place')}
          </Text>
        </TouchableOpacity>
      </View>

      <PinBottomSheet
        isVisible={pinVisible}
        onClose={() => setPinVisible(false)}
        onConfirm={submitWithPin}
        onSetupPin={() => navigation.navigate('SetPin')}
        title={t('request.checkout.confirmPaymentTitle')}
        subtitle={quote
          ? t('request.checkout.confirmPaymentSub', { amount: money(quote.total) })
          : t('request.pin.confirmFallback')}
      />
    </SafeAreaView>
  );
}

const QuoteCountdown = ({ msUntilExpiry, expired, refreshing, onRefresh }) => {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const seconds = Math.ceil(msUntilExpiry / 1000);
  const warn = msUntilExpiry > 0 && msUntilExpiry <= QUOTE_WARN_MS;
  const color = expired ? tokens.status.error : warn ? tokens.brand.default : tokens.text.muted;
  const label = expired
    ? t('request.checkout.quoteExpired')
    : msUntilExpiry > 60_000
      ? t('request.checkout.quoteValidMin', { m: Math.floor(seconds / 60), s: seconds % 60 })
      : t('request.checkout.quoteValidSec', { s: seconds });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
      <Ionicons name={expired ? 'time' : 'timer-outline'} size={14} color={color} />
      <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '600', color, flex: 1 }}>{label}</Text>
      <TouchableOpacity
        onPress={onRefresh}
        disabled={refreshing}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('request.checkout.refresh')}
        accessibilityState={{ disabled: refreshing, busy: refreshing }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.brand.strong }}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const Row = ({ label, value }) => {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: tokens.text.muted }}>{label}</Text>
      <Text style={{ color: tokens.text.primary }}>{value}</Text>
    </View>
  );
};
