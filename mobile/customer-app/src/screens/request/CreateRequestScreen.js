/**
 * CreateRequestScreen - PACKAGE flow (courier delivery, no merchant).
 *
 * Captures pickup + dropoff via the SavedAddresses picker, sender + recipient
 * contact info, package size, optional description, and submits to POST /requests
 * with type=PACKAGE.
 *
 * Phase 4 contract:
 *   - POST /requests/quote → { ...pricing, quoteToken, validUntil }
 *   - POST /requests with the same shape + quoteToken (server re-verifies sig + TTL)
 *   - PIN bottom sheet before submit
 */

import React, { useEffect, useMemo, useState } from 'react';
import { goBackOr } from "../../lib/goBack";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { useTheme } from '../../theme';
import { createRequest } from '../../store/slices/requestSlice';
import { fetchWallet } from '../../store/slices/walletSlice';
import PinBottomSheet from '../../components/PinBottomSheet';
import { usePinGuard } from '../../lib/usePinGuard';

const money = (n) => `₦${Number(n || 0).toLocaleString()}`;

// Size options. `key` ties to i18n; value is the wire enum sent to the server.
const SIZES = [
  { value: 'SMALL',  key: 'small'  },
  { value: 'MEDIUM', key: 'medium' },
  { value: 'LARGE',  key: 'large'  },
];

const QUOTE_TTL_MS = 5 * 60 * 1000;
const QUOTE_WARN_MS = 30 * 1000;

