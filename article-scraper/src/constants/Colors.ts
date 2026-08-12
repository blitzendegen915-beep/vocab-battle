export const Colors = {
  light: {
    text: '#1a1a1a',
    textSecondary: '#6b7280',
    background: '#f8fafc',
    card: '#ffffff',
    border: '#e5e7eb',
    tint: '#0ea5e9',
    tag: '#dbeafe',
    tagText: '#1d4ed8',
    destructive: '#ef4444',
  },
  dark: {
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    background: '#0f172a',
    card: '#1e293b',
    border: '#334155',
    tint: '#38bdf8',
    tag: '#1e3a5f',
    tagText: '#93c5fd',
    destructive: '#f87171',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
