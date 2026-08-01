import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, Package, Users, AlertTriangle, ArrowUpRight, ArrowDownRight, Receipt, Calendar, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA, formatTime, todayISO } from '@/lib/format';
import { StatCard, EmptyState } from '@/components/ui';
import type { Sale, Order } from '@/lib/types';

interface DashboardData {
  todaySales: number;
  todayExpenses: number;
  todayProfit: number;
  lowStockCount: number;
  employeeCount: number;
  activeOrders: number;
  weeklyData: { day: string; sales: number }[];
  recentSales: Sale[];
  activeOrdersList: Order[];
}

export default function Dashboard() {
  const { member } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!member?.establishment_id) { setLoading(false); return; }
      const estId = member.establishment_id;
      const today = todayISO();

      const [salesRes, expensesRes, productsRes, employeesRes, ordersRes, recentRes] = await Promise.all([
        supabase.from('sales').select('total, created_at').eq('establishment_id', estId).gte('created_at', today),
        supabase.from('expenses').select('amount').eq('establishment_id', estId).gte('created_at', today),
        supabase.from('products').select('stock, min_stock, name').eq('establishment_id', estId),
        supabase.from('employees').select('id').eq('establishment_id', estId).eq('status', 'active'),
        supabase.from('orders').select('*').eq('establishment_id', estId).in('status', ['pending', 'preparing', 'ready']),
        supabase.from('sales').select('*').eq('establishment_id', estId).order('created_at', { ascending: false }).limit(5),
      ]);

      const todaySales = (salesRes.data ?? []).reduce((sum, s) => sum + Number(s.total), 0);
      const todayExpenses = (expensesRes.data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
      const lowStock = (productsRes.data ?? []).filter((p) => Number(p.stock) <= Number(p.min_stock)).length;

      const weeklyData: { day: string; sales: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStr = date.toISOString().split('T')[0];
        const dayLabel = date.toLocaleDateString('fr-FR', { weekday: 'short' });
        const daySales = (salesRes.data ?? []).filter((s) => s.created_at.startsWith(dayStr)).reduce((sum, s) => sum + Number(s.total), 0);
        weeklyData.push({ day: dayLabel, sales: daySales });
      }

      setData({
        todaySales,
        todayExpenses,
        todayProfit: todaySales - todayExpenses,
        lowStockCount: lowStock,
        employeeCount: employeesRes.data?.length ?? 0,
        activeOrders: ordersRes.data?.length ?? 0,
        weeklyData,
        recentSales: (recentRes.data ?? []) as Sale[],
        activeOrdersList: (ordersRes.data ?? []) as Order[],
      });
      setLoading(false);
    })();
  }, [member]);

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;

  if (!member?.establishment_id && member?.role !== 'super_admin') {
    return <EmptyState icon={<Users size={48} />} title="Aucun établissement rattaché" message="Contactez le Super Administrateur pour qu'il vous rattache à un établissement." />;
  }

  if (member?.role === 'super_admin' && !member?.establishment_id) {
    return (
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-100 mb-2">Tableau de bord</h1>
        <p className="text-stone-400 mb-6">Vue d'ensemble du Super Administrateur</p>
        <EmptyState icon={<TrendingUp size={48} />} title="Bienvenue, Super Administrateur" message="Utilisez le panneau Administration pour créer des établissements et gérer les utilisateurs." />
      </div>
    );
  }

  if (!data) return null;
  const maxSales = Math.max(...data.weeklyData.map((d) => d.sales), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-2">Tableau de bord</h1>
      <p className="text-stone-400 text-sm mb-6 capitalize">
        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Ventes du jour" value={formatFCFA(data.todaySales)} icon={<DollarSign size={24} />} accent="success" />
        <StatCard label="Dépenses du jour" value={formatFCFA(data.todayExpenses)} icon={<ArrowDownRight size={24} />} accent="error" />
        <StatCard label="Bénéfice du jour" value={formatFCFA(data.todayProfit)} icon={<ArrowUpRight size={24} />} accent="primary" />
        <StatCard label="Commandes actives" value={String(data.activeOrders)} icon={<Receipt size={24} />} accent="secondary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-primary-400" />
              <h2 className="text-lg font-semibold text-stone-100">Revenus des 7 derniers jours</h2>
            </div>
            <Link to="/statistics" className="text-sm text-primary-400 hover:text-primary-300">Voir stats →</Link>
          </div>
          <div className="flex items-end justify-between gap-2 h-48">
            {data.weeklyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-primary-600 to-primary-400 rounded-t-lg transition-all hover:from-primary-500 hover:to-primary-300 min-h-[4px] relative group"
                    style={{ height: `${(d.sales / maxSales) * 100}%` }}
                  >
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatFCFA(d.sales)}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-stone-500 capitalize">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Raccourcis */}
        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4">Accès rapide</h2>
          <div className="space-y-2">
            <Link to="/pos" className="flex items-center gap-3 p-3 rounded-xl bg-stone-800/50 hover:bg-stone-800 transition-all group">
              <DollarSign size={20} className="text-success-400" />
              <span className="flex-1 text-stone-200">Ouvrir la caisse</span>
              <ArrowUpRight size={16} className="text-stone-500 group-hover:text-primary-400" />
            </Link>
            <Link to="/orders" className="flex items-center gap-3 p-3 rounded-xl bg-stone-800/50 hover:bg-stone-800 transition-all group">
              <Receipt size={20} className="text-primary-400" />
              <span className="flex-1 text-stone-200">Nouvelle commande</span>
              <ArrowUpRight size={16} className="text-stone-500 group-hover:text-primary-400" />
            </Link>
            <Link to="/ai" className="flex items-center gap-3 p-3 rounded-xl bg-stone-800/50 hover:bg-stone-800 transition-all group">
              <Sparkles size={20} className="text-secondary-400" />
              <span className="flex-1 text-stone-200">Assistant IA</span>
              <ArrowUpRight size={16} className="text-stone-500 group-hover:text-primary-400" />
            </Link>
            <Link to="/daily-report" className="flex items-center gap-3 p-3 rounded-xl bg-stone-800/50 hover:bg-stone-800 transition-all group">
              <Calendar size={20} className="text-warning-400" />
              <span className="flex-1 text-stone-200">Clôture du jour</span>
              <ArrowUpRight size={16} className="text-stone-500 group-hover:text-primary-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Alerte stock + Commandes actives */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {data.lowStockCount > 0 && (
          <div className="card border-warning-500/30 bg-warning-500/5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning-500/10">
              <AlertTriangle size={24} className="text-warning-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-warning-300">Alerte de stock</p>
              <p className="text-sm text-stone-400">
                {data.lowStockCount} produit{data.lowStockCount > 1 ? 's' : ''} en stock faible.
              </p>
            </div>
            <Link to="/inventory" className="btn-ghost text-sm">Voir →</Link>
          </div>
        )}

        {data.activeOrdersList.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-stone-100 mb-3">Commandes en cours</h2>
            <div className="space-y-2">
              {data.activeOrdersList.slice(0, 3).map((o) => (
                <div key={o.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-stone-200">{o.table_number ?? 'À emporter'}</span>
                  <span className="text-stone-400">·</span>
                  <span className="text-stone-400 capitalize">{o.status}</span>
                  <span className="ml-auto text-primary-400 font-medium">{formatFCFA(o.total)}</span>
                </div>
              ))}
            </div>
            <Link to="/orders" className="block mt-3 text-sm text-primary-400 hover:text-primary-300">Toutes les commandes →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
