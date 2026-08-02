/** Domaine interne pour les identifiants simples (sans email réel) */
export const LOGIN_DOMAIN = 'maquis.local';

/**
 * Convertit un identifiant libre en email Supabase.
 * - "jean@gmail.com" → inchangé
 * - "gerant1" → "gerant1@maquis.local"
 */
export function toAuthEmail(login: string): string {
  const v = login.trim().toLowerCase();
  if (!v) return v;
  if (v.includes('@')) return v;
  // Nettoie l'identifiant (lettres, chiffres, ._-)
  const clean = v.replace(/[^a-z0-9._-]/g, '');
  return `${clean}@${LOGIN_DOMAIN}`;
}

/** Affiche un login lisible à partir de l'email stocké */
export function displayLogin(email: string | null | undefined): string {
  if (!email) return '—';
  if (email.endsWith(`@${LOGIN_DOMAIN}`)) return email.replace(`@${LOGIN_DOMAIN}`, '');
  return email;
}

/** Génère un mot de passe simple à communiquer (8 caractères) */
export function generatePassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

/** Génère un identifiant simple à partir du nom */
export function generateLogin(fullName: string, role: string): string {
  const base = (fullName || role || 'user')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10) || 'user';
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${base}${suffix}`;
}
