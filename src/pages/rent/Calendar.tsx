import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalIcon, Loader2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState, Badge, Modal } from '@/components/ui';
import { RENTAL_STATUS_LABELS } from '@/lib/businessTypes';
import type { RentalOrder } from '@/lib/rentalTypes';
import { formatFCFA } from '@/lib/format';

const WEEKDAYS = ['LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.', 'DIM.'];

function statusColor(s: string): 'primary' | 'warning' | 'success' | 'neutral' | 'error' {
  if (s === 'confirmed' || s === 'draft') return 'primary';
  if (s === 'out') return 'warning';
  if (s === 'returned') return 'success';
  if (s === 'cancelled') return 'error';
  return 'neutral';
}

function monthMatrix(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  // Monday-first
  let startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function RentCalendar() {
  const { member } = useAuth();
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const rows = useMemo(() => monthMatrix(year, month), [year, month]);

  const byDate = useMemo(() => {
    const map: Record<string, RentalOrder[]> = {};
    for (const o of orders) {
      // Afficher sur event_date ET return_date
      for (const key of [o.event_date, o.return_date]) {
        if (!key) continue;
        if (!map[key]) map[key] = [];
        if (!map[key].find((x) => x.id === o.id)) map[key].push(o);
      }
    }
    return map;
  }, [orders]);

  const selectedOrders = selectedDay ? byDate[selectedDay] || [] : [];

  const monthLabel = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Calendrier</h1>
          <p className="text-stone-400 text-sm">Commandes par jour (plusieurs possibles)</p>
        </div>
        <Link to="/rent/orders" className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={18} /> Commande
        </Link>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-[11px] text-stone-400 mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-400" /> À livrer</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> En cours</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success-400" /> Terminée</span>
      </div>

      <div className="card p-3 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-stone-800 text-stone-300"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeft size={20} />
          </button>
          <p className="font-semibold text-stone-100 capitalize">{monthLabel}</p>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-stone-800 text-stone-300"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-stone-500 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {rows.flat().map((cell, idx) => {
            if (!cell) return <div key={`e-${idx}`} className="min-h-[52px]" />;
            const key = isoDate(cell);
            const dayOrders = byDate[key] || [];
            const isToday = key === isoDate(today);
            const hasOut = dayOrders.some((o) => o.status === 'out');
            const hasPending = dayOrders.some((o) => o.status === 'confirmed' || o.status === 'draft');
            const hasDone = dayOrders.some((o) => o.status === 'returned');

            return (
              <button
                type="button"
                key={key}
                onClick={() => setSelectedDay(key)}
                className={`min-h-[52px] rounded-xl p-1 text-left transition-colors border ${
                  isToday ? 'border-primary-500 bg-primary-500/10' : 'border-transparent hover:bg-stone-800/80'
                } ${selectedDay === key ? 'ring-1 ring-primary-400' : ''}`}
              >
                <span
                  className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? 'bg-primary-500 text-white' : 'text-stone-300'
                  }`}
                >
                  {cell.getDate()}
                </span>
                <div className="flex flex-wrap gap-0.5 mt-0.5 min-h-[8px]">
                  {hasPending && <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />}
                  {hasOut && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  {hasDone && <span className="w-1.5 h-1.5 rounded-full bg-success-400" />}
                </div>
                {dayOrders.length > 0 && (
                  <p className="text-[9px] text-stone-500 mt-0.5">{dayOrders.length} cmd</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste du jour sélectionné */}
      {selectedDay && (
        <div className="space-y-2 mb-4">
          <p className="text-sm font-semibold text-stone-200">
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
            <span className="text-stone-500 font-normal"> · {selectedOrders.length} commande(s)</span>
          </p>
          {selectedOrders.length === 0 ? (
            <p className="text-sm text-stone-500">Aucune commande ce jour.</p>
          ) : (
            selectedOrders.map((o) => (
              <div key={o.id} className="card flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium text-stone-100">{o.client_name || 'Client'}</p>
                  <p className="text-xs text-stone-500">
                    Événement {o.event_date || '—'} · Retour {o.return_date || '—'}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {formatFCFA(Number(o.total_amount))} · payé {formatFCFA(Number(o.paid_amount))}
                  </p>
                </div>
                <Badge color={statusColor(o.status)}>{RENTAL_STATUS_LABELS[o.status] || o.status}</Badge>
              </div>
            ))
          )}
          <Link to="/rent/orders" className="btn-secondary w-full text-center text-sm py-2 block">
            + Ajouter une commande
          </Link>
        </div>
      )}

      {!selectedDay && orders.length === 0 && (
        <EmptyState
          icon={<CalIcon size={48} />}
          title="Aucune commande"
          message="Créez une commande pour la voir apparaître sur le calendrier."
        />
      )}
    </div>
  );
}
