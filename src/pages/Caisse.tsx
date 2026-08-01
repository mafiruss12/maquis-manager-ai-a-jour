import { useEffect, useState } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, PaymentMethod } from '@/lib/types';
import { Modal, EmptyState } from '@/components/ui';

interface CartItem {
  product: Product;
  qty: number;
}

export default function Caisse() {
  const { member } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      if (!member?.establishment_id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('establishment_id', member.establishment_id)
        .order('name');
      setProducts((data ?? []) as Product[]);
      setLoading(false);
    })();
  }, [member]);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  async function processSale() {
    if (!member?.establishment_id || cart.length === 0) return;
    setProcessing(true);
    try {
      for (const item of cart) {
        await supabase.from('sales').insert({
          establishment_id: member.establishment_id,
          product_id: item.product.id,
          qty: item.qty,
          unit_price: item.product.price,
          total: item.product.price * item.qty,
          payment_method: paymentMethod,
          created_by: member.user_id,
        });
        await supabase
          .from('products')
          .update({ stock: Math.max(0, item.product.stock - item.qty) })
          .eq('id', item.product.id);
      }
      setSuccess(true);
      setCart([]);
      setTimeout(() => {
        setSuccess(false);
        setCheckoutOpen(false);
      }, 2000);
      const { data: refreshed } = await supabase
        .from('products')
        .select('*')
        .eq('establishment_id', member.establishment_id)
        .order('name');
      setProducts((refreshed ?? []) as Product[]);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;

  if (!member?.establishment_id) {
    return <EmptyState icon={<ShoppingCart size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-3rem)] lg:h-[calc(100vh-4rem)]">
      {/* Produits */}
      <div className="lg:col-span-2 flex flex-col">
        <h1 className="text-2xl font-bold font-display text-stone-100 mb-4">Caisse</h1>
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState icon={<ShoppingCart size={48} />} title="Aucun produit" message="Ajoutez des produits dans l'inventaire." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  className="card text-left transition-all hover:border-primary-500/50 hover:bg-stone-800/50 disabled:opacity-40 active:scale-95"
                >
                  <p className="font-medium text-stone-100 truncate">{p.name}</p>
                  <p className="text-sm text-stone-400 mt-1">{p.price.toLocaleString('fr-FR')} FCFA</p>
                  <p className={`text-xs mt-1 ${p.stock <= p.min_stock ? 'text-warning-400' : 'text-stone-500'}`}>
                    Stock: {p.stock} {p.unit}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panier */}
      <div className="card flex flex-col h-full">
        <h2 className="text-lg font-semibold text-stone-100 mb-3 flex items-center gap-2">
          <ShoppingCart size={20} /> Panier
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {cart.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-8">Panier vide</p>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex items-center gap-2 bg-stone-800/50 rounded-xl p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-200 truncate">{item.product.name}</p>
                  <p className="text-xs text-stone-500">{item.product.price.toLocaleString('fr-FR')} FCFA</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.product.id, -1)} className="p-1 rounded-lg hover:bg-stone-700 text-stone-300">
                    <Minus size={16} />
                  </button>
                  <span className="w-6 text-center text-sm text-stone-200">{item.qty}</span>
                  <button onClick={() => updateQty(item.product.id, 1)} className="p-1 rounded-lg hover:bg-stone-700 text-stone-300">
                    <Plus size={16} />
                  </button>
                  <button onClick={() => removeFromCart(item.product.id)} className="p-1 rounded-lg hover:bg-error-500/20 text-error-400 ml-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-stone-800 pt-3 mt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-stone-400">Total</span>
            <span className="text-2xl font-bold font-display text-primary-400">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <button
            onClick={() => setCheckoutOpen(true)}
            disabled={cart.length === 0}
            className="btn-primary w-full"
          >
            Encaisser
          </button>
        </div>
      </div>

      {/* Modal de paiement */}
      <Modal open={checkoutOpen} onClose={() => !processing && setCheckoutOpen(false)} title="Encaissement">
        {success ? (
          <div className="flex flex-col items-center py-8">
            <CheckCircle2 size={48} className="text-success-400 mb-3" />
            <p className="text-lg font-semibold text-stone-100">Vente enregistrée !</p>
          </div>
        ) : (
          <>
            <div className="bg-stone-800/50 rounded-xl p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-stone-400">Articles</span>
                <span className="text-stone-200">{cart.reduce((s, i) => s + i.qty, 0)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-stone-400">Total</span>
                <span className="font-bold text-primary-400">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
            <label className="label">Mode de paiement</label>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border flex items-center gap-2 justify-center transition-all ${
                  paymentMethod === 'cash' ? 'border-primary-500 bg-primary-500/10 text-primary-300' : 'border-stone-700 text-stone-400'
                }`}
              >
                <CreditCard size={18} /> Espèces
              </button>
              <button
                onClick={() => setPaymentMethod('mobile_money')}
                className={`p-3 rounded-xl border flex items-center gap-2 justify-center transition-all ${
                  paymentMethod === 'mobile_money' ? 'border-primary-500 bg-primary-500/10 text-primary-300' : 'border-stone-700 text-stone-400'
                }`}
              >
                <Smartphone size={18} /> Mobile Money
              </button>
            </div>
            <button onClick={processSale} disabled={processing} className="btn-primary w-full flex items-center justify-center gap-2">
              {processing ? <Loader2 className="animate-spin" size={18} /> : null}
              Confirmer la vente
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
