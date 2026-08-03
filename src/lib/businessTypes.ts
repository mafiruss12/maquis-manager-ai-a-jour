import type { Role } from './types';

export type BusinessType = 'maquis' | 'bar' | 'restaurant' | 'magasin';

export const BUSINESS_TYPES: BusinessType[] = ['maquis', 'bar', 'restaurant', 'magasin'];

export const BUSINESS_LABELS: Record<BusinessType, string> = {
  maquis: 'Maquis',
  bar: 'Bar',
  restaurant: 'Restaurant',
  magasin: 'Magasin',
};

export const BUSINESS_DESCRIPTIONS: Record<BusinessType, string> = {
  maquis: 'Boissons, grills et gestion de caisse au quotidien',
  bar: 'Cocktails, service au comptoir et ambiance nocturne',
  restaurant: 'Tables, cuisine, commandes et service en salle',
  magasin: 'Stock produits, achats, marge et vente au détail',
};

/** Thème CSS (variables) par type d'activité */
export const BUSINESS_THEMES: Record<
  BusinessType,
  { primary: string; primarySoft: string; accent: string; label: string; gradient: string }
> = {
  maquis: {
    primary: '#f59e0b',
    primarySoft: 'rgba(245, 158, 11, 0.15)',
    accent: '#d97706',
    label: 'Ambre',
    gradient: 'from-amber-500/20 to-orange-600/5',
  },
  bar: {
    primary: '#8b5cf6',
    primarySoft: 'rgba(139, 92, 246, 0.15)',
    accent: '#7c3aed',
    label: 'Violet',
    gradient: 'from-violet-500/20 to-indigo-600/5',
  },
  restaurant: {
    primary: '#10b981',
    primarySoft: 'rgba(16, 185, 129, 0.15)',
    accent: '#059669',
    label: 'Émeraude',
    gradient: 'from-emerald-500/20 to-teal-600/5',
  },
  magasin: {
    primary: '#06b6d4',
    primarySoft: 'rgba(6, 182, 212, 0.15)',
    accent: '#0891b2',
    label: 'Cyan',
    gradient: 'from-cyan-500/20 to-blue-600/5',
  },
};

/**
 * Routes visibles par type d'activité.
 * super_admin voit tout via le layout.
 */
export const MENU_BY_TYPE: Record<BusinessType, string[]> = {
  maquis: [
    '/dashboard',
    '/pos',
    '/inventory',
    '/expenses',
    '/employees',
    '/calendar',
    '/daily-report',
    '/statistics',
    '/reports',
    '/ai',
    '/chat',
    '/notifications',
    '/settings',
  ],
  bar: [
    '/dashboard',
    '/pos',
    '/orders',
    '/tables',
    '/inventory',
    '/expenses',
    '/employees',
    '/daily-report',
    '/statistics',
    '/ai',
    '/chat',
    '/notifications',
    '/settings',
  ],
  restaurant: [
    '/dashboard',
    '/pos',
    '/orders',
    '/kitchen',
    '/tables',
    '/inventory',
    '/customers',
    '/employees',
    '/calendar',
    '/expenses',
    '/daily-report',
    '/statistics',
    '/accounting',
    '/ai',
    '/chat',
    '/notifications',
    '/settings',
  ],
  magasin: [
    '/dashboard',
    '/pos',
    '/inventory',
    '/purchases',
    '/suppliers',
    '/customers',
    '/expenses',
    '/employees',
    '/statistics',
    '/accounting',
    '/reports',
    '/ai',
    '/chat',
    '/notifications',
    '/settings',
  ],
};

export function normalizeBusinessType(raw: string | null | undefined): BusinessType {
  const v = (raw || '').toLowerCase().trim();
  if (v === 'maquis' || v === 'bar' || v === 'restaurant' || v === 'magasin') return v;
  if (v === 'store' || v === 'shop') return 'magasin';
  return 'maquis';
}

export function applyBusinessTheme(type: BusinessType) {
  if (typeof document === 'undefined') return;
  const t = BUSINESS_THEMES[type];
  const root = document.documentElement;
  root.style.setProperty('--biz-primary', t.primary);
  root.style.setProperty('--biz-primary-soft', t.primarySoft);
  root.style.setProperty('--biz-accent', t.accent);
  root.dataset.businessType = type;
}

export function canManageEstablishments(role: Role | undefined): boolean {
  return !!role && ['super_admin', 'admin', 'owner'].includes(role);
}
