import { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw, CloudOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { flushQueue, isOnline, queueCount } from '@/lib/offline';

export default function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  async function refreshPending() {
    try {
      setPending(await queueCount());
    } catch {
      /* ignore */
    }
  }

  async function sync() {
    if (!isOnline()) return;
    setSyncing(true);
    try {
      const result = await flushQueue(supabase);
      if (result.ok > 0) {
        setLastSync(`${result.ok} opération(s) synchronisée(s)`);
        setTimeout(() => setLastSync(null), 4000);
      }
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    refreshPending();

    function onOnline() {
      setOnline(true);
      sync();
    }
    function onOffline() {
      setOnline(false);
    }

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Sync périodique si en ligne
    const interval = setInterval(() => {
      if (isOnline()) sync();
      else refreshPending();
    }, 30000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, []);

  if (online && pending === 0 && !lastSync) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl px-4 py-3 shadow-xl border flex items-center gap-3 ${
        online
          ? 'bg-stone-900/95 border-primary-500/40 text-stone-100'
          : 'bg-amber-950/95 border-amber-500/40 text-amber-100'
      }`}
    >
      {online ? (
        pending > 0 || syncing ? (
          <RefreshCw size={18} className={`text-primary-400 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
        ) : (
          <Wifi size={18} className="text-success-400 shrink-0" />
        )
      ) : (
        <WifiOff size={18} className="text-amber-400 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        {!online && (
          <p className="text-sm font-medium">Mode hors ligne</p>
        )}
        {!online && (
          <p className="text-xs opacity-80">
            Les données restent disponibles. Les actions seront synchronisées au retour du réseau.
            {pending > 0 ? ` (${pending} en attente)` : ''}
          </p>
        )}
        {online && pending > 0 && (
          <p className="text-sm">
            {syncing ? 'Synchronisation…' : `${pending} action(s) en attente de sync`}
          </p>
        )}
        {online && lastSync && pending === 0 && (
          <p className="text-sm text-success-300">{lastSync}</p>
        )}
      </div>

      {online && pending > 0 && !syncing && (
        <button
          onClick={sync}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-500/20 text-primary-300 hover:bg-primary-500/30"
        >
          Sync
        </button>
      )}

      {!online && (
        <CloudOff size={16} className="text-amber-400/60 shrink-0" />
      )}
    </div>
  );
}
