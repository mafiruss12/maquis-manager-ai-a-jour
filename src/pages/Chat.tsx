import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState } from '@/components/ui';

interface ChatMessage {
  id: string;
  establishment_id: string;
  sender_id: string;
  sender_name: string | null;
  message: string;
  created_at: string;
}

export default function ChatPage() {
  const { member, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canChat = Boolean(member?.establishment_id && member?.status === 'active');

  async function loadMessages() {
    if (!member?.establishment_id) {
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('establishment_id', member.establishment_id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (err) setError(err.message);
    setMessages((data ?? []) as ChatMessage[]);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  useEffect(() => {
    loadMessages();
    if (!member?.establishment_id) return;

    const channel = supabase
      .channel(`chat-${member.establishment_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `establishment_id=eq.${member.establishment_id}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [member?.establishment_id]);

  /** Notifie tous les autres membres actifs de l'établissement */
  async function notifyTeam(messagePreview: string) {
    if (!member?.establishment_id || !user) return;
    const { data: teammates } = await supabase
      .from('members')
      .select('user_id')
      .eq('establishment_id', member.establishment_id)
      .eq('status', 'active')
      .neq('user_id', user.id);

    if (!teammates?.length) return;

    const senderLabel = member.full_name ?? member.email ?? 'Un collègue';
    const preview =
      messagePreview.length > 80 ? messagePreview.slice(0, 80) + '…' : messagePreview;

    const rows = teammates.map((t) => ({
      user_id: t.user_id,
      title: `Nouveau message de ${senderLabel}`,
      message: preview,
      read: false,
      type: 'chat',
      link: '/chat',
      action_label: 'Ouvrir le chat',
    }));

    await supabase.from('notifications').insert(rows);
  }

  async function send() {
    if (!text.trim() || !member?.establishment_id || !user) return;
    setSending(true);
    setError(null);
    const body = text.trim();
    const { error: err } = await supabase.from('chat_messages').insert({
      establishment_id: member.establishment_id,
      sender_id: user.id,
      sender_name: member.full_name ?? member.email,
      message: body,
    });
    if (err) {
      setError(err.message);
      setSending(false);
      return;
    }
    setText('');
    // Notifier les collègues (ne bloque pas l'UI)
    notifyTeam(body).catch(() => {});
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  if (!member?.establishment_id) {
    return (
      <EmptyState
        icon={<MessageCircle size={48} />}
        title="Aucun établissement"
        message="Créez ou rattachez un établissement dans Paramètres pour utiliser le chat."
      />
    );
  }

  if (!canChat) {
    return (
      <EmptyState
        icon={<MessageCircle size={48} />}
        title="Accès chat"
        message="Votre compte doit être actif et rattaché à un établissement."
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
          <MessageCircle size={24} className="text-primary-400" /> Chat interne
        </h1>
        <p className="text-stone-400 text-sm">
          Échanges de votre établissement uniquement. Les destinataires sont notifiés.
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-error-500/30 bg-error-500/10 px-3 py-2 text-sm text-error-300">
          {error}
        </div>
      )}

      <div className="flex-1 card overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-stone-500 text-sm py-10">
            Aucun message. Commencez la conversation avec votre équipe.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  mine ? 'bg-primary-600 text-white' : 'bg-stone-800 text-stone-100'
                }`}
              >
                {!mine && (
                  <p className="text-xs font-semibold opacity-70 mb-0.5">
                    {m.sender_name ?? 'Membre'}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                <p className={`text-[10px] mt-1 ${mine ? 'text-primary-200' : 'text-stone-500'}`}>
                  {new Date(m.created_at).toLocaleString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: 'short',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Écrire un message à l'équipe..."
          className="input-field flex-1"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="btn-primary px-4 flex items-center gap-2"
        >
          {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
