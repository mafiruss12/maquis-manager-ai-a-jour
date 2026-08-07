import { useEffect, useState } from 'react';
import { FileText, Loader2, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA } from '@/lib/format';
import { EmptyState } from '@/components/ui';
import { RENTAL_STATUS_LABELS } from '@/lib/businessTypes';
import type { RentalOrder, RentalOrderItem } from '@/lib/rentalTypes';
import { orderBalance } from '@/lib/rentalTypes';

export default function RentInvoices() {
  const { member, activeEstablishment } = useAuth();
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ order: RentalOrder; items: RentalOrderItem[] } | null>(null);

  useEffect(() => {
    (async () => {
      if (!member?.establishment_id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('rental_orders')
        .select('*')
        .eq('establishment_id', member.establishment_id)
        .order('created_at', { ascending: false });
      setOrders((data ?? []) as RentalOrder[]);
      setLoading(false);
    })();
  }, [member?.establishment_id]);

  async function openInvoice(o: RentalOrder) {
    const { data } = await supabase.from('rental_order_items').select('*').eq('order_id', o.id);
    setDetail({ order: o, items: (data ?? []) as RentalOrderItem[] });
  }

  function printInvoice() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  if (detail) {
    const { order, items } = detail;
    return (
      <div>
        <div className="flex gap-2 mb-4 print:hidden">
          <button className="btn-secondary" onClick={() => setDetail(null)}>
            Retour
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={printInvoice}>
            <Printer size={16} /> Imprimer / PDF
          </button>
        </div>
        <div className="card max-w-lg mx-auto bg-white text-stone-900 print:shadow-none">
          <h1 className="text-xl font-bold">{activeEstablishment?.name || 'Location'}</h1>
          <p className="text-sm text-stone-600 mb-4">Facture / Reçu client</p>
          <p>
            <strong>Client :</strong> {order.client_name || '—'}
          </p>
          <p>
            <strong>Tél :</strong> {order.client_phone || '—'}
          </p>
          <p>
            <strong>Événement :</strong> {order.event_date || '—'}
          </p>
          <p>
            <strong>Retour :</strong> {order.return_date || '—'}
          </p>
          <p>
            <strong>Statut :</strong> {RENTAL_STATUS_LABELS[order.status]}
          </p>
          <table className="w-full text-sm mt-4 border-t">
            <thead>
              <tr className="text-left">
                <th className="py-2">Article</th>
                <th>Qté</th>
                <th>P.U.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-stone-200">
                  <td className="py-1">{it.equipment_name}</td>
                  <td>{it.qty}</td>
                  <td>{formatFCFA(Number(it.unit_price))}</td>
                  <td>{formatFCFA(Number(it.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-right space-y-1">
            <p>
              Total : <strong>{formatFCFA(Number(order.total_amount))}</strong>
            </p>
            <p>Payé : {formatFCFA(Number(order.paid_amount))}</p>
            <p>
              Solde : <strong>{formatFCFA(orderBalance(order))}</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-1">Factures</h1>
      <p className="text-stone-400 text-sm mb-6">Reçus clients imprimables</p>
      {orders.length === 0 ? (
        <EmptyState icon={<FileText size={48} />} title="Aucune commande" message="" />
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <button key={o.id} type="button" onClick={() => openInvoice(o)} className="card w-full text-left hover:border-primary-500/40">
              <p className="font-medium text-stone-100">{o.client_name || 'Client'}</p>
              <p className="text-xs text-stone-500">
                {o.event_date || '—'} · {formatFCFA(Number(o.total_amount))} · {RENTAL_STATUS_LABELS[o.status]}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
