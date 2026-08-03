import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2, BellOff, ExternalLink, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Notification } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { EmptyState } from '@/components/ui';

export default function Notifications() {
  const { member } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!member?.user_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', member.user_id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifs((data ?? []) as Notification[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (!member?.user_id) return;

    const channel = supabase
      .channel(`notifs-${member.user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${member.user_id}`,
        },
        (payload) => {
          setNotifs((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.user_id]);

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

  async function openAction(n: Notification) {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
    }
    if (n.link) {
      navigate(n.link);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  }

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Notifications</h1>
          <p className="text-stone-400 text-sm">
            {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-ghost flex items-center gap-2">
            <CheckCheck size={18} /> Tout marquer lu
          </button>
        )}
      </div>

      {notifs.length === 0 ? (
        <EmptyState
          icon={<BellOff size={48} />}
          title="Aucune notification"
          message="Les messages du chat et alertes apparaîtront ici."
        />
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => (
            <div
              key={n.id}
              className={`card flex items-start gap-3 transition-all ${
                !n.read ? 'border-primary-500/30 bg-primary-500/5' : ''
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  n.type === 'chat' ? 'bg-primary-500/15' : !n.read ? 'bg-primary-500/10' : 'bg-stone-800'
                }`}
              >
                {n.type === 'chat' ? (
                  <MessageCircle size={18} className="text-primary-400" />
                ) : (
                  <Bell size={18} className={!n.read ? 'text-primary-400' : 'text-stone-500'} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${!n.read ? 'text-stone-100' : 'text-stone-300'}`}>
                  {n.title}
                </p>
                {n.message && <p className="text-sm text-stone-400 mt-0.5">{n.message}</p>}
                <p className="text-xs text-stone-500 mt-1">{formatDateTime(n.created_at)}</p>
                {n.link && (
                  <button
                    onClick={() => openAction(n)}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-400 hover:text-primary-300"
                  >
                    <ExternalLink size={14} />
                    {n.action_label || 'Ouvrir'}
                  </button>
                )}
              </div>
              <div className="flex gap-1">
                {!n.read && (
                  <button
                    onClick={() => markRead(n)}
                    className="p-2 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-primary-400"
                    title="Marquer lu"
                  >
                    <CheckCheck size={16} />
                  </button>
                )}
                <button
                  onClick={() => remove(n)}
                  className="p-2 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400"
                >
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
