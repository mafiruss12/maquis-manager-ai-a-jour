import { useEffect, useState } from 'react';
import { Receipt, Plus, Trash2, ShoppingBag, CheckCircle2, Clock, UtensilsCrossed, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, RestaurantTable, Order } from '@/lib/types';
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from '@/lib/types';
import { formatFCFA, formatTime } from '@/lib/format';
import { Modal, EmptyState, Badge } from '@/components/ui';

interface CartItem { product: Product; qty: number }

export default function Orders() {
  const { member } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [tableId, setTableId] = useState('');
  const [notes, setNotes] = useState('');

  async function load() {
    if (!member?.establishment_id) { setLoading(false); return; }
    const [prodRes, tabRes, ordRes] = await Promise.all([
      supabase.from('products').select('*').eq('establishment_id', member.establishment_id).order('name'),
      supabase.from('restaurant_tables').select('*').eq('establishment_id', member.establishment_id).order('number'),
      supabase.from('orders').select('*').eq('establishment_id', member.establishment_id).in('status', ['pending', 'preparing', 'ready']).order('created_at', { ascending: false }),
    ]);
    setProducts((prodRes.data ?? []) as Product[]);
    setTables((tabRes.data ?? []) as RestaurantTable[]);
    setOrders((ordRes.data ?? []) as Order[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [member]);

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0);

  function addToCart(p: Product) {
    setCart((prev) => {
      const ex = prev.find((i) => i.product.id === p.id);
      if (ex) return prev.map((i) => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) => prev.map((i) => i.product.id === id ? { ...i, qty: i.qty + delta } : i).filter((i) => i.qty > 0));
  }

  async function createOrder() {
    if (!member?.establishment_id || cart.length === 0) return;
    const table = tables.find((t) => t.id === tableId);
    const { data: order } = await supabase.from('orders').insert({
      establishment_id: member.establishment_id,
      table_id: tableId || null,
      table_number: table?.number ?? null,
      status: 'pending',
      order_type: orderType,
      total: cartTotal,
      notes: notes || null,
      created_by: member.user_id,
    }).select().single();

    if (order) {
      for (const item of cart) {
        await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: item.product.id,
          product_name: item.product.name,
          qty: item.qty,
          unit_price: item.product.price,
          status: 'pending',
        });
      }
      if (tableId) {
        await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId);
      }
    }
    setModalOpen(false);
    setCart([]);
    setTableId('');
    setNotes('');
    await load();
  }

  async function advanceStatus(o: Order) {
    const next: Record<string, string> = { pending: 'preparing', preparing: 'ready', ready: 'served' };
    if (o.status === 'ready') {
      for (const item of cart) { /* no-op */ }
      await supabase.from('orders').update({ status: 'served' }).eq('id', o.id);
      if (o.table_id) await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', o.table_id);
    } else {
      await supabase.from('orders').update({ status: next[o.status] }).eq('id', o.id);
    }
    await load();
  }

  async function cancelOrder(o: Order) {
    if (!confirm('Annuler cette commande ?')) return;
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', o.id);
    if (o.table_id) await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', o.table_id);
    await load();
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<Receipt size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Commandes</h1>
          <p className="text-stone-400 text-sm">{orders.length} commande{orders.length > 1 ? 's' : ''} active{orders.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Nouvelle commande</button>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={<Receipt size={48} />} title="Aucune commande active" message="Créez une nouvelle commande." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {orders.map((o) => (
            <div key={o.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-stone-100">{o.table_number ?? 'À emporter'}</p>
                  <p className="text-xs text-stone-500">{formatTime(o.created_at)} · {ORDER_TYPE_LABELS[o.order_type]}</p>
                </div>
                <Badge color={o.status === 'pending' ? 'warning' : o.status === 'preparing' ? 'primary' : 'success'}>
                  {ORDER_STATUS_LABELS[o.status]}
                </Badge>
              </div>
              {o.notes && <p className="text-sm text-stone-400 mb-2 italic">"{o.notes}"</p>}
              <p className="text-lg font-bold text-primary-400 mb-3">{formatFCFA(o.total)}</p>
              <div className="flex gap-2">
                {o.status !== 'ready' && o.status !== 'served' && (
                  <button onClick={() => advanceStatus(o)} className="btn-primary flex-1 text-sm py-2">
                    {o.status === 'pending' ? 'En préparation' : 'Marquer prêt'}
                  </button>
                )}
                {o.status === 'ready' && (
                  <button onClick={() => advanceStatus(o)} className="btn-secondary flex-1 text-sm py-2">Servi</button>
                )}
                <button onClick={() => cancelOrder(o)} className="btn-danger px-3 py-2"><X size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle commande">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['dine_in', 'takeaway', 'delivery'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={`p-2 rounded-xl border text-sm transition-all ${
                  orderType === t ? 'border-primary-500 bg-primary-500/10 text-primary-300' : 'border-stone-700 text-stone-400'
                }`}
              >
                {ORDER_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          {orderType === 'dine_in' && (
            <div>
              <label className="label">Table</label>
              <select value={tableId} onChange={(e) => setTableId(e.target.value)} className="input-field">
                <option value="">— Choisir —</option>
                {tables.filter((t) => t.status !== 'occupied').map((t) => (
                  <option key={t.id} value={t.id}>Table {t.number} ({t.seats} places)</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Produits</label>
            <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-2">
              {products.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock <= 0}
                  className="p-2 rounded-lg bg-stone-800 text-left text-sm hover:bg-stone-700 disabled:opacity-40 transition-all">
                  <p className="text-stone-200 truncate">{p.name}</p>
                  <p className="text-xs text-stone-500">{formatFCFA(p.price)}</p>
                </button>
              ))}
            </div>
          </div>
          {cart.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-2 bg-stone-800/50 rounded-lg p-2">
                  <span className="flex-1 text-sm text-stone-200 truncate">{item.product.name}</span>
                  <button onClick={() => updateQty(item.product.id, -1)} className="text-stone-400 hover:text-stone-200">−</button>
                  <span className="w-6 text-center text-sm">{item.qty}</span>
                  <button onClick={() => updateQty(item.product.id, 1)} className="text-stone-400 hover:text-stone-200">+</button>
                  <span className="text-sm text-stone-300 w-20 text-right">{formatFCFA(item.product.price * item.qty)}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" placeholder="Sans glace, etc." />
          </div>
          <div className="flex justify-between items-center text-lg">
            <span className="text-stone-400">Total</span>
            <span className="font-bold text-primary-400">{formatFCFA(cartTotal)}</span>
          </div>
          <button onClick={createOrder} disabled={cart.length === 0} className="btn-primary w-full">Créer la commande</button>
        </div>
      </Modal>
    </div>
  );
}
