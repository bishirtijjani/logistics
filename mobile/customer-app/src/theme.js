// Bold Lagos — App Design Tokens
export const colors = {
  primary: "#EA580C", // Burnt orange — CTAs, accents
  dark: "#09090b", // Charcoal — backgrounds, tiles, headers
  background: "#FAFAFA", // Off-white — screen background
  surface: "#FFFFFF", // Pure white — cards, modals
  surfaceMuted: "#F3F4F6", // Soft grey — inputs, secondary buttons
  text: "#09090b", // Primary text
  textMuted: "#6B7280", // Secondary/label text
  textLight: "#9CA3AF", // Placeholder text
  border: "#E5E7EB", // Default border
  error: "#EF4444",
  success: "#10B981",
  white: "#FFFFFF",

  // Service category colors
  food: { icon: "#EA580C", bg: "#FFF0E8" },
  delivery: { icon: "#2563EB", bg: "#EFF6FF" },
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
