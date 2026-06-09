import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from './ThemeContext';
import { light, dark, radius, spacing } from './tokens';

const STORAGE_KEY = '@rider-app/theme-mode';
const VALID_MODES = ['light', 'dark', 'system'];

const resolveSystemScheme = () =>
  Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('system');
  const [systemScheme, setSystemScheme] = useState(resolveSystemScheme);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && stored && VALID_MODES.includes(stored)) {
          setModeState(stored);
        }
      } catch (_) {
        // Storage read failure is non-fatal - we just stick with 'system'.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const scheme = mode === 'system' ? systemScheme : mode;
  const tokens = scheme === 'dark' ? dark : light;

  const setMode = useCallback(async (next) => {
    if (!VALID_MODES.includes(next)) return;
    setModeState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch (_) {
      // Persistence failure is non-fatal - choice still applies for this session.
    }
  }, []);

  const value = useMemo(
    () => ({
      mode,
      scheme,
      tokens,
      radius,
      spacing,
      setMode,
      isDark: scheme === 'dark',
    }),
    [mode, scheme, tokens, setMode]
  );

  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
