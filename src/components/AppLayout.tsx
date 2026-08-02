import { type ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardCheck, Users, Building2,
  Beer, LogOut, Menu, X, UserCog, Calculator, BarChart3, Truck, UserCircle,
  Calendar, UtensilsCrossed, Bell, Settings, Sparkles, Receipt, Wallet, MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useEffect, useState as useReactState } from 'react';

interface NavSection {
  label: string;
  items: { to: string; label: string; icon: ReactNode; roles: Role[] }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={20} />, roles: ['super_admin', 'admin', 'manager', 'cashier', 'employee'] },
      { to: '/pos', label: 'Caisse (POS)', icon: <ShoppingCart size={20} />, roles: ['super_admin', 'admin', 'manager', 'cashier'] },
      { to: '/orders', label: 'Commandes', icon: <Receipt size={20} />, roles: ['super_admin', 'admin', 'manager', 'cashier', 'employee'] },
      { to: '/kitchen', label: 'Cuisine / Bar', icon: <UtensilsCrossed size={20} />, roles: ['super_admin', 'admin', 'manager', 'employee'] },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { to: '/inventory', label: 'Inventaire', icon: <Package size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/tables', label: 'Tables', icon: <LayoutDashboard size={20} />, roles: ['super_admin', 'admin', 'manager', 'cashier'] },
      { to: '/employees', label: 'Employés', icon: <Users size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/calendar', label: 'Planning', icon: <Calendar size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/customers', label: 'Clients', icon: <UserCircle size={20} />, roles: ['super_admin', 'admin', 'manager', 'cashier'] },
    ],
  },
  {
    label: 'Finances',
    items: [
      { to: '/expenses', label: 'Dépenses', icon: <Wallet size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/suppliers', label: 'Fournisseurs', icon: <Truck size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/purchases', label: 'Achats', icon: <ShoppingCart size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/accounting', label: 'Comptabilité', icon: <Calculator size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/statistics', label: 'Statistiques', icon: <BarChart3 size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/reports', label: 'Rapports', icon: <ClipboardCheck size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/daily-report', label: 'Clôture du jour', icon: <ClipboardCheck size={20} />, roles: ['super_admin', 'admin', 'manager'] },
    ],
  },
  {
    label: 'Outils',
    items: [
      { to: '/ai', label: 'Assistant IA', icon: <Sparkles size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/chat', label: 'Chat interne', icon: <MessageCircle size={20} />, roles: ['super_admin', 'admin', 'manager'] },
      { to: '/notifications', label: 'Notifications', icon: <Bell size={20} />, roles: ['super_admin', 'admin', 'manager', 'cashier', 'employee'] },
      { to: '/settings', label: 'Profil & Paramètres', icon: <Settings size={20} />, roles: ['super_admin', 'admin', 'manager', 'cashier', 'employee'] },
      { to: '/admin', label: 'Administration', icon: <UserCog size={20} />, roles: ['super_admin'] },
    ],
  },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { member, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useReactState(0);
  const [estName, setEstName] = useReactState<string | null>(null);
  const [estLogo, setEstLogo] = useReactState<string | null>(null);

  useEffect(() => {
    if (!member?.user_id) return;
    (async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', member.user_id)
        .eq('read', false);
      setUnreadNotifs(count ?? 0);

      if (member.establishment_id) {
        const { data } = await supabase
          .from('establishments')
          .select('name, logo_url')
          .eq('id', member.establishment_id)
          .maybeSingle();
        if (data) {
          setEstName(data.name);
          setEstLogo((data as any).logo_url ?? null);
        }
      } else {
        setEstName(null);
        setEstLogo(null);
      }
    })();
  }, [member]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => member && item.roles.includes(member.role)),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-stone-950 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-stone-900 border-r border-stone-800 flex flex-col z-40 transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-800 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0 overflow-hidden">
            {estLogo ? (
              <img src={estLogo} alt="" className="w-full h-full object-cover" />
            ) : (
              <Beer size={20} className="text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold font-display text-stone-100 text-sm truncate">
              {estName || 'Maquis Manager'}
            </p>
            <p className="text-xs text-stone-500 truncate">{member ? ROLE_LABELS[member.role] : ''}</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {visibleSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary-500/15 text-primary-300'
                          : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                      }`
                    }
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/notifications' && unreadNotifs > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-error-500 text-white">
                        {unreadNotifs}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-stone-800 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
              <Users size={16} className="text-stone-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-200 truncate">{member?.full_name ?? member?.email}</p>
              <p className="text-xs text-stone-500 truncate">{member?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:text-error-300 hover:bg-error-500/10 transition-all"
          >
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-stone-900 border-b border-stone-800 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="text-stone-300">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            {estLogo ? (
              <img src={estLogo} alt="" className="w-6 h-6 rounded object-cover" />
            ) : (
              <Beer size={20} className="text-primary-500" />
            )}
            <span className="font-display font-bold text-stone-100">{estName || 'Maquis Manager'}</span>
          </div>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>

      {sidebarOpen && (
        <button onClick={() => setSidebarOpen(false)} className="fixed top-4 right-4 z-50 text-stone-300 lg:hidden">
          <X size={24} />
        </button>
      )}
    </div>
  );
}
