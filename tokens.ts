/**
 * Waypoint design tokens.
 *
 * These mirror the CSS custom properties in `global.css` exactly. Keep the
 * two in sync — this file exists for the handful of places NativeWind
 * className strings can't reach: icon `color` props, chart palettes,
 * status bar style, SVG fills.
 */

export const colors = {
  light: {
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#E7E9EE',
    textPrimary: '#14171C',
    textSecondary: '#4B5157',
    textMuted: '#7A828C',
  },
  dark: {
    bg: '#0B0E14',
    surface: '#12151C',
    surfaceRaised: '#1B2029',
    border: '#262B35',
    textPrimary: '#F4F5F7',
    textSecondary: '#C7CCD4',
    textMuted: '#9AA1AC',
  },
  brand: {
    700: '#28409C',
    600: '#3454D1',
    500: '#4C6EF0',
    100: '#E4E9FD',
  },
  verdant: { 600: '#12946B', 100: '#DCF3E9' },
  amber: { 600: '#C77D14', 100: '#F9EAD0' },
  rose: { 600: '#D6455A', 100: '#FBDFE3' },
  violet: { 600: '#7C3AED' },
} as const;

export const radius = {
  xs: 8,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const priorityColor = {
  low: colors.light.textMuted,
  medium: colors.amber[600],
  high: colors.rose[600],
  urgent: colors.violet[600],
} as const;

export const statusColor = {
  backlog: colors.light.textMuted,
  todo: colors.brand[500],
  in_progress: colors.amber[600],
  in_review: colors.violet[600],
  blocked: colors.rose[600],
  done: colors.verdant[600],
} as const;

export type ColorScheme = 'light' | 'dark';