import { DefaultTheme, DarkTheme } from '@react-navigation/native';

// Bridge our semantic tokens into the shape React Navigation expects on the
// `<NavigationContainer theme={...}>` prop. The base themes ship correct
// `fonts` for both modes; we only override `colors` and the `dark` flag.
export function buildNavigationTheme(tokens, isDark) {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: tokens.brand.default,
      background: tokens.bg.canvas,
      card: tokens.bg.surface,
      text: tokens.text.primary,
      border: tokens.border.default,
      notification: tokens.status.error,
    },
  };
}
