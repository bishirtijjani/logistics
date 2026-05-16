import { DefaultTheme, DarkTheme } from '@react-navigation/native';

export function buildNavigationTheme(tokens, isDark) {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: tokens.brand.default,
      background: 'transparent',
      card: tokens.bg.surface,
      text: tokens.text.primary,
      border: tokens.border.default,
      notification: tokens.status.error,
    },
  };
}
