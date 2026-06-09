// Public API for the theme module.
//
// New code should pull theming reactively via `useTheme()`:
//   const { tokens, isDark, mode, setMode } = useTheme();
//   <View style={{ backgroundColor: tokens.bg.surface }} />

export { ThemeProvider } from './ThemeProvider';
export { useTheme } from './useTheme';
export { buildNavigationTheme } from './navigationTheme';
export { light, dark } from './tokens';
import { light, radius as _radius, spacing as _spacing } from './tokens';

export const radius = _radius;
export const spacing = _spacing;

// Legacy flat `colors` shim - pinned to light palette. Avoid in new code.
export const colors = {
  primary:       light.brand.default,
  primaryStrong: light.brand.strong,
  dark:          light.bg.elevated,
  background:    'transparent',
  surface:       light.bg.surface,
  surfaceMuted:  light.bg.surfaceMuted,
  text:          light.text.primary,
  textMuted:     light.text.muted,
  textLight:     light.text.placeholder,
  border:        light.border.default,
  error:         light.status.error,
  errorStrong:   light.status.errorStrong,
  success:       light.status.success,
  white:         '#FFFFFF',

  food:      light.category.food,
  package:   light.category.package,
  pharmacy:  light.category.pharmacy,
  groceries: light.category.groceries,
  airtime:     light.category.airtime,
  data:        light.category.data,
  electricity: light.category.electricity,
  transfer:    light.category.transfer,
};

export default { colors, radius: _radius, spacing: _spacing };
