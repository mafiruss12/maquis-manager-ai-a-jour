import { useEffect, useState } from 'react';
import { Package, Plus, Pencil, Trash2, AlertTriangle, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product } from '@/lib/types';
import { Modal, EmptyState, Badge } from '@/components/ui';
import { cacheSet, fetchWithCache, isOnline, queueAdd } from '@/lib/offline';

export default function Inventaire() {
  const { member } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', category: '', price: '', cost: '', stock: '', min_stock: '', unit: 'unité' });

  async function loadProducts() {
    if (!member?.establishment_id) {
      setLoading(false);
      return;
    }
    const cacheKey = `products:${member.establishment_id}`;
    const { data } = await fetchWithCache<Product[]>(cacheKey, async () => {
      const res = await supabase
        .from('products')
        .select('*')
        .eq('establishment_id', member.establishment_id)
        .order('name');
      return (res.data ?? []) as Product[];
    });
    setProducts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', category: '', price: '', cost: '', stock: '', min_stock: '', unit: 'unité' });
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      cost: String(p.cost),
      stock: String(p.stock),
      min_stock: String(p.min_stock),
      unit: p.unit,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!member?.establishment_id || !form.name) return;
    const payload = {
      establishment_id: member.establishment_id,
      name: form.name,
      category: form.category || 'autre',
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      unit: form.unit,
    };
    if (isOnline()) {
      if (editing) {
        await supabase.from('products').update(payload).eq('id', editing.id);
      } else {
        await supabase.from('products').insert(payload);
      }
    } else {
      if (editing) {
        await queueAdd('products', 'update', payload, { id: editing.id });
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...payload } : p)));
      } else {
        const tempId = `offline-${Date.now()}`;
        await queueAdd('products', 'insert', payload);
        setProducts((prev) => [
          ...prev,
          { id: tempId, created_at: new Date().toISOString(), ...payload } as Product,
        ]);
      }
      await cacheSet(
        `products:${member.establishment_id}`,
        // recompute after state is tricky; reload from current+change on next open
      );
    }
    setModalOpen(false);
    if (isOnline()) await loadProducts();
  }

  async function remove(p: Product) {
    if (!confirm(`Supprimer "${p.name}" ?`)) return;
    if (isOnline()) {
      await supabase.from('products').delete().eq('id', p.id);
      await loadProducts();
    } else {
      await queueAdd('products', 'delete', {}, { id: p.id });
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    }
  }

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;

  if (!member?.establishment_id) {
    return <EmptyState icon={<Package size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Inventaire</h1>
          <p className="text-stone-400 text-sm">Gérez vos produits et votre stock</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Ajouter
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Package size={48} />} title="Aucun produit" message="Ajoutez votre premier produit." />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const lowStock = Number(p.stock) <= Number(p.min_stock);
            return (
              <div key={p.id} className="card flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${lowStock ? 'bg-warning-500/10' : 'bg-stone-800'}`}>
                  <Package size={20} className={lowStock ? 'text-warning-400' : 'text-stone-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-stone-100 truncate">{p.name}</p>
                    {lowStock && <Badge color="warning">Stock faible</Badge>}
                  </div>
                  <p className="text-sm text-stone-400">
                    {p.category} · {p.price.toLocaleString('fr-FR')} FCFA · Stock: {p.stock} {p.unit}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => remove(p)} className="p-2 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le produit' : 'Nouveau produit'}>
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Nom du produit" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Catégorie</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field" placeholder="ex: Boissons" />
            </div>
            <div>
              <label className="label">Unité</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input-field" placeholder="ex: bouteille" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prix de vente (FCFA)</label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label">Coût (FCFA)</label>
              <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Stock actuel</label>
              <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label">Stock minimum</label>
              <input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} className="input-field" />
            </div>
          </div>
          <button onClick={save} className="btn-primary w-full">{editing ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </Modal>
    </div>
  );
}
