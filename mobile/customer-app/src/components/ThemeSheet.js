/**
 * ThemeSheet — bottom-sheet modal for picking the app appearance.
 *
 * Used from the Profile screen's appearance row. Lets the user pick:
 *   - Light  → always light, regardless of OS setting
 *   - Dark   → always dark, regardless of OS setting
 *   - System → follow the OS-level color scheme (live)
 *
 * The chosen mode is persisted by ThemeProvider (AsyncStorage) and applied to
 * the whole tree via context — no per-screen wiring needed.
 *
 * Patterned after `LocaleSheet` so it feels like the same surface.
 */

import React from 'react';
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

const MODES = ['system', 'light', 'dark'];

const ICON_FOR = {
  system: 'phone-portrait-outline',
  light:  'sunny-outline',
  dark:   'moon-outline',
};

const ThemeSheet = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const { mode, tokens, setMode } = useTheme();

  const onPick = async (next) => {
    if (next !== mode) await setMode(next);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: tokens.overlay.scrim }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: tokens.bg.surface }]}>
          <View style={[styles.grabber, { backgroundColor: tokens.border.default }]} />
          <Text style={[styles.title, { color: tokens.text.primary }]}>{t('theme.title')}</Text>
          <Text style={[styles.subtitle, { color: tokens.text.muted }]}>{t('theme.subtitle')}</Text>

          {MODES.map((code) => {
            const isPicked = code === mode;
            return (
              <TouchableOpacity
                key={code}
                onPress={() => onPick(code)}
                activeOpacity={0.7}
                style={[
                  styles.row,
                  { borderColor: tokens.border.default },
                  isPicked && {
                    borderColor: tokens.brand.default,
                    backgroundColor: tokens.brand.soft,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isPicked }}
                accessibilityLabel={t(`theme.${code}`)}
                accessibilityHint={t(`theme.${code}Hint`)}
              >
                <View style={[styles.iconCircle, { backgroundColor: tokens.bg.surfaceMuted }]}>
                  <Ionicons name={ICON_FOR[code]} size={19} color={tokens.text.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: tokens.text.primary }]}>
                    {t(`theme.${code}`)}
                  </Text>
                  <Text style={[styles.rowSub, { color: tokens.text.muted }]}>
                    {t(`theme.${code}Hint`)}
                  </Text>
                </View>
                {isPicked ? (
                  <Ionicons name="checkmark-circle" size={22} color={tokens.brand.default} />
                ) : (
                  <View style={[styles.radioEmpty, { borderColor: tokens.border.default }]} />
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
            <Text style={[styles.dismissText, { color: tokens.text.muted }]}>
              {t('common.close')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Static-shape styles only — colors are applied inline from `tokens` above so
// every property reacts to mode changes. Keeping the StyleSheet.create gives
// us shape-stable refs the diff can short-circuit on.
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
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
    marginBottom: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 1,
  },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  dismiss: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ThemeSheet;
