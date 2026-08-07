import { useEffect, useState } from 'react';
import { Package, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA } from '@/lib/format';
import { EmptyState, Modal } from '@/components/ui';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
} from '@/lib/businessTypes';
import type { RentalEquipment } from '@/lib/rentalTypes';

export default function RentEquipment() {
  const { member } = useAuth();
  const [items, setItems] = useState<RentalEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'chaises',
    qty_total: 0,
    unit_price: 0,
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!member?.establishment_id) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('rental_equipment')
      .select('*')
      .eq('establishment_id', member.establishment_id)
      .order('category')
      .order('name');
    setItems((data ?? []) as RentalEquipment[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.establishment_id]);

  async function save() {
    if (!member?.establishment_id || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const qty = Math.max(0, Number(form.qty_total) || 0);
    const { error: err } = await supabase.from('rental_equipment').insert({
      establishment_id: member.establishment_id,
      name: form.name.trim(),
      category: form.category,
      description: form.description || null,
      qty_total: qty,
      qty_available: qty,
      qty_reserved: 0,
      qty_out: 0,
      qty_damaged: 0,
      unit_price: Number(form.unit_price) || 0,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    setForm({ name: '', category: 'chaises', qty_total: 0, unit_price: 0, description: '' });
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  if (!member?.establishment_id) {
    return (
      <EmptyState
        icon={<Package size={48} />}
        title="Aucun établissement"
        message="Créez une activité Location événementielle."
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Matériel</h1>
          <p className="text-stone-400 text-sm">Stock location — dispo, réservé, dehors, endommagé</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Package size={48} />}
          title="Aucun matériel"
          message="Ajoutez chaises, tables, bâches, etc."
        />
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="card flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-100">{it.name}</p>
                <p className="text-xs text-stone-500">
                  {EQUIPMENT_CATEGORY_LABELS[it.category] || it.category} ·{' '}
                  {formatFCFA(Number(it.unit_price))}/j
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <p className="text-stone-500">Total</p>
                  <p className="font-semibold text-stone-200">{it.qty_total}</p>
                </div>
                <div>
                  <p className="text-stone-500">Dispo</p>
                  <p className="font-semibold text-success-400">{it.qty_available}</p>
                </div>
                <div>
                  <p className="text-stone-500">Réservé</p>
                  <p className="font-semibold text-amber-400">{it.qty_reserved}</p>
                </div>
                <div>
                  <p className="text-stone-500">Dehors</p>
                  <p className="font-semibold text-primary-400">{it.qty_out}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau matériel">
        <div className="space-y-3">
          {error && (
            <div className="text-sm text-error-300 bg-error-500/10 border border-error-500/30 rounded-xl p-3">
              {error}
            </div>
          )}
          <div>
            <label className="label">Nom</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Chaise pliante"
            />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select
              className="input-field"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {EQUIPMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EQUIPMENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantité totale</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={form.qty_total}
                onChange={(e) => setForm({ ...form, qty_total: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Prix unitaire (FCFA)</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
              />
            </div>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Enregistrer'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
