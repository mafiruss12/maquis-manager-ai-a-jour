import { useEffect, useState } from 'react';
import { UserCircle, Plus, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState, Modal } from '@/components/ui';
import { buildWhatsAppLink } from '@/lib/businessTypes';
import type { RentalClient } from '@/lib/rentalTypes';

export default function RentClients() {
  const { member } = useAuth();
  const [list, setList] = useState<RentalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', location: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!member?.establishment_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('rental_clients')
      .select('*')
      .eq('establishment_id', member.establishment_id)
      .order('full_name');
    setList((data ?? []) as RentalClient[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.establishment_id]);

  async function save() {
    if (!member?.establishment_id || !form.full_name.trim()) return;
    setSaving(true);
    await supabase.from('rental_clients').insert({
      establishment_id: member.establishment_id,
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      location: form.location || null,
      notes: form.notes || null,
    });
    setSaving(false);
    setOpen(false);
    setForm({ full_name: '', phone: '', location: '', notes: '' });
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Clients</h1>
          <p className="text-stone-400 text-sm">Fiches clients location</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<UserCircle size={48} />} title="Aucun client" message="Ajoutez votre premier client." />
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <div key={c.id} className="card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-100">{c.full_name}</p>
                <p className="text-xs text-stone-500">
                  {c.phone || '—'} · {c.location || '—'}
                </p>
              </div>
              {c.phone && (
                <a
                  href={buildWhatsAppLink(c.phone, `Bonjour ${c.full_name}, `)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-lg bg-success-500/15 text-success-400"
                >
                  <MessageCircle size={18} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau client">
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input className="input-field" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+225 …" />
          </div>
          <div>
            <label className="label">Localisation</label>
            <input className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Enregistrer'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
