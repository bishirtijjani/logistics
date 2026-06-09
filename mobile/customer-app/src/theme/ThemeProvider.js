import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from './ThemeContext';
import { light, dark, radius, spacing } from './tokens';

const STORAGE_KEY = '@customer-app/theme-mode';
const VALID_MODES = ['light', 'dark', 'system'];

const resolveSystemScheme = () =>
  Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

export function ThemeProvider({ children }) {
  // `mode` is the user's choice: 'light' | 'dark' | 'system'.
  // `systemScheme` is the OS-reported scheme. The active scheme is derived from
  // both: if mode === 'system', track the OS; otherwise the mode IS the scheme.
  // Default to light for users with no saved preference; a persisted choice
  // (set via the theme switcher) still wins after hydration, and the user can
  // pick 'system' to track the OS.
  const [mode, setModeState] = useState('light');
  const [systemScheme, setSystemScheme] = useState(resolveSystemScheme);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate persisted choice on boot. Until this resolves we render `null`
  // (children gated below) so the user never sees a flash of the wrong theme
  // when they have a persisted preference that differs from the OS default.
  // AsyncStorage typically resolves in <30ms, and the native launch screen is
  // still displayed during this window.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && stored && VALID_MODES.includes(stored)) {
          setModeState(stored);
        }
      } catch (_) {
        // Storage read failure is non-fatal - we just stick with 'light'.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Track OS appearance changes while the app is running. Only observable when
  // `mode === 'system'`, but always wired so the user can switch to system mode
  // and have it react immediately without re-mounting.
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
