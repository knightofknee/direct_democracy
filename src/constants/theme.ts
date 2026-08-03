/**
 * direct democracy theme.
 * Palette is drawn from the Chicago flag: sky blue stripes (#41B6E6),
 * six-pointed star red (#C8102E), on white - with a navy-leaning dark mode.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F1B2A',
    textSecondary: '#5B6672',
    background: '#FFFFFF',
    backgroundElement: '#F1F6FA',
    backgroundSelected: '#DCEEF8',
    border: '#E2EAF0',
    primary: '#1E8FC4', // chicago sky blue, darkened for contrast on white
    primarySoft: '#B3DDF2',
    accent: '#C8102E', // chicago star red
    verified: '#1B7F4D',
    verifiedSoft: '#DCF2E6',
    warning: '#B35C00',
    warningSoft: '#FDEFD9',
    danger: '#C8102E',
    dangerSoft: '#FBE2E6',
  },
  dark: {
    text: '#F2F6FA',
    textSecondary: '#9AA7B4',
    background: '#0B1520',
    backgroundElement: '#16232F',
    backgroundSelected: '#1F3547',
    border: '#233240',
    primary: '#41B6E6',
    primarySoft: '#123A50',
    accent: '#FF4D66',
    verified: '#4CC98A',
    verifiedSoft: '#123526',
    warning: '#F0A24B',
    warningSoft: '#3A2A12',
    danger: '#FF4D66',
    dangerSoft: '#3D1620',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
