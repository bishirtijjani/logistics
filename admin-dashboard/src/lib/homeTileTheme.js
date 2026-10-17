const ICON_BY_SLUG = {
  restaurant: 'hamburger',
  grocery: 'basket',
  pharmacy: 'medical-bag',
  fashion: 'tshirt-crew',
  shoes: 'shoe-formal',
  electronics: 'cellphone',
  shops: 'shopping',
  delivery: 'moped',
  __shops__: 'shopping',
  __package__: 'moped',
}

const ICON_REMAP = {
  shirt: 'tshirt-crew',
  footprints: 'shoe-formal',
  smartphone: 'cellphone',
  bottle: 'bottle-soda',
  restaurant: 'silverware-fork-knife',
  cake: 'cake-variant',
  'cup-soda': 'cup',
  beef: 'food-drumstick',
  apple: 'food-apple',
  droplet: 'water',
  'spray-can': 'spray-bottle',
  baby: 'baby-carriage',
  'paw-print': 'paw',
  pill: 'pill',
  'heart-pulse': 'heart-pulse',
  sparkles: 'shimmer',
  'shopping-bag': 'shopping',
  watch: 'watch',
  cable: 'cable-data',
  'cooking-pot': 'pot-steam',
  armchair: 'sofa',
  'book-open': 'book-open-page-variant',
  'gamepad-2': 'gamepad-variant',
  dumbbell: 'dumbbell',
  wrench: 'wrench',
  sprout: 'sprout',
  car: 'car',
}

const withAlpha = (hex, alpha) =>
  typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : hex

export const resolveCategoryIcon = (cat) => {
  if (!cat) return 'store'
  const bySlug = ICON_BY_SLUG[cat.slug] || ICON_BY_SLUG[cat.id]
  if (bySlug) return bySlug
  const remapped = ICON_REMAP[cat.icon]
  if (remapped) return remapped
  if (typeof cat.icon === 'string' && cat.icon.length > 0) return cat.icon
  return 'store'
}

export const customerTheme = (isDark) => {
  if (!isDark) {
    // Light tokens
    return {
      canvas: '#FAFAFA',
      surface: '#FFFFFF',
      border: '#E5E7EB',
      nameColor: '#09090b',
      iconOnChip: '#FFFFFF',
      accentFor: (item) => {
        const slug = item.slug || item.id
        if (slug === 'restaurant') return '#EA580C'
        if (slug === 'grocery') return '#7C3AED'
        if (slug === 'pharmacy') return '#059669'
        if (slug === 'shops' || slug === '__shops__' || slug === 'SHOPS') return '#7C3AED'
        if (slug === 'delivery' || slug === '__package__' || slug === 'PACKAGE') return '#09090b'
        return item.color || '#EA580C'
      },
    }
  }
  return {
    canvas: '#0B0B0F',
    surface: '#16161C',
    border: '#27272A',
    nameColor: '#F4F4F5',
    iconOnChip: '#0B0B0F',
    accentFor: (item) => {
      const slug = item.slug || item.id
      if (slug === 'restaurant') return '#FB923C'
      if (slug === 'grocery') return '#A78BFA'
      if (slug === 'pharmacy') return '#34D399'
      if (slug === 'shops' || slug === '__shops__' || slug === 'SHOPS') return '#A78BFA'
      if (slug === 'delivery' || slug === '__package__' || slug === 'PACKAGE') return '#F4F4F5'
      return item.color || '#FB923C'
    },
  }
}
