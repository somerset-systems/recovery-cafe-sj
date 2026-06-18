export const colors = {
  primaryGreen: '#2D6A4F',
  accentGreen: '#52B788',
  background: '#F8F4EF',
  card: '#FFFFFF',

  tagEvent: '#2D6A4F',
  tagClass: '#2A7F7F',
  tagMusic: '#6B4F8C',
  tagSchool: '#1E3A5F',

  tagEventBg: '#E3F2EC',
  tagClassBg: '#E0F2F2',
  tagMusicBg: '#EDE5F5',
  tagSchoolBg: '#E4EBF5',

  textDark: '#1A1A1A',
  textMedium: '#555555',
  textLight: '#888888',

  chipAttended: '#2D6A4F',
  chipMissed: '#C1440E',
  chipExcused: '#B8860B',
  chipNotYet: '#888888',

  danger: '#C1440E',
  dangerBg: '#FDF1EC', // light tint behind danger-colored text; danger on this = 4.63:1 (AA)
  white: '#FFFFFF',
  border: '#E0DAD3',

  // Chore "crown": chores beyond the 3/month goal add stars around the ring, and
  // every 3 extra chores the crown steps to the next warm metal (a new "tier").
  // Past the last metal the tier keeps climbing via glow, so it scales to any count.
  crownTiers: [
    '#F7C948', // gold        (tier 1, +3)
    '#F0B000', // deep gold   (tier 2, +6)
    '#E08A00', // amber       (tier 3, +9)
    '#C9740C', // burnt amber (tier 4, +12)
    '#B05E1D', // copper      (tier 5, +15)
    '#8C6239', // bronze      (tier 6+, then glow intensifies)
  ],
}

export const fontSize = {
  small: 13,
  body: 15,
  medium: 17,
  large: 20,
  xlarge: 24,
  xxlarge: 32,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  page: 16,   // horizontal page margin
  card: 20,   // card internal padding
  gap: 14,    // standard gap between cards
}
