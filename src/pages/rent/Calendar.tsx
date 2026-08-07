import { useEffect, useState } from 'react';
import { Calendar as CalIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState, Badge } from '@/components/ui';
import { RENTAL_STATUS_LABELS } from '@/lib/businessTypes';
import type { RentalOrder } from '@/lib/rentalTypes';

export default function RentCalendar() {
  const { member } = useAuth();
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState(true);

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
        .neq('status', 'cancelled')
        .order('event_date');
      setOrders((data ?? []) as RentalOrder[]);
      setLoading(false);
    })();
  }, [member?.establishment_id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  const byDate: Record<string, RentalOrder[]> = {};
  for (const o of orders) {
    const d = o.event_date || 'Sans date';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(o);
  }
  const dates = Object.keys(byDate).sort();

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-1">Calendrier</h1>
      <p className="text-stone-400 text-sm mb-6">Événements et statuts des commandes</p>

      {dates.length === 0 ? (
        <EmptyState icon={<CalIcon size={48} />} title="Aucun événement" message="Les commandes datées apparaîtront ici." />
      ) : (
        <div className="space-y-4">
          {dates.map((d) => (
            <div key={d}>
              <p className="text-sm font-semibold text-primary-400 mb-2">{d}</p>
              <div className="space-y-2">
                {byDate[d].map((o) => (
                  <div key={o.id} className="card flex justify-between items-center">
                    <div>
                      <p className="text-stone-100 font-medium">{o.client_name || 'Client'}</p>
                      <p className="text-xs text-stone-500">Retour {o.return_date || '—'}</p>
                    </div>
                    <Badge color={o.status === 'out' ? 'warning' : o.status === 'returned' ? 'success' : 'primary'}>
                      {RENTAL_STATUS_LABELS[o.status] || o.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
