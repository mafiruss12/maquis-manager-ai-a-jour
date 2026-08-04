/** Version de l'APK actuellement en circulation (doit matcher GitHub Release) */
export const APP_VERSION = '1.0.2';
export const APP_VERSION_CODE = 3;

export const GITHUB_OWNER = 'mafiruss12';
export const GITHUB_REPO = 'maquis-manager-ai-a-jour';
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

export function parseVersion(v: string): number[] {
  return v.replace(/^v/i, '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
}

/** true si remote > local */
export function isNewerVersion(remote: string, local: string = APP_VERSION): boolean {
  const a = parseVersion(remote);
  const b = parseVersion(local);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

export interface LatestRelease {
  tag: string;
  name: string;
  body: string;
  apkUrl: string | null;
  htmlUrl: string;
}

export async function fetchLatestRelease(): Promise<LatestRelease | null> {
  try {
    const res = await fetch(GITHUB_RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const assets = (data.assets || []) as { name: string; browser_download_url: string }[];
    const apk =
      assets.find((a) => a.name.toLowerCase().endsWith('.apk')) ||
      assets.find((a) => a.name.toLowerCase().includes('maquis'));
    return {
      tag: (data.tag_name || '').replace(/^v/i, ''),
      name: data.name || data.tag_name || '',
      body: data.body || '',
      apkUrl: apk?.browser_download_url ?? null,
      htmlUrl: data.html_url || GITHUB_RELEASES_PAGE,
    };
  } catch {
    return null;
  }
}
