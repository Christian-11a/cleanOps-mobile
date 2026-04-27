// CleanOps color palette
export const LightColors = {
  blue50:  '#E3F2FD',
  blue100: '#BBDEFB',
  blue200: '#90CAF9',
  blue400: '#42A5F5',
  blue600: '#1E88E5',
  blue700: '#1976D2',
  blue800: '#1565C0',
  bg:       '#F8FAFC',
  surface:  '#FFFFFF',
  surface2: '#F1F5F9',
  text1: '#0F172A',
  text2: '#475569',
  text3: '#94A3B8',
  divider: '#E2E8F0',
  success: '#10B981',
  warning: '#F59E0B',
  error:   '#EF4444',
};

export const DarkColors = {
  blue50:  '#0f2d54',
  blue100: '#1a3f73',
  blue200: '#1e4d8c',
  blue400: '#4fa3e8',
  blue600: '#3b9eff',
  blue700: '#2d8ce0',
  blue800: '#1e6dbf',
  bg:       '#0f172a',
  surface:  '#1e293b',
  surface2: '#334155',
  text1: '#f1f5f9',
  text2: '#94a3b8',
  text3: '#64748b',
  divider: '#334155',
  success: '#10B981',
  warning: '#F59E0B',
  error:   '#EF4444',
};

// Backward-compat default (light mode)
export const Colors = LightColors;

export const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  OPEN:           { bg: '#EFF6FF', text: '#3B82F6', label: 'Open' },
  IN_PROGRESS:    { bg: '#FFFBEB', text: '#F59E0B', label: 'In Progress' },
  PENDING_REVIEW: { bg: '#FDF2F8', text: '#EC4899', label: 'Awaiting Approval' },
  COMPLETED:      { bg: '#ECFDF5', text: '#10B981', label: 'Payment Released' },
  CANCELLED:      { bg: '#FEF2F2', text: '#EF4444', label: 'Cancelled' },
};

export const DARK_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  OPEN:           { bg: '#1e3a5f', text: '#60a5fa', label: 'Open' },
  IN_PROGRESS:    { bg: '#3b2a0a', text: '#fbbf24', label: 'In Progress' },
  PENDING_REVIEW: { bg: '#3b0e40', text: '#f472b6', label: 'Awaiting Approval' },
  COMPLETED:      { bg: '#0f2f20', text: '#34d399', label: 'Payment Released' },
  CANCELLED:      { bg: '#3b0f0f', text: '#f87171', label: 'Cancelled' },
};
