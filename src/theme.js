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

  // Chore "rings": the green goal ring is the innermost; every tier beyond it is a
  // concentric outer ring in a complementary colour (see lib/choreRings.js +
  // components/ChoreRing.jsx). Chores fill the rings from the inside out, and a
  // member only sees the ring they're working on (plus the ones they've already
  // closed) — the next ring opens the moment the current one closes.
  // `cap` is how many chores a ring holds. Early rings are small so the first few
  // close fast (most members do well under 10 chores); the caps then ramp up, with
  // gold the hard finale, so the top stays aspirational. Close points (cumulative):
  // green 3, teal 7, blue 12, purple 19, plum 30, rose 50, gold 80.
  // Colours walk the wheel green → teal → blue → purple → plum → rose → gold, all
  // kept at a medium, cafe-friendly saturation so they sit on cream together.
  choreRings: [
    { name: 'green',  color: '#2D6A4F', cap: 3 },  // the goal ring (recovery green)
    { name: 'teal',   color: '#2A8C8C', cap: 4 },
    { name: 'blue',   color: '#3E6CA6', cap: 5 },
    { name: 'purple', color: '#6B5BB0', cap: 7 },
    { name: 'plum',   color: '#9E4E88', cap: 11 },
    { name: 'rose',   color: '#C75C6B', cap: 20 },
    { name: 'gold',   color: '#C9982E', cap: 30 },
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
