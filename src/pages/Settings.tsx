import { useEffect, useState } from 'react';
import { Building2, User, Save, CheckCircle2, Camera, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Establishment } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';

export default function SettingsPage() {
  const { member, refresh } = useAuth();
  const [est, setEst] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', avatar_url: '' });
  const [form, setForm] = useState({ name: '', type: 'maquis', address: '', phone: '', logo_url: '' });
  const [error, setError] = useState<string | null>(null);

  const canManageEst = member && ['super_admin', 'admin', 'owner', 'manager'].includes(member.role);

  useEffect(() => {
    (async () => {
      if (member) {
        setProfileForm({
          full_name: member.full_name ?? '',
          avatar_url: (member as any).avatar_url ?? '',
        });
      }
      if (!member?.establishment_id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('establishments')
        .select('*')
        .eq('id', member.establishment_id)
        .maybeSingle();
      if (data) {
        setEst(data as Establishment);
        setForm({
          name: data.name,
          type: data.type,
          address: data.address ?? '',
          phone: data.phone ?? '',
          logo_url: (data as any).logo_url ?? '',
        });
      }
      setLoading(false);
    })();
  }, [member]);

  async function saveProfile() {
    if (!member) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('members')
      .update({
        full_name: profileForm.full_name || null,
        avatar_url: profileForm.avatar_url || null,
      } as any)
      .eq('id', member.id);
    if (err) setError(err.message);
    else {
      setSaved(true);
      await refresh();
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  async function saveEstablishment() {
    if (!member) return;
    setSaving(true);
    setError(null);

    if (est) {
      const { error: err } = await supabase
        .from('establishments')
        .update({
          name: form.name,
          type: form.type,
          address: form.address || null,
          phone: form.phone || null,
          logo_url: form.logo_url || null,
        } as any)
        .eq('id', est.id);
      if (err) setError(err.message);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        await refresh();
      }
    } else if (canManageEst) {
      // Créer l'établissement et rattacher le membre
      const { data: newEst, error: err } = await supabase
        .from('establishments')
        .insert({
          name: form.name || 'Mon établissement',
          type: form.type,
          address: form.address || null,
          phone: form.phone || null,
          logo_url: form.logo_url || null,
          created_by: member.user_id,
        } as any)
        .select()
        .single();

      if (err || !newEst) {
        setError(err?.message ?? 'Erreur création établissement');
      } else {
        await supabase
          .from('members')
          .update({ establishment_id: newEst.id })
          .eq('id', member.id);
        setEst(newEst as Establishment);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        await refresh();
      }
    }
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-2">Profil & Paramètres</h1>
      <p className="text-stone-400 text-sm mb-6">Personnalisez votre compte et votre établissement</p>

      {error && (
        <div className="mb-4 bg-error-500/10 border border-error-500/30 rounded-xl p-3 text-sm text-error-300">
          {error}
        </div>
      )}

      <div className="max-w-lg space-y-6">
        {/* Profil */}
        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2">
            <User size={20} className="text-primary-400" /> Mon profil
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-stone-700 flex items-center justify-center overflow-hidden shrink-0">
              {profileForm.avatar_url ? (
                <img src={profileForm.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={28} className="text-stone-400" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <label className="label flex items-center gap-1"><Camera size={14} /> Photo (URL)</label>
              <input
                value={profileForm.avatar_url}
                onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })}
                placeholder="https://..."
                className="input-field"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">Nom complet</label>
              <input
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Email</span>
              <span className="text-stone-200">{member?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Rôle</span>
              <span className="text-stone-200">{member?.role ? ROLE_LABELS[member.role] : '—'}</span>
            </div>
            <button onClick={saveProfile} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              {saved ? <><CheckCircle2 size={18} /> Enregistré !</> : <><Save size={18} /> Enregistrer le profil</>}
            </button>
          </div>
        </div>

        {/* Établissement */}
        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2">
            <Building2 size={20} className="text-secondary-400" />
            {est ? 'Mon établissement' : 'Créer mon établissement'}
          </h2>

          {!est && !canManageEst && (
            <p className="text-stone-400 text-sm">Aucun établissement rattaché. Contactez votre administrateur ou propriétaire.</p>
          )}

          {(est || canManageEst) && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-16 h-16 rounded-xl bg-stone-700 flex items-center justify-center overflow-hidden shrink-0">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 size={28} className="text-stone-400" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="label flex items-center gap-1"><Camera size={14} /> Logo / Photo (URL)</label>
                  <input
                    value={form.logo_url}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    placeholder="https://..."
                    className="input-field"
                    disabled={!canManageEst}
                  />
                </div>
              </div>
              <div>
                <label className="label">Nom du maquis / bar / restaurant</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Maquis Chez Koffi"
                  className="input-field"
                  disabled={!canManageEst && !!est}
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="input-field"
                  disabled={!canManageEst && !!est}
                >
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
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="input-field"
                  disabled={!canManageEst && !!est}
                />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input-field"
                  disabled={!canManageEst && !!est}
                />
              </div>
              {canManageEst && (
                <button onClick={saveEstablishment} disabled={saving || !form.name} className="btn-primary w-full flex items-center justify-center gap-2">
                  {saved ? (
                    <><CheckCircle2 size={18} /> Enregistré !</>
                  ) : est ? (
                    <><Save size={18} /> Enregistrer l'établissement</>
                  ) : (
                    <><Plus size={18} /> Créer mon établissement</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
