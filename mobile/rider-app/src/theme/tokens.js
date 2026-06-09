// Bold Lagos - App Design Tokens (semantic, light + dark)
//
// Two palettes, identical shape, swapped by ThemeProvider based on user choice
// or system colorScheme. Consumers always reference the same token paths
// (e.g. `tokens.bg.canvas`, `tokens.text.primary`) - never literal hex.
//
// Identical to customer-app tokens. The rider app shares the platform brand
// (#EA580C) and the same semantic palette so screenshots, dashboards, and
// physical signage stay unified across the platform.

// ─── LIGHT ──────────────────────────────────────────────────────────────────
export const light = {
  bg: {
    canvas:       '#FAFAFA',
    surface:      '#FFFFFF',
    surfaceMuted: '#F3F4F6',
    surfaceStrong:'#E5E7EB',
    elevated:     '#09090b',
  },
  text: {
    primary:     '#09090b',
    muted:       '#6B7280',
    placeholder: '#9CA3AF',
    onBrand:     '#FFFFFF',
    onElevated:  '#FFFFFF',
  },
  border: {
    default: '#E5E7EB',
    strong:  '#D1D5DB',
    subtle:  '#F3F4F6',
  },
  brand: {
    default:    '#EA580C',
    strong:     '#C2410C',
    soft:       '#FFF7ED',
    softBorder: '#FED7AA',
  },
  status: {
    error:            '#EF4444',
    errorStrong:      '#DC2626',
    errorSoft:        '#FEE2E2',
    errorSoftBorder:  '#FECACA',
    success:          '#10B981',
    successStrong:    '#059669',
    successSoft:      '#D1FAE5',
    warning:          '#D97706',
    warningStrong:    '#B45309',
    warningSoft:      '#FEF3C7',
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
    scrim:     'rgba(0,0,0,0.45)',
    scrimSoft: 'rgba(0,0,0,0.25)',
  },
};

// ─── DARK ───────────────────────────────────────────────────────────────────
export const dark = {
  bg: {
    canvas:       '#0B0B0F',
    surface:      '#16161C',
    surfaceMuted: '#1F1F27',
    surfaceStrong:'#2A2A33',
    elevated:     '#27272E',
  },
  text: {
    primary:     '#F4F4F5',
    muted:       '#A1A1AA',
    placeholder: '#52525B',
    onBrand:     '#0B0B0F',
    onElevated:  '#F4F4F5',
  },
  border: {
    default: '#27272A',
    strong:  '#3F3F46',
    subtle:  '#1F1F27',
  },
  brand: {
    default:    '#FB923C',
    strong:     '#FDBA74',
    soft:       'rgba(251,146,60,0.14)',
    softBorder: 'rgba(251,146,60,0.36)',
  },
  status: {
    error:            '#F87171',
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
    scrim:     'rgba(0,0,0,0.62)',
    scrimSoft: 'rgba(0,0,0,0.40)',
  },
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
