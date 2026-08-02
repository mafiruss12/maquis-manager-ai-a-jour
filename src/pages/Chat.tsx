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
  const bottomRef = useRef<HTMLDivElement>(null);

  const canChat =
    member?.establishment_id &&
    member &&
    ['super_admin', 'admin', 'manager'].includes(member.role);

  async function loadMessages() {
    if (!member?.establishment_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('establishment_id', member.establishment_id)
      .order('created_at', { ascending: true })
      .limit(200);
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
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [member?.establishment_id]);

  async function send() {
    if (!text.trim() || !member?.establishment_id || !user) return;
    setSending(true);
    await supabase.from('chat_messages').insert({
      establishment_id: member.establishment_id,
      sender_id: user.id,
      sender_name: member.full_name ?? member.email,
      message: text.trim(),
    });
    setText('');
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
        title="Chat réservé"
        message="Le chat est réservé au propriétaire et au gérant de l'établissement."
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
          Échanges privés entre propriétaire et gérant de votre établissement uniquement.
        </p>
      </div>

      <div className="flex-1 card overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-stone-500 text-sm py-10">Aucun message. Commencez la conversation.</p>
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
                  <p className="text-xs font-semibold opacity-70 mb-0.5">{m.sender_name ?? 'Membre'}</p>
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
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Écrire un message..."
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
