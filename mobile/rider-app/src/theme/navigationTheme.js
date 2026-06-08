import { DefaultTheme, DarkTheme } from '@react-navigation/native';

export function buildNavigationTheme(tokens, isDark) {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: tokens.brand.default,
      // Screen/canvas background for the navigators (the themed root View in
      // App.js paints the same color behind everything). bottom-tabs ignores
      // this and sets its scene background via `sceneStyle` instead.
      background: tokens.bg.canvas,
      card: tokens.bg.surface,
      text: tokens.text.primary,
      border: tokens.border.default,
      notification: tokens.status.error,
    },
  };
}
