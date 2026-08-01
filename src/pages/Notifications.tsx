import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, BellOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Notification } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { EmptyState } from '@/components/ui';

export default function Notifications() {
  const { member } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!member?.user_id) { setLoading(false); return; }
    const { data } = await supabase.from('notifications').select('*').eq('user_id', member.user_id).order('created_at', { ascending: false }).limit(50);
    setNotifs((data ?? []) as Notification[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [member]);

  async function markAllRead() {
    const unread = notifs.filter((n) => !n.read);
    for (const n of unread) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    }
    await load();
  }

  async function markRead(n: Notification) {
    await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    await load();
  }

  async function remove(n: Notification) {
    await supabase.from('notifications').delete().eq('id', n.id);
    await load();
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Notifications</h1>
          <p className="text-stone-400 text-sm">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-ghost flex items-center gap-2"><CheckCheck size={18} /> Tout marquer lu</button>
        )}
      </div>

      {notifs.length === 0 ? (
        <EmptyState icon={<BellOff size={48} />} title="Aucune notification" message="Vous êtes à jour !" />
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => (
            <div
              key={n.id}
              className={`card flex items-start gap-3 transition-all ${!n.read ? 'border-primary-500/30 bg-primary-500/5' : ''}`}
            >
              <div className={`p-2 rounded-lg ${!n.read ? 'bg-primary-500/10' : 'bg-stone-800'}`}>
                <Bell size={18} className={!n.read ? 'text-primary-400' : 'text-stone-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${!n.read ? 'text-stone-100' : 'text-stone-300'}`}>{n.title}</p>
                {n.message && <p className="text-sm text-stone-400 mt-0.5">{n.message}</p>}
                <p className="text-xs text-stone-500 mt-1">{formatDateTime(n.created_at)}</p>
              </div>
              <div className="flex gap-1">
                {!n.read && (
                  <button onClick={() => markRead(n)} className="p-2 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-primary-400" title="Marquer lu">
                    <CheckCheck size={16} />
                  </button>
                )}
                <button onClick={() => remove(n)} className="p-2 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
