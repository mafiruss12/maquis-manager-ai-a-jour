import { useEffect, useState } from 'react';
import { Settings, Building2, User, Save, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Establishment } from '@/lib/types';

export default function SettingsPage() {
  const { member } = useAuth();
  const [est, setEst] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'maquis', address: '', phone: '' });

  useEffect(() => {
    (async () => {
      if (!member?.establishment_id) { setLoading(false); return; }
      const { data } = await supabase.from('establishments').select('*').eq('id', member.establishment_id).maybeSingle();
      if (data) {
        setEst(data as Establishment);
        setForm({ name: data.name, type: data.type, address: data.address ?? '', phone: data.phone ?? '' });
      }
      setLoading(false);
    })();
  }, [member]);

  async function save() {
    if (!est) return;
    setSaving(true);
    await supabase.from('establishments').update({
      name: form.name,
      type: form.type,
      address: form.address || null,
      phone: form.phone || null,
    }).eq('id', est.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-2">Paramètres</h1>
      <p className="text-stone-400 text-sm mb-6">Configurez votre établissement</p>

      <div className="max-w-lg space-y-6">
        {/* Profil */}
        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2"><User size={20} className="text-primary-400" /> Mon profil</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-stone-400">Nom</span><span className="text-stone-200">{member?.full_name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-stone-400">Email</span><span className="text-stone-200">{member?.email}</span></div>
            <div className="flex justify-between"><span className="text-stone-400">Rôle</span><span className="text-stone-200 capitalize">{member?.role.replace('_', ' ')}</span></div>
          </div>
        </div>

        {/* Établissement */}
        {est ? (
          <div className="card">
            <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2"><Building2 size={20} className="text-secondary-400" /> Établissement</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Nom</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-field">
                  <option value="maquis">Maquis</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="bar">Bar</option>
                  <option value="cave">Cave</option>
                  <option value="hotel">Hôtel</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="label">Adresse</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
              </div>
              <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                {saved ? <><CheckCircle2 size={18} /> Enregistré !</> : saving ? 'Enregistrement...' : <><Save size={18} /> Enregistrer</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="card">
            <p className="text-stone-400 text-sm">Aucun établissement rattaché. Contactez le Super Administrateur.</p>
          </div>
        )}
      </div>
    </div>
  );
}
