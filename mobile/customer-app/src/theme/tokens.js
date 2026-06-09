// Bold Lagos - App Design Tokens (semantic, light + dark)
//
// Two palettes, identical shape, swapped by ThemeProvider based on user choice
// or system colorScheme. Consumers always reference the same token paths
// (e.g. `tokens.bg.canvas`, `tokens.text.primary`) - never literal hex.
//
// ─────────────────────────────────────────────────────────────────────────────
// LIGHT CONTRAST AUDIT (WCAG 2.1 AA, rounded ratios)
// ─────────────────────────────────────────────────────────────────────────────
//   text.primary   (#09090b) on bg.canvas      (#FAFAFA) → 19.34  ✓ AAA
//   text.primary   (#09090b) on bg.surface     (#FFFFFF) → 21.00  ✓ AAA
//   text.muted     (#6B7280) on bg.canvas      (#FAFAFA) →  4.61  ✓ AA  (normal text)
//   text.placeholder (#9CA3AF) on bg.canvas    (#FAFAFA) →  2.83  ✗     (placeholder only)
//   text.onBrand   (#FFFFFF) on brand.default  (#EA580C) →  3.40  ✓ AA  large text (≥18pt / ≥14pt bold)
//   brand.default  (#EA580C) on bg.canvas      (#FAFAFA) →  3.31  ✗ AA  large text only
//   brand.strong   (#C2410C) on bg.canvas      (#FAFAFA) →  4.47  ✓ AA  body links
//   status.error   (#EF4444) on bg.canvas      (#FAFAFA) →  3.92  ✗     icon/bg only
//   status.errorStrong (#DC2626) on bg.canvas             →  5.21  ✓ AA  inline error text
//   text.onElevated (#FFFFFF) on bg.elevated   (#09090b) → 20.02  ✓ AAA
//
// ─────────────────────────────────────────────────────────────────────────────
// DARK CONTRAST AUDIT (Phase 3 - verify and update before ship)
// ─────────────────────────────────────────────────────────────────────────────
//   text.primary   (#F4F4F5) on bg.canvas      (#0B0B0F) → ~18    ✓ AAA
//   text.primary   (#F4F4F5) on bg.surface     (#16161C) → ~16    ✓ AAA
//   text.muted     (#A1A1AA) on bg.canvas      (#0B0B0F) → ~7.5   ✓ AA  (normal text)
//   text.placeholder (#52525B) on bg.surfaceMuted (#1F1F27) → ~1.5 ✗   (placeholder only)
//   text.onBrand   (#0B0B0F) on brand.default  (#FB923C) → ~9.2   ✓ AAA  dark text on tuned orange
//   brand.default  (#FB923C) on bg.canvas      (#0B0B0F) → ~9.2   ✓ AAA
//   brand.strong   (#FDBA74) on bg.canvas      (#0B0B0F) → ~11.6  ✓ AAA  body links
//   status.error   (#F87171) on bg.canvas      (#0B0B0F) → ~7.4   ✓ AA  inline error text
//
// Rules:
//  - Primary buttons: dark-mode brand uses dark-on-orange (#0B0B0F on #FB923C). The
//    `text.onBrand` token already encodes this swap, so consumers don't branch.
//  - `text.placeholder` is reserved for placeholder text only. Do NOT use it for
//    real content in either mode.
//  - Avoid hardcoded hex literals in screen code - every new color needs a token.

// ─── LIGHT ──────────────────────────────────────────────────────────────────
export const light = {
  bg: {
    canvas:       '#FAFAFA',  // screen background
    surface:      '#FFFFFF',  // cards, modals, sheets
    surfaceMuted: '#F3F4F6',  // inputs, chips, secondary buttons
    surfaceStrong:'#E5E7EB',  // subtle dividers used as fills
    elevated:     '#09090b',  // brand "premium" tile (Profile avatar card, dark headers)
  },
  text: {
    primary:     '#09090b',
    muted:       '#6B7280',
    placeholder: '#9CA3AF',
    onBrand:     '#FFFFFF',  // text/icons on top of brand.default
    onElevated:  '#FFFFFF',  // text/icons on top of bg.elevated
  },
  border: {
    default: '#E5E7EB',
    strong:  '#D1D5DB',
    subtle:  '#F3F4F6',
  },
  brand: {
    default:    '#EA580C',
    strong:     '#C2410C',  // body links / inline accent text (AA on canvas)
    soft:       '#FFF7ED',  // selected radio bg, soft brand banner bg
    softBorder: '#FED7AA',  // soft brand banner border
  },
  status: {
    // error
    error:            '#EF4444',  // icon/bg fills, danger tints
    errorStrong:      '#DC2626',  // inline error text on light bg (AA)
    errorSoft:        '#FEE2E2',  // soft error bg (logout button, badge)
    errorSoftBorder:  '#FECACA',
    // success
    success:          '#10B981',
    successStrong:    '#059669',
    successSoft:      '#D1FAE5',
    // warning
    warning:          '#D97706',
    warningStrong:    '#B45309',
    warningSoft:      '#FEF3C7',
    // info (blue)
    info:             '#2563EB',
    infoStrong:       '#1D4ED8',
    infoSoft:         '#EFF6FF',
    infoSoftBorder:   '#BFDBFE',
  },
  category: {
    food:      { icon: '#EA580C', bg: '#FFF0E8' },
    package:   { icon: '#2563EB', bg: '#EFF6FF' },
    pharmacy:  { icon: '#059669', bg: '#ECFDF5' },
    groceries: { icon: '#7C3AED', bg: '#F5F3FF' },
    airtime:     '#EA580C',
    data:        '#2563EB',
    electricity: '#D97706',
    transfer:    '#059669',
  },
  overlay: {
    // Modal scrims and image overlays - alpha is intentional, kept in both modes.
    scrim:     'rgba(0,0,0,0.45)',
    scrimSoft: 'rgba(0,0,0,0.25)',
  },
};

