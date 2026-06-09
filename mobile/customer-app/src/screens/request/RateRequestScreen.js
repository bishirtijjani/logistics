/**
 * RateRequestScreen - post-delivery rating for both merchant and rider.
 * For PACKAGE requests only the rider section renders.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../theme';
import { rateRequest } from '../../store/slices/requestSlice';

export default function RateRequestScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { isRating } = useSelector((s) => s.request);

  const request = params?.request || {};
  const hasMerchant = !!request.merchantId;

  const [merchantScore, setMerchantScore] = useState(0);
  const [merchantComment, setMerchantComment] = useState('');
  const [riderScore, setRiderScore] = useState(0);
  const [riderComment, setRiderComment] = useState('');

  const submit = async () => {
    if (merchantScore === 0 && riderScore === 0) {
      return Toast.show({ type: 'error', text1: t('rate.pickAtLeastOne') });
    }
    const payload = {};
    if (hasMerchant && merchantScore > 0) {
      payload.merchantScore = merchantScore;
      if (merchantComment.trim()) payload.merchantComment = merchantComment.trim();
    }
    if (riderScore > 0) {
      payload.riderScore = riderScore;
      if (riderComment.trim()) payload.riderComment = riderComment.trim();
    }
    try {
      await dispatch(rateRequest({ requestId: request.id, ratingData: payload })).unwrap();
      Toast.show({ type: 'success', text1: t('rate.thanks') });
      navigation.popToTop();
    } catch (err) {
      Toast.show({ type: 'error', text1: t('rate.failed'), text2: err?.message || t('common.retry') });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', padding: 14, backgroundColor: tokens.bg.surface, borderBottomWidth: 1, borderBottomColor: tokens.border.default, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
        >
          <Ionicons name="arrow-back" size={22} color={tokens.text.primary} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: tokens.text.primary }}>
          {t('rate.title')}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {hasMerchant && (
          <RatingBlock
            title={request.merchant?.name ? t('rate.rateMerchant', { name: request.merchant.name }) : t('rate.rateMerchantFallback')}
            score={merchantScore}
            setScore={setMerchantScore}
            comment={merchantComment}
            setComment={setMerchantComment}
            t={t}
          />
        )}
        <RatingBlock
          title={t('rate.rateRider')}
          score={riderScore}
          setScore={setRiderScore}
          comment={riderComment}
          setComment={setRiderComment}
          t={t}
        />

        <TouchableOpacity
          disabled={isRating}
          onPress={submit}
          accessibilityRole="button"
          accessibilityLabel={t('rate.submit')}
          accessibilityState={{ disabled: isRating, busy: isRating }}
          style={{ backgroundColor: tokens.brand.default, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12, opacity: isRating ? 0.6 : 1 }}
        >
          {isRating ? <ActivityIndicator color={tokens.text.onBrand} /> : <Text style={{ color: tokens.text.onBrand, fontWeight: '700' }}>{t('rate.submit')}</Text>}
        </TouchableOpacity>

        {request.id && (
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateDispute', { requestId: request.id })}
            accessibilityRole="button"
            style={{ paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
          >
            <Text style={{ color: tokens.status.error, fontWeight: '600', fontSize: 13 }}>
              {t('support.somethingWrong')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RatingBlock({ title, score, setScore, comment, setComment, t }) {
  const { tokens } = useTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '600', color: tokens.text.primary, marginBottom: 8 }}>{title}</Text>
      <View style={{ flexDirection: 'row', marginBottom: 8 }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setScore(n)}
            style={{ marginRight: 8 }}
            accessibilityRole="radio"
            accessibilityLabel={t('rate.starLabel', { count: n })}
            accessibilityState={{ selected: n === score }}
          >
            <Ionicons name={n <= score ? 'star' : 'star-outline'} size={32} color={n <= score ? '#FFA500' : tokens.text.muted} />
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        placeholder={t('rate.commentPh')}
        accessibilityLabel={t('rate.commentPh')}
        placeholderTextColor={tokens.text.muted}
        value={comment}
        onChangeText={(text) => text.length <= 250 && setComment(text)}
        multiline
        style={{ backgroundColor: tokens.bg.surface, borderRadius: 10, padding: 12, fontSize: 14, color: tokens.text.primary, borderWidth: 1, borderColor: tokens.border.default, minHeight: 60, textAlignVertical: 'top' }}
      />
    </View>
  );
}
