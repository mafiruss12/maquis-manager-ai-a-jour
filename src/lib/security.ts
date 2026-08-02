/**
 * Utilitaires de sécurité côté client
 * - La vraie sécurité est sur Supabase (RLS + clé anon uniquement)
 * - Jamais de service_role dans le frontend / APK
 */

/** Valide un identifiant simple (login) */
export function isSafeLogin(login: string): boolean {
  const v = login.trim();
  if (v.length < 2 || v.length > 80) return false;
  // Autorise email ou login alphanumérique
  if (v.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
  return /^[a-zA-Z0-9._-]{2,40}$/.test(v);
}

/** Mot de passe minimum sécurisé */
export function isStrongEnoughPassword(password: string): boolean {
  return password.length >= 6;
}

/** Échappe le HTML basique (affichage messages) */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Vérifie qu'une URL d'image est https (pas de contenu mixte / XSS via javascript:) */
export function isSafeImageUrl(url: string): boolean {
  if (!url || !url.trim()) return true;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
