import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, TrendingUp, Package, Wallet, AlertTriangle, Users, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { EmptyState } from '@/components/ui';
import type { Member } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { Link } from 'react-router-dom';

export default function SuiviGerant() {
  const { member } = useAuth();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Member[]>([]);
  const [salesToday, setSalesToday] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [expensesToday, setExpensesToday] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [reportToday, setReportToday] = useState<any>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  const canView =
    member &&
    ['super_admin', 'admin', 'owner'].includes(member.role) &&
    member.establishment_id;

  async function load() {
    if (!member?.establishment_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const est = member.establishment_id;
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [teamRes, salesRes, expRes, prodRes, reportRes] = await Promise.all([
      supabase.from('members').select('*').eq('establishment_id', est).eq('status', 'active'),
      supabase
        .from('sales')
        .select('id, total, qty, created_at, created_by')
        .eq('establishment_id', est)
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('expenses')
        .select('amount, created_at')
        .eq('establishment_id', est)
        .gte('created_at', start.toISOString()),
      supabase.from('products').select('id, stock, min_stock').eq('establishment_id', est),
      supabase
        .from('daily_reports')
        .select('*')
        .eq('establishment_id', est)
        .eq('date', start.toISOString().slice(0, 10))
        .maybeSingle(),
    ]);

    setTeam((teamRes.data ?? []) as Member[]);
    const sales = salesRes.data ?? [];
    setRecentSales(sales);
    setSalesCount(sales.length);
    setSalesToday(sales.reduce((s, x) => s + Number(x.total || 0), 0));
    setExpensesToday((expRes.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0));
    setLowStock((prodRes.data ?? []).filter((p) => Number(p.stock) <= Number(p.min_stock)).length);
    setReportToday(reportRes.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.establishment_id]);

  const managers = useMemo(
    () => team.filter((m) => ['manager', 'admin', 'owner', 'cashier'].includes(m.role)),
    [team]
  );

  if (!canView) {
    return (
      <EmptyState
        icon={<ClipboardList size={48} />}
        title="Suivi réservé"
        message="Réservé au propriétaire et à l’administrateur de l’établissement."
      />
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-stone-400">Chargement du suivi…</div>;
  }

  const margin = salesToday - expensesToday;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <ClipboardList className="text-amber-400" /> Suivi gérant / équipe
          </h1>
          <p className="text-stone-400 text-sm">Vue propriétaire — activité du jour en temps réel</p>
        </div>
        <button type="button" onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-stone-500 flex items-center gap-1"><TrendingUp size={12} /> Ventes du jour</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{salesToday.toLocaleString('fr-FR')} F</p>
          <p className="text-xs text-stone-500">{salesCount} ticket(s)</p>
        </div>
        <div className="card">
          <p className="text-xs text-stone-500 flex items-center gap-1"><Wallet size={12} /> Dépenses du jour</p>
          <p className="text-xl font-bold text-orange-300 mt-1">{expensesToday.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="card">
          <p className="text-xs text-stone-500">Marge brute jour</p>
          <p className={`text-xl font-bold mt-1 ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {margin.toLocaleString('fr-FR')} F
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-stone-500 flex items-center gap-1"><Package size={12} /> Stocks bas</p>
          <p className={`text-xl font-bold mt-1 ${lowStock > 0 ? 'text-amber-400' : 'text-stone-200'}`}>{lowStock}</p>
          <Link to="/inventory" className="text-xs text-amber-400 hover:underline">Voir inventaire</Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold text-stone-100 mb-3 flex items-center gap-2">
            <Users size={18} /> Équipe active
          </h2>
          {managers.length === 0 ? (
            <p className="text-sm text-stone-500">Aucun membre. Créez des accès dans Mon équipe.</p>
          ) : (
            <ul className="space-y-2">
              {managers.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm border-b border-stone-800 pb-2">
                  <div>
                    <p className="text-stone-200 font-medium">{m.full_name || m.email}</p>
                    <p className="text-xs text-stone-500">{ROLE_LABELS[m.role] || m.role}</p>
                  </div>
                  <Link to="/chat" className="text-xs text-amber-400 hover:underline">Chat</Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/team" className="inline-block mt-3 text-sm text-primary-400 hover:underline">Gérer l’équipe →</Link>
        </div>

        <div className="card">
          <h2 className="font-semibold text-stone-100 mb-3 flex items-center gap-2">
            <ClipboardList size={18} /> Clôture du jour
          </h2>
          {reportToday ? (
            <div className="space-y-2 text-sm">
              <p className="text-emerald-400 font-medium">Clôture enregistrée</p>
              <p className="text-stone-400">Ventes: {Number(reportToday.total_sales || 0).toLocaleString('fr-FR')} F</p>
              <p className="text-stone-400">Dépenses: {Number(reportToday.total_expenses || 0).toLocaleString('fr-FR')} F</p>
              <p className="text-stone-400">Espèces: {Number(reportToday.cash || 0).toLocaleString('fr-FR')} F</p>
              {reportToday.notes && <p className="text-stone-500 text-xs">Notes: {reportToday.notes}</p>}
              <Link to="/daily-report" className="text-sm text-amber-400 hover:underline">Voir détail →</Link>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="text-amber-400 shrink-0" size={18} />
              <div>
                <p className="text-amber-200 font-medium">Pas encore de clôture aujourd’hui</p>
                <p className="text-stone-500 text-xs mt-1">Le gérant doit faire la clôture en fin de service.</p>
                <Link to="/daily-report" className="text-amber-400 hover:underline text-xs">Aller à la clôture →</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-stone-100 mb-3">Dernières ventes (aujourd’hui)</h2>
        {recentSales.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune vente enregistrée aujourd’hui.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-stone-500 text-left border-b border-stone-800">
                  <th className="py-2 pr-3">Heure</th>
                  <th className="py-2 pr-3">Qté</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.slice(0, 15).map((s) => (
                  <tr key={s.id} className="border-b border-stone-800/60">
                    <td className="py-2 pr-3 text-stone-400">
                      {new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 pr-3 text-stone-300">{s.qty}</td>
                    <td className="py-2 text-emerald-400 font-medium">{Number(s.total).toLocaleString('fr-FR')} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link to="/pos" className="inline-block mt-3 text-sm text-primary-400 hover:underline">Ouvrir la caisse →</Link>
      </div>
    </div>
  );
}
