import { useEffect, useState } from 'react';
import { Download, X, RefreshCw } from 'lucide-react';
import {
  APP_VERSION,
  fetchLatestRelease,
  isNewerVersion,
  type LatestRelease,
} from '@/lib/appVersion';

const DISMISS_KEY = 'maquis_update_dismissed';

export default function UpdateBanner() {
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);

  async function check(force = false) {
    setChecking(true);
    try {
      const latest = await fetchLatestRelease();
      if (!latest?.tag) return;
      if (!isNewerVersion(latest.tag, APP_VERSION)) {
        setVisible(false);
        setRelease(null);
        return;
      }
      const dismissed = sessionStorage.getItem(DISMISS_KEY);
      if (!force && dismissed === latest.tag) return;
      setRelease(latest);
      setVisible(true);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    check();
    const t = setInterval(() => check(), 1000 * 60 * 60); // 1h
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    if (release) sessionStorage.setItem(DISMISS_KEY, release.tag);
    setVisible(false);
  }

  function download() {
    const url = release?.apkUrl || release?.htmlUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (!visible || !release) {
    // Petit bouton discret en bas seulement si on veut forcer le check — skip
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] max-w-lg mx-auto">
      <div className="rounded-2xl border border-amber-500/40 bg-stone-900/95 backdrop-blur shadow-2xl p-4 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
          <Download className="text-amber-400" size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-100">
            Nouvelle version disponible
          </p>
          <p className="text-xs text-stone-400 mt-0.5">
            v{APP_VERSION} → <span className="text-amber-300">v{release.tag}</span>
            {release.name ? ` · ${release.name}` : ''}
          </p>
          <p className="text-[11px] text-stone-500 mt-1">
            Installez par-dessus l’ancienne version (sans désinstaller) pour garder vos données.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={download}
              className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <Download size={14} /> Télécharger la mise à jour
            </button>
            <button
              type="button"
              onClick={() => check(true)}
              className="btn-ghost text-xs py-2 px-2 flex items-center gap-1"
              disabled={checking}
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="text-stone-500 hover:text-stone-300 p-1">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
