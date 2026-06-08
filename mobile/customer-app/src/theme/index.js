// Public API for the theme module.
//
// New code should pull theming reactively via `useTheme()`:
//   const { tokens, isDark, mode, setMode } = useTheme();
//   <View style={{ backgroundColor: tokens.bg.surface }} />
//
// The `colors` / `radius` / `spacing` exports below are a LEGACY COMPAT SHIM
// preserving the flat shape that `src/theme.js` used to export. They are
// hard-pinned to the LIGHT palette and do NOT react to mode changes. Each
// screen migrated to `useTheme()` in Phase 2 drops one consumer of this shim;
// once nothing imports it, the shim block will be removed.

export { ThemeProvider } from './ThemeProvider';
export { useTheme } from './useTheme';
export { buildNavigationTheme } from './navigationTheme';
export { light, dark } from './tokens';
import { light, radius as _radius, spacing as _spacing } from './tokens';

export const radius = _radius;
export const spacing = _spacing;

// ─── Legacy flat `colors` shim ──────────────────────────────────────────────
// Mirrors the exact keys the old `src/theme.js` exported. Pre-migration screens
// continue to read these and render in light mode regardless of theme choice.
export const colors = {
  primary:       light.brand.default,
  primaryStrong: light.brand.strong,
  dark:          light.bg.elevated,
  // Legacy outer-container background. Kept `transparent` so pre-migration
  // screens inherit the opaque canvas painted by the navigator scene + the
  // root View in App.js. Cards / headers / modals set their own opaque fills.
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
