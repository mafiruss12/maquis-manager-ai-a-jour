import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Brain, Target, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, Sale } from '@/lib/types';
import { formatFCFA, daysAgoISO, formatNumber } from '@/lib/format';
import { EmptyState } from '@/components/ui';

interface AIInsight {
  type: 'prediction' | 'alert' | 'recommendation' | 'opportunity';
  title: string;
  message: string;
  icon: typeof TrendingUp;
  color: string;
}

export default function AIAssistant() {
  const { member } = useAuth();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [predictedSales, setPredictedSales] = useState(0);
  const [topDay, setTopDay] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!member?.establishment_id) { setLoading(false); return; }
      const estId = member.establishment_id;
      const start = daysAgoISO(30);

      const [salesRes, productsRes] = await Promise.all([
        supabase.from('sales').select('total, qty, product_id, created_at').eq('establishment_id', estId).gte('created_at', start),
        supabase.from('products').select('*').eq('establishment_id', estId),
      ]);

      const sales = (salesRes.data ?? []) as Sale[];
      const products = (productsRes.data ?? []) as Product[];
      const newInsights: AIInsight[] = [];

      // --- Prédiction des ventes ---
      const dailyMap: Record<string, number> = {};
      for (const s of sales) {
        const d = s.created_at.split('T')[0];
        dailyMap[d] = (dailyMap[d] ?? 0) + Number(s.total);
      }
      const dailyValues = Object.values(dailyMap);
      const avg7 = dailyValues.slice(-7).reduce((a, b) => a + b, 0) / Math.max(1, dailyValues.slice(-7).length);
      const avg30 = dailyValues.reduce((a, b) => a + b, 0) / Math.max(1, dailyValues.length);
      const trend = avg7 > avg30 * 1.1 ? 'hausse' : avg7 < avg30 * 0.9 ? 'baisse' : 'stable';
      const prediction = Math.round(avg7 * 1.05);
      setPredictedSales(prediction);

      newInsights.push({
        type: 'prediction',
        title: 'Prédiction des ventes de demain',
        message: `Basé sur la tendance des 7 derniers jours, vos ventes devraient atteindre environ ${formatFCFA(prediction)}. La tendance est ${trend}.`,
        icon: TrendingUp,
        color: 'success',
      });

      // --- Jour de la semaine le plus rentable ---
      const dayMap: Record<string, number> = {};
      for (const s of sales) {
        const day = new Date(s.created_at).toLocaleDateString('fr-FR', { weekday: 'long' });
        dayMap[day] = (dayMap[day] ?? 0) + Number(s.total);
      }
      const sortedDays = Object.entries(dayMap).sort((a, b) => b[1] - a[1]);
      if (sortedDays.length > 0) {
        setTopDay(sortedDays[0][0]);
        newInsights.push({
          type: 'opportunity',
          title: 'Jour le plus rentable',
          message: `${sortedDays[0][0]} est votre meilleur jour avec ${formatFCFA(sortedDays[0][1])} de ventes en moyenne. Préparez plus de stock et planifiez vos meilleurs employés ce jour-là.`,
          icon: Target,
          color: 'primary',
        });
      }

      // --- Alertes de stock ---
      const lowStock = products.filter((p) => Number(p.stock) <= Number(p.min_stock));
      if (lowStock.length > 0) {
        newInsights.push({
          type: 'alert',
          title: `${lowStock.length} produit(s) en rupture imminente`,
          message: `${lowStock.slice(0, 3).map((p) => p.name).join(', ')}${lowStock.length > 3 ? '...' : ''} ont atteint leur seuil minimum. Réapprovisionnez rapidement pour éviter les ruptures.`,
          icon: AlertTriangle,
          color: 'warning',
        });
      }

      // --- Marge bénéficiaire ---
      const prodMargins = products.map((p) => ({ name: p.name, margin: p.price - p.cost, marginPct: p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0 }));
      const lowMargin = prodMargins.filter((m) => m.marginPct < 30 && m.marginPct > 0);
      if (lowMargin.length > 0) {
        newInsights.push({
          type: 'recommendation',
          title: 'Marges bénéficiaires faibles',
          message: `${lowMargin.length} produit(s) ont une marge inférieure à 30%. Envisagez d'augmenter les prix ou de négocier avec vos fournisseurs. Exemple: ${lowMargin[0].name} (${lowMargin[0].marginPct.toFixed(0)}% de marge).`,
          icon: Lightbulb,
          color: 'warning',
        });
      }

      // --- Produits invendus ---
      const soldProductIds = new Set(sales.map((s) => s.product_id));
      const unsold = products.filter((p) => !soldProductIds.has(p.id) && p.stock > 0);
      if (unsold.length > 0) {
        newInsights.push({
          type: 'recommendation',
          title: 'Produits sans vente ce mois',
          message: `${unsold.length} produit(s) n'ont eu aucune vente en 30 jours: ${unsold.slice(0, 3).map((p) => p.name).join(', ')}${unsold.length > 3 ? '...' : ''}. Considérez une promotion ou de les retirer du menu.`,
          icon: Zap,
          color: 'error',
        });
      }

      // --- Meilleur produit ---
      const prodRevenue: Record<string, number> = {};
      for (const s of sales) {
        prodRevenue[s.product_id ?? ''] = (prodRevenue[s.product_id ?? ''] ?? 0) + Number(s.total);
      }
      const sortedProds = Object.entries(prodRevenue).sort((a, b) => b[1] - a[1]);
      if (sortedProds.length > 0) {
        const bestProd = products.find((p) => p.id === sortedProds[0][0]);
        if (bestProd) {
          newInsights.push({
            type: 'opportunity',
            title: 'Produit star',
            message: `"${bestProd.name}" génère ${formatFCFA(sortedProds[0][1])} de revenus. Assurez-vous d'avoir toujours un stock suffisant et mettez-le en avant sur votre menu.`,
            icon: Brain,
            color: 'primary',
          });
        }
      }

      setInsights(newInsights);
      setLoading(false);
    })();
  }, [member]);

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400"><Sparkles className="animate-pulse text-primary-500" size={24} /></div>;
  if (!member?.establishment_id) return <EmptyState icon={<Sparkles size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  const colorMap: Record<string, string> = {
    success: 'bg-success-500/10 text-success-400 border-success-500/20',
    warning: 'bg-warning-500/10 text-warning-400 border-warning-500/20',
    error: 'bg-error-500/10 text-error-400 border-error-500/20',
    primary: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="text-primary-400" />
        <h1 className="text-2xl font-bold font-display text-stone-100">Assistant IA</h1>
      </div>
      <p className="text-stone-400 text-sm mb-6">Analyses et recommandations automatiques basées sur vos données</p>

      {/* Carte de prédiction principale */}
      <div className="card mb-6 bg-gradient-to-br from-primary-500/10 to-secondary-500/5 border-primary-500/20">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-primary-500/15">
            <Brain size={32} className="text-primary-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-stone-400">Ventes prédites pour demain</p>
            <p className="text-3xl font-bold font-display text-stone-100">{formatFCFA(predictedSales)}</p>
          </div>
          {topDay && (
            <div className="text-right">
              <p className="text-sm text-stone-400">Meilleur jour</p>
              <p className="text-xl font-bold text-primary-400 capitalize">{topDay}</p>
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {insights.map((ins, i) => {
          const Icon = ins.icon;
          return (
            <div key={i} className={`card border ${colorMap[ins.color]}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${colorMap[ins.color]}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-stone-100 mb-1">{ins.title}</p>
                  <p className="text-sm text-stone-400">{ins.message}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {insights.length === 0 && (
        <EmptyState icon={<Sparkles size={48} />} title="Pas assez de données" message="L'IA a besoin d'au moins quelques jours de ventes pour générer des analyses." />
      )}
    </div>
  );
}
