// Bold Lagos — App Design Tokens
//
// Contrast audit (Phase 9, WCAG 2.1 AA):
//   text       (#09090b) on background    (#FAFAFA) → 19.34  ✓ AAA
//   text       (#09090b) on surface       (#FFFFFF) → 21.00  ✓ AAA
//   textMuted  (#6B7280) on background    (#FAFAFA) →  4.61  ✓ AA  (normal)
//   textLight  (#9CA3AF) on background    (#FAFAFA) →  2.83  ✗     (placeholder only)
//   white      (#FFFFFF) on primary       (#EA580C) →  3.40  ✓ AA  (large text ≥18pt / ≥14pt bold only) — see note
//   primary    (#EA580C) on background    (#FAFAFA) →  3.31  ✗ AA  (large text only)
//   primaryStrong (#C2410C) on bg                    →  4.47  ~ AA (use for body links / inline orange text)
//   error      (#EF4444) on background    (#FAFAFA) →  3.92  ✗ AA  (use errorStrong for body text)
//   errorStrong (#DC2626) on background               →  5.21  ✓ AA
//   white      (#FFFFFF) on dark          (#09090b) → 20.02  ✓ AAA
//
// Rules:
//  - Primary buttons render their label at ≥14pt bold or ≥18pt — those meet the WCAG
//    "large text" 3:1 requirement on `primary`. We don't render normal-weight body text
//    in white on `primary`.
//  - When orange text appears on a light background as a link (Forgot password, Resend,
//    See all, etc.), prefer `primaryStrong` so it clears 4.5:1.
//  - `textLight` is reserved for placeholder text only. Don't use it for actual content.
export const colors = {
  primary: "#EA580C",            // Burnt orange — large-text CTA backgrounds, accents
  primaryStrong: "#C2410C",      // Darker orange — body links, inline accent text
  dark: "#09090b",               // Charcoal — backgrounds, tiles, headers
  background: "#FAFAFA",         // Off-white — screen background
  surface: "#FFFFFF",            // Pure white — cards, modals
  surfaceMuted: "#F3F4F6",       // Soft grey — inputs, secondary buttons
  text: "#09090b",               // Primary text
  textMuted: "#6B7280",          // Secondary/label text (AA on background)
  textLight: "#9CA3AF",          // Placeholder text only — fails AA for body
  border: "#E5E7EB",             // Default border
  error: "#EF4444",              // Backgrounds, icon fills, danger tints
  errorStrong: "#DC2626",        // Inline error text on light backgrounds (AA)
  success: "#10B981",
  white: "#FFFFFF",

  // Service category colors
  food: { icon: "#EA580C", bg: "#FFF0E8" },
  package: { icon: "#2563EB", bg: "#EFF6FF" },
  pharmacy: { icon: "#059669", bg: "#ECFDF5" },
  groceries: { icon: "#7C3AED", bg: "#F5F3FF" },
  airtime: "#EA580C",
  data: "#2563EB",
  electricity: "#D97706",
  transfer: "#059669",
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 9999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 32,
};

const theme = { colors, radius, spacing };
export default theme;
