import { useEffect, useState } from 'react';
import { UserCircle, Plus, Loader2, MessageCircle, Pencil, Trash2, MapPin, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState, Modal } from '@/components/ui';
import { buildWhatsAppLink, buildSmsLink } from '@/lib/businessTypes';
import type { RentalClient } from '@/lib/rentalTypes';

const empty = { full_name: '', phone: '', whatsapp: '', email: '', location: '', notes: '' };

export default function RentClients() {
  const { member } = useAuth();
  const [list, setList] = useState<RentalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function openCreate() {
    setEditId(null);
    setForm(empty);
    setError(null);
    setOpen(true);
  }

  function openEdit(c: RentalClient) {
    setEditId(c.id);
    setForm({
      full_name: c.full_name || '',
      phone: c.phone || '',
      whatsapp: c.whatsapp || c.phone || '',
      email: c.email || '',
      location: c.location || '',
      notes: c.notes || '',
    });
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!member?.establishment_id || !form.full_name.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      whatsapp: form.whatsapp || form.phone || null,
      email: form.email || null,
      location: form.location || null,
      notes: form.notes || null,
    };
    let err;
    if (editId) {
      ({ error: err } = await supabase.from('rental_clients').update(payload).eq('id', editId));
    } else {
      ({ error: err } = await supabase.from('rental_clients').insert({
        establishment_id: member.establishment_id,
        ...payload,
      }));
    }
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    setEditId(null);
    setForm(empty);
    await load();
  }

  async function removeClient(c: RentalClient, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Supprimer ${c.full_name} ?`)) return;
    await supabase.from('rental_clients').delete().eq('id', c.id);
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
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Clients</h1>
          <p className="text-stone-400 text-sm">Fiches livraisons — téléphone, WhatsApp, localisation</p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<UserCircle size={48} />} title="Aucun client" message="Ajoutez un client pour les livraisons." />
      ) : (
        <div className="space-y-2">
          {list.map((c) => {
            const wa = c.whatsapp || c.phone;
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => openEdit(c)}
                className="card w-full text-left flex items-center gap-3 active:scale-[0.99]"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-100 flex items-center gap-2">
                    {c.full_name}
                    <Pencil size={14} className="text-stone-500" />
                  </p>
                  <p className="text-xs text-stone-500 flex flex-wrap gap-x-2 gap-y-0.5">
                    {c.phone && (
                      <span className="inline-flex items-center gap-0.5">
                        <Phone size={10} /> {c.phone}
                      </span>
                    )}
                    {c.location && (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin size={10} /> {c.location}
                      </span>
                    )}
                    {c.email && <span>{c.email}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {wa && (
                    <a
                      href={buildWhatsAppLink(wa, `Bonjour ${c.full_name}, `)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-lg bg-success-500/15 text-success-400"
                    >
                      <MessageCircle size={18} />
                    </a>
                  )}
                  <button
                    type="button"
                    className="p-2.5 rounded-lg hover:bg-error-500/10 text-stone-400"
                    onClick={(e) => removeClient(c, e)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditId(null);
        }}
        title={editId ? 'Modifier le client' : 'Nouveau client'}
      >
        <div className="space-y-3">
          {error && (
            <div className="text-sm text-error-300 bg-error-500/10 border border-error-500/30 rounded-xl p-3">{error}</div>
          )}
          <div>
            <label className="label">Nom complet *</label>
            <input className="input-field" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+225 …" />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input
              className="input-field"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="Si différent du téléphone"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Localisation / adresse livraison</label>
            <input className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Quartier, ville…" />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : editId ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
