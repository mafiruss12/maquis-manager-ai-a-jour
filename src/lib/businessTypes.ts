import type { Role } from './types';

export type BusinessType = 'maquis' | 'bar' | 'restaurant' | 'magasin' | 'location_event';

export const BUSINESS_TYPES: BusinessType[] = [
  'maquis',
  'bar',
  'restaurant',
  'magasin',
  'location_event',
];

export const BUSINESS_LABELS: Record<BusinessType, string> = {
  maquis: 'Maquis',
  bar: 'Bar',
  restaurant: 'Restaurant',
  magasin: 'Magasin',
  location_event: 'Location événementielle',
};

export const BUSINESS_DESCRIPTIONS: Record<BusinessType, string> = {
  maquis: 'Boissons, grills et gestion de caisse au quotidien',
  bar: 'Cocktails, service au comptoir et ambiance nocturne',
  restaurant: 'Tables, cuisine, commandes et service en salle',
  magasin: 'Stock produits, achats, marge et vente au détail',
  location_event:
    'Chaises, tables, bâches, sono — locations pour mariages et cérémonies',
};

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
  location_event: {
    primary: '#6366f1',
    primarySoft: 'rgba(99, 102, 241, 0.15)',
    accent: '#4f46e5',
    label: 'Indigo',
    gradient: 'from-indigo-500/20 to-violet-600/5',
  },
};

export const MENU_BY_TYPE: Record<BusinessType, string[]> = {
  maquis: [
    '/dashboard', '/pos', '/inventory', '/inventory/scan', '/expenses', '/employees', '/team',
    '/suivi', '/calendar', '/daily-report', '/statistics', '/reports', '/ai', '/chat',
    '/notifications', '/settings',
  ],
  bar: [
    '/dashboard', '/pos', '/orders', '/tables', '/inventory', '/inventory/scan', '/expenses',
    '/employees', '/team', '/suivi', '/daily-report', '/statistics', '/ai', '/chat',
    '/notifications', '/settings',
  ],
  restaurant: [
    '/dashboard', '/pos', '/orders', '/kitchen', '/tables', '/inventory', '/inventory/scan',
    '/customers', '/employees', '/team', '/suivi', '/calendar', '/expenses',
    '/daily-report', '/statistics', '/accounting', '/ai', '/chat',
    '/notifications', '/settings',
  ],
  magasin: [
    '/dashboard', '/pos', '/inventory', '/inventory/scan', '/purchases', '/suppliers', '/customers',
    '/expenses', '/employees', '/team', '/suivi', '/statistics', '/accounting', '/reports',
    '/ai', '/chat', '/notifications', '/settings',
  ],
  location_event: [
    '/dashboard', '/rent/equipment', '/rent/clients', '/rent/orders',
    '/rent/movements', '/rent/payments', '/rent/calendar', '/rent/packs',
    '/rent/invoices', '/team', '/ai', '/chat', '/notifications', '/settings',
  ],
};

export const EQUIPMENT_CATEGORIES = [
  'chaises', 'chaises_presidentielles', 'tables', 'treteaux', 'baches',
  'chapiteaux', 'sonorisation', 'vaisselle', 'decoration', 'autres',
] as const;

export const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
  chaises: 'Chaises',
  chaises_presidentielles: 'Chaises présidentielles',
  tables: 'Tables',
  treteaux: 'Tréteaux',
  baches: 'Bâches',
  chapiteaux: 'Chapiteaux',
  sonorisation: 'Sonorisation',
  vaisselle: 'Vaisselle',
  decoration: 'Décoration',
  autres: 'Autres',
};

export const RENTAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  confirmed: 'Confirmée',
  out: 'En sortie',
  returned: 'Retournée',
  cancelled: 'Annulée',
};

export function normalizeBusinessType(raw: string | null | undefined): BusinessType {
  const v = (raw || '').toLowerCase().trim();
  if (v === 'maquis' || v === 'bar' || v === 'restaurant' || v === 'magasin' || v === 'location_event') return v;
  if (v === 'store' || v === 'shop') return 'magasin';
  if (v === 'location' || v === 'event' || v === 'rental') return 'location_event';
  return 'maquis';
}

export function isLocationEvent(type: string | null | undefined): boolean {
  return normalizeBusinessType(type) === 'location_event';
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

export function buildWhatsAppLink(phone: string | null | undefined, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  let normalized = digits;
  if (digits.startsWith('0') && digits.length >= 10) {
    normalized = '225' + digits.slice(1);
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}


export function buildSmsLink(phone: string | null | undefined, message: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return `sms:${digits}?body=${encodeURIComponent(message)}`;
}