export default function CreateRequestScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { user } = useSelector((s) => s.auth);
  const { balance } = useSelector((s) => s.wallet);

  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [description, setDescription] = useState('');
  const [size, setSize] = useState('SMALL');
  const [senderName, setSenderName] = useState(user ? `${user.firstName} ${user.lastName}` : '');
  const [senderPhone, setSenderPhone] = useState(user?.phone || '');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [instructions, setInstructions] = useState('');

  const [quote, setQuote] = useState(null);
  const [quoteFetchedAt, setQuoteFetchedAt] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [pinVisible, setPinVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { dispatch(fetchWallet()); }, [dispatch]);

  useEffect(() => {
    if (!quote) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [quote]);

  // One-off (map-picked) pickup/dropoff arrive without an `id`. Keying this
  // memo on `pickup?.id`/`dropoff?.id` meant selecting a one-off location
  // never changed the deps (the id stays undefined), so payloadBase stayed
  // null, the quote was never fetched, and the cost breakdown spun forever.
  // Key on the coordinates that actually drive the quote so both saved and
  // one-off locations refetch correctly.
  const pickupLat = pickup ? (pickup.lat || pickup.latitude || 0) : null;
  const pickupLng = pickup ? (pickup.lng || pickup.longitude || 0) : null;
  const dropoffLat = dropoff ? (dropoff.lat || dropoff.latitude || 0) : null;
  const dropoffLng = dropoff ? (dropoff.lng || dropoff.longitude || 0) : null;

  const payloadBase = useMemo(() => {
    if (!pickup || !dropoff) return null;
    return {
      type: 'PACKAGE',
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      package: { size },
    };
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, size]); // eslint-disable-line

  const fetchQuote = async () => {
    if (!payloadBase) return;
    setQuoting(true);
    setQuoteError(null);
    try {
      const r = await api.post('/requests/quote', payloadBase);
      setQuote(r?.data);
      setQuoteFetchedAt(Date.now());
      setQuoteError(null);
    } catch (err) {
      setQuoteError(err?.message || t('request.toast.quoteFailed'));
      Toast.show({ type: 'error', text1: t('request.toast.quoteFailed'), text2: err?.message });
    } finally {
      setQuoting(false);
    }
  };

  useEffect(() => {
    if (!payloadBase) {
      setQuote(null);
      setQuoteFetchedAt(null);
      setQuoteError(null);
      return undefined;
    }
    let alive = true;
    (async () => {
      setQuoting(true);
      setQuoteError(null);
      try {
        const r = await api.post('/requests/quote', payloadBase);
        if (!alive) return;
        setQuote(r?.data);
        setQuoteFetchedAt(Date.now());
        setQuoteError(null);
      } catch (err) {
        if (!alive) return;
        setQuoteError(err?.message || t('request.toast.quoteFailed'));
        Toast.show({ type: 'error', text1: t('request.toast.quoteFailed'), text2: err?.message });
      } finally {
        if (alive) setQuoting(false);
      }
    })();
    return () => { alive = false; };
  }, [payloadBase]); // eslint-disable-line

  const quoteExpiresAt = quoteFetchedAt ? quoteFetchedAt + QUOTE_TTL_MS : null;
  const msUntilExpiry = quoteExpiresAt ? Math.max(0, quoteExpiresAt - now) : 0;
  const quoteExpired = quote && msUntilExpiry === 0;

  const pickLocation = (target) => {
    navigation.navigate('SavedAddresses', {
      onSelect: (addr) => {
        if (target === 'pickup') setPickup(addr);
        else setDropoff(addr);
      },
    });
  };

  const validateForm = () => {
    if (!pickup || !dropoff) {
      Toast.show({ type: 'error', text1: t('request.toast.pickBothAddresses') });
      return false;
    }
    if (!senderName.trim() || !senderPhone.trim() || !recipientName.trim() || !recipientPhone.trim()) {
      Toast.show({ type: 'error', text1: t('request.toast.senderRecipientRequired') });
      return false;
    }
    if (!quote) {
      Toast.show({ type: 'error', text1: t('request.toast.waitingQuote') });
      return false;
    }
    if (quoteExpired) {
      Toast.show({ type: 'error', text1: t('request.toast.quoteExpired'), text2: t('request.toast.quoteExpiredSub') });
      return false;
    }
    if (Number(balance) < Number(quote.total)) {
      Toast.show({
        type: 'error',
        text1: t('request.toast.insufficientBalance'),
        text2: t('request.toast.insufficientBalanceSub', { need: money(quote.total), have: money(balance) }),
      });
      return false;
    }
    return true;
  };

  const requirePin = usePinGuard();

  const openPin = () => {
    if (!validateForm()) return;
    if (!requirePin()) return;
    setPinVisible(true);
  };

  const submitWithPin = async (pin) => {
    setSubmitting(true);
    try {
      const result = await dispatch(
        createRequest({
          ...payloadBase,
          pickupAddress: pickup.address,
          pickupName: pickup.label,
          dropoffAddress: dropoff.address,
          dropoffName: dropoff.label,
          package: {
            description: description.trim() || undefined,
            size,
            senderName,
            senderPhone,
            recipientName,
            recipientPhone,
            instructions: instructions.trim() || undefined,
          },
          paymentMethod: 'WALLET',
          quoteToken: quote.quoteToken,
          pin,
        })
      ).unwrap();
      setPinVisible(false);
      Toast.show({ type: 'success', text1: t('request.toast.requestPlaced') });
      navigation.replace('RequestTracking', { requestId: result.id });
    } catch (err) {
      const wrapped = new Error(err?.message || (typeof err === 'string' ? err : t('common.retry')));
      wrapped.status = err?.status ?? null;
      wrapped.data = err?.data ?? null;
      throw wrapped;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: tokens.bg.surface, borderBottomWidth: 1, borderBottomColor: tokens.border.default }}>
          <TouchableOpacity
            onPress={() => goBackOr(navigation)}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}
          >
            <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: tokens.text.primary }}>
            {t('request.createTitle')}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Section title={t('request.pickup')}>
            <LocationPicker placeholder={t('request.pickupPh')} value={pickup} onPress={() => pickLocation('pickup')} a11yLabel={t('request.pickupAddress')} />
          </Section>

          <Section title={t('request.dropoff')}>
            <LocationPicker placeholder={t('request.dropoffPh')} value={dropoff} onPress={() => pickLocation('dropoff')} a11yLabel={t('request.dropoffAddress')} />
          </Section>

          <Section title={t('request.packageSize')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {SIZES.map((s) => {
                const active = size === s.value;
                const label = t(`request.${s.key}`);
                const hint = t(`request.sizeHints.${s.key}`);
                return (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => setSize(s.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={label}
                    accessibilityHint={hint}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
                      borderColor: active ? tokens.brand.default : tokens.border.default,
                      backgroundColor: active ? `${tokens.brand.default}15` : tokens.bg.surface,
                      marginRight: 8, marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontWeight: '600', color: active ? tokens.brand.default : tokens.text.primary }}>{label}</Text>
                    <Text style={{ fontSize: 11, color: tokens.text.muted }}>{hint}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          <Section title={t('request.whatsInside')}>
            <Input value={description} onChangeText={setDescription} placeholder={t('request.whatsInsidePh')} />
          </Section>

          <Section title={t('request.sender')}>
            <Input value={senderName} onChangeText={setSenderName} placeholder={t('request.senderName')} />
            <View style={{ height: 8 }} />
            <Input value={senderPhone} onChangeText={setSenderPhone} placeholder={t('request.senderPhone')} keyboardType="phone-pad" />
          </Section>

          <Section title={t('request.recipient')}>
            <Input value={recipientName} onChangeText={setRecipientName} placeholder={t('request.recipientName')} />
            <View style={{ height: 8 }} />
            <Input value={recipientPhone} onChangeText={setRecipientPhone} placeholder={t('request.recipientPhone')} keyboardType="phone-pad" />
            <View style={{ height: 8 }} />
            <Input value={instructions} onChangeText={setInstructions} placeholder={t('request.specialInstructions')} multiline />
          </Section>

          {/* Quote */}
          <View style={{ marginTop: 12, padding: 14, backgroundColor: tokens.bg.surface, borderRadius: 12 }}>
            {(!pickup || !dropoff) ? (
              <Text style={{ color: tokens.text.muted, textAlign: 'center' }}>
                {t('request.quote.needAddresses')}
              </Text>
            ) : quoteError && !quoting ? (
              <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                <Ionicons name="cloud-offline-outline" size={26} color={tokens.status.error} />
                <Text style={{ color: tokens.text.primary, fontWeight: '700', marginTop: 8 }}>
                  {t('request.toast.quoteFailed')}
                </Text>
                <Text style={{ color: tokens.text.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                  {quoteError}
                </Text>
                <TouchableOpacity
                  onPress={fetchQuote}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.retry')}
                  style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: tokens.brand.default }}
                >
                  <Text style={{ color: tokens.text.onBrand, fontWeight: '700' }}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : quoting || !quote ? (
              <ActivityIndicator color={tokens.brand.default} accessibilityLabel={t('common.loading')} />
            ) : (
              <>
                <Row label={t('request.quote.deliveryFee')} value={money(quote.deliveryFee)} />
                <View style={{ borderTopWidth: 1, borderTopColor: tokens.border.default, paddingTop: 10, marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '700', color: tokens.text.primary }}>{t('request.quote.total')}</Text>
                  <Text style={{ fontWeight: '700', color: tokens.brand.default }}>{money(quote.total)}</Text>
                </View>
                <Text style={{ fontSize: 11, color: tokens.text.muted, marginTop: 6 }}>
                  {t('request.quote.etaLine', { minutes: quote.estimatedMinutes, km: quote.distanceKm })}
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
            disabled={!quote || submitting || quoteExpired}
            accessibilityRole="button"
            accessibilityState={{ disabled: !quote || submitting || quoteExpired, busy: submitting }}
            accessibilityLabel={t('request.cta.placeRequest')}
            style={{ backgroundColor: !quote || submitting || quoteExpired ? tokens.border.default : tokens.brand.default, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
          >
            <Text style={{ color: tokens.text.onBrand, fontWeight: '700', fontSize: 16 }}>
              {submitting
                ? t('request.cta.placing')
                : quoteExpired
                  ? t('request.cta.quoteExpired')
                  : quote
                    ? t('request.cta.placeRequestWith', { amount: money(quote.total) })
                    : t('request.cta.placeRequest')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <PinBottomSheet
        isVisible={pinVisible}
        onClose={() => setPinVisible(false)}
        onConfirm={submitWithPin}
        onSetupPin={() => navigation.navigate('SetPin')}
        title={t('request.pin.confirmTitle')}
        subtitle={quote ? t('request.pin.confirmSub', { amount: money(quote.total) }) : t('request.pin.confirmFallback')}
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
        accessibilityState={{ disabled: refreshing }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: tokens.brand.strong }}>
          {refreshing ? t('request.checkout.refreshing') : t('request.checkout.refresh')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const Section = ({ title, children }) => {
  const { tokens } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text accessibilityRole="header" style={{ fontSize: 14, fontWeight: '600', color: tokens.text.primary, marginBottom: 6 }}>{title}</Text>
      {children}
    </View>
  );
};

const Input = (props) => {
  const { tokens } = useTheme();
  return (
    <TextInput
      {...props}
      accessibilityLabel={props.accessibilityLabel || props.placeholder}
      placeholderTextColor={tokens.text.muted}
      style={{ backgroundColor: tokens.bg.surface, borderRadius: 10, padding: 12, fontSize: 14, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default, ...(props.multiline ? { minHeight: 70, textAlignVertical: 'top' } : {}) }}
    />
  );
};

const LocationPicker = ({ placeholder, value, onPress, a11yLabel }) => {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel || placeholder}
      accessibilityHint={value?.address || placeholder}
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.bg.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: tokens.border.default }}
    >
      <Ionicons name={value ? 'location' : 'location-outline'} size={20} color={tokens.brand.default} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        {value ? (
          <>
            <Text style={{ fontWeight: '600', color: tokens.text.primary }}>{value.label || a11yLabel}</Text>
            <Text style={{ fontSize: 12, color: tokens.text.muted }} numberOfLines={1}>{value.address}</Text>
          </>
        ) : (
          <Text style={{ color: tokens.text.muted }}>{placeholder}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={tokens.text.muted} />
    </TouchableOpacity>
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
