import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import AuthPage from '@/pages/AuthPage';
import PendingAccessPage from '@/pages/PendingAccessPage';
import Dashboard from '@/pages/Dashboard';
import Caisse from '@/pages/Caisse';
import Inventaire from '@/pages/Inventaire';
import DailyReportPage from '@/pages/DailyReport';
import SuperAdmin from '@/pages/SuperAdmin';
import Employees from '@/pages/Employees';
import Expenses from '@/pages/Expenses';
import Suppliers from '@/pages/Suppliers';
import Purchases from '@/pages/Purchases';
import Customers from '@/pages/Customers';
import Tables from '@/pages/Tables';
import Orders from '@/pages/Orders';
import Kitchen from '@/pages/Kitchen';
import Accounting from '@/pages/Accounting';
import Statistics from '@/pages/Statistics';
import Reports from '@/pages/Reports';
import Notifications from '@/pages/Notifications';
import SettingsPage from '@/pages/Settings';
import AIAssistant from '@/pages/AIAssistant';
import CalendarPage from '@/pages/CalendarPage';
import AppLayout from '@/components/AppLayout';
import { Loader2 } from 'lucide-react';

function ProtectedRoutes() {
  const { user, member, loading, needsAccess } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  if (!user) return <AuthPage />;
  // Plus de blocage d'accès : loadMemberData crée automatiquement le membre
  if (needsAccess) return <PendingAccessPage />;
  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pos" element={<Caisse />} />
        <Route path="/caisse" element={<Navigate to="/pos" replace />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/inventory" element={<Inventaire />} />
        <Route path="/inventaire" element={<Navigate to="/inventory" replace />} />
        <Route path="/tables" element={<Tables />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/accounting" element={<Accounting />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/daily-report" element={<DailyReportPage />} />
        <Route path="/cloture" element={<Navigate to="/daily-report" replace />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<SuperAdmin />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