// ─── DARK ───────────────────────────────────────────────────────────────────
export const dark = {
  bg: {
    canvas:       '#0B0B0F',  // screen background (off-black with a hint of blue)
    surface:      '#16161C',  // cards, modals, sheets
    surfaceMuted: '#1F1F27',  // inputs, chips, secondary buttons
    surfaceStrong:'#2A2A33',  // elevated containers, subtle dividers as fills
    elevated:     '#27272E',  // brand "premium" tile - clearly raised above canvas
  },
  text: {
    primary:     '#F4F4F5',
    muted:       '#A1A1AA',
    placeholder: '#52525B',
    onBrand:     '#0B0B0F',  // dark text on tuned-bright orange (better contrast than white)
    onElevated:  '#F4F4F5',
  },
  border: {
    default: '#27272A',
    strong:  '#3F3F46',
    subtle:  '#1F1F27',
  },
  brand: {
    default:    '#FB923C',  // lighter tuned variant - clears AA for body on dark bg
    strong:     '#FDBA74',  // body links / inline accent text on dark bg
    soft:       'rgba(251,146,60,0.14)',  // selected radio bg, soft brand banner bg
    softBorder: 'rgba(251,146,60,0.36)',
  },
  status: {
    error:            '#F87171',  // tuned brighter so it reads on dark
    errorStrong:      '#FCA5A5',
    errorSoft:        'rgba(239,68,68,0.16)',
    errorSoftBorder:  'rgba(239,68,68,0.36)',
    success:          '#34D399',
    successStrong:    '#6EE7B7',
    successSoft:      'rgba(16,185,129,0.16)',
    warning:          '#FBBF24',
    warningStrong:    '#FCD34D',
    warningSoft:      'rgba(217,119,6,0.18)',
    info:             '#60A5FA',
    infoStrong:       '#93C5FD',
    infoSoft:         'rgba(37,99,235,0.18)',
    infoSoftBorder:   'rgba(37,99,235,0.40)',
  },
  category: {
    food:      { icon: '#FB923C', bg: 'rgba(251,146,60,0.14)' },
    package:   { icon: '#60A5FA', bg: 'rgba(96,165,250,0.14)' },
    pharmacy:  { icon: '#34D399', bg: 'rgba(52,211,153,0.14)' },
    groceries: { icon: '#A78BFA', bg: 'rgba(167,139,250,0.14)' },
    airtime:     '#FB923C',
    data:        '#60A5FA',
    electricity: '#FBBF24',
    transfer:    '#34D399',
  },
  overlay: {
    scrim:     'rgba(0,0,0,0.62)',  // a touch heavier so dark surfaces still pop behind a modal
    scrimSoft: 'rgba(0,0,0,0.40)',
  },
};

// ─── SCALAR TOKENS (mode-independent) ───────────────────────────────────────
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

// Compile-time sanity: the two palettes must expose the same shape so screens
// can reference any token without runtime undefined lookups. Walks one level
// deep - enough for our nested groups (bg, text, brand, status, category).
const sameShape = (() => {
  const walk = (a, b, path) => {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join('|') !== kb.join('|')) {
      throw new Error(`[theme] palette shape mismatch at ${path}: light=[${ka}] dark=[${kb}]`);
    }
    for (const k of ka) {
      const va = a[k];
      const vb = b[k];
      if (va && typeof va === 'object' && vb && typeof vb === 'object') {
        walk(va, vb, `${path}.${k}`);
      }
    }
  };
  walk(light, dark, 'tokens');
  return true;
})();

export const __paletteShapeChecked = sameShape;
