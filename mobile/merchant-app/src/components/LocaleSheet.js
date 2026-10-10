/**
 * LocaleSheet - bottom-sheet modal for picking the app language.
 *
 * Used from the Profile screen's language toggle. On select:
 *   1. `setLocale(code)` persists the choice to SecureStore.
 *   2. `i18n.changeLanguage()` fires, which re-renders every consumer of
 *      `useTranslation()` automatically.
 *   3. The sheet closes.
 *
 * Built with React Native's stock `Modal` to match the existing modal
 * patterns in HomeScreen / RequestTrackingScreen - no extra deps.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { SUPPORTED_LOCALES, setLocale } from '../i18n';
import { InModalToast } from './toastShared';

const FLAG_FOR = {
  // Plain text icons keep the sheet readable even for users with rendering
  // gaps for emoji. Ionicons "language" is the same glyph for both.
  en: 'EN',
  ha: 'HA',
};

const LocaleSheet = ({ visible, onClose }) => {
  const { t, i18n } = useTranslation();
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const current = i18n.language;

  const onPick = async (code) => {
    if (code !== current) {
      await setLocale(code);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{t('locale.title')}</Text>
          <Text style={styles.subtitle}>{t('locale.subtitle')}</Text>

          {SUPPORTED_LOCALES.map((code) => {
            const isPicked = code === current;
            return (
              <TouchableOpacity
                key={code}
                onPress={() => onPick(code)}
                activeOpacity={0.7}
                style={[styles.row, isPicked && styles.rowPicked]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isPicked }}
                accessibilityLabel={t(`locale.${code}`)}
              >
                <View style={styles.flag}>
                  <Text style={styles.flagText}>{FLAG_FOR[code]}</Text>
                </View>
                <Text style={styles.rowLabel}>{t(`locale.${code}`)}</Text>
                {isPicked ? (
                  <Ionicons name="checkmark-circle" size={22} color={tokens.brand.default} />
                ) : (
                  <View style={styles.radioEmpty} />
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            onPress={onClose}
            style={styles.dismiss}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={styles.dismissText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
        <InModalToast />
      </View>
    </Modal>
  );
};

const makeStyles = (tokens) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tokens.bg.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  grabber: {
    width: 44,
    height: 5,
    backgroundColor: tokens.border.default,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    color: tokens.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: tokens.text.muted,
    marginTop: 4,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: tokens.border.default,
    marginBottom: 10,
  },
  rowPicked: {
    borderColor: tokens.brand.default,
    backgroundColor: tokens.brand.soft,
  },
  flag: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: tokens.bg.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  flagText: {
    fontSize: 12,
    fontWeight: '900',
    color: tokens.text.primary,
    letterSpacing: 0.5,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.border.default,
  },
  dismiss: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.text.muted,
  },
});

export default LocaleSheet;
