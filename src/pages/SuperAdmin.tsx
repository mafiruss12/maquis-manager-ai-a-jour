import { useEffect, useState } from 'react';
import {
  UserCog, Building2, Users, Plus, Check, X, Loader2, Ban, KeyRound, Trash2, Clock, Mail,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Member, Establishment, AccessRequest, Role } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { Modal, Badge, EmptyState } from '@/components/ui';

type Tab = 'requests' | 'members' | 'establishments';

export default function SuperAdmin() {
  const { member } = useAuth();
  const [tab, setTab] = useState<Tab>('requests');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals
  const [approveModal, setApproveModal] = useState<AccessRequest | null>(null);
  const [estModal, setEstModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);

  // Forms
  const [estForm, setEstForm] = useState({ name: '', type: 'maquis', address: '', phone: '' });
  const [approveForm, setApproveForm] = useState<{ role: Role; establishmentId: string }>({ role: 'employee', establishmentId: '' });

  async function loadData() {
    const [reqRes, memRes, estRes] = await Promise.all([
      supabase.from('access_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('members').select('*').order('created_at', { ascending: false }),
      supabase.from('establishments').select('*').order('created_at', { ascending: false }),
    ]);
    setRequests((reqRes.data ?? []) as AccessRequest[]);
    setMembers((memRes.data ?? []) as Member[]);
    setEstablishments((estRes.data ?? []) as Establishment[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function approveRequest(req: AccessRequest) {
    if (!req.user_id || !approveForm.establishmentId) return;
    setActionLoading(req.id);
    try {
      await supabase.from('members').insert({
        user_id: req.user_id,
        email: req.email,
        full_name: req.full_name,
        role: approveForm.role,
        establishment_id: approveForm.establishmentId,
        status: 'active',
      });
      await supabase.from('access_requests').update({ status: 'approved' }).eq('id', req.id);
      setApproveModal(null);
      setApproveForm({ role: 'employee', establishmentId: '' });
      await loadData();
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectRequest(req: AccessRequest) {
    if (!confirm(`Refuser la demande de ${req.email} ?`)) return;
    setActionLoading(req.id);
    try {
      await supabase.from('access_requests').update({ status: 'rejected' }).eq('id', req.id);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleSuspend(m: Member) {
    const newStatus = m.status === 'active' ? 'suspended' : 'active';
    await supabase.from('members').update({ status: newStatus }).eq('id', m.id);
    await loadData();
  }

  async function deleteMember(m: Member) {
    if (!confirm(`Supprimer le compte de ${m.email} ?`)) return;
    await supabase.from('members').delete().eq('id', m.id);
    await loadData();
  }

  async function createEstablishment() {
    if (!estForm.name || !member) return;
    await supabase.from('establishments').insert({
      name: estForm.name,
      type: estForm.type,
      address: estForm.address,
      phone: estForm.phone,
      created_by: member.user_id,
    });
    setEstModal(false);
    setEstForm({ name: '', type: 'maquis', address: '', phone: '' });
    await loadData();
  }

  if (member?.role !== 'super_admin') {
    return <EmptyState icon={<UserCog size={48} />} title="Accès refusé" message="Cette section est réservée au Super Administrateur." />;
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;

  const pendingCount = requests.length;

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-2">Administration</h1>
      <p className="text-stone-400 text-sm mb-6">Gérez les accès, établissements et utilisateurs</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
            tab === 'requests' ? 'bg-primary-500/15 text-primary-300' : 'text-stone-400 hover:bg-stone-800'
          }`}
        >
          <Clock size={16} /> Demandes {pendingCount > 0 && <Badge color="warning">{pendingCount}</Badge>}
        </button>
        <button
          onClick={() => setTab('members')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
            tab === 'members' ? 'bg-primary-500/15 text-primary-300' : 'text-stone-400 hover:bg-stone-800'
          }`}
        >
          <Users size={16} /> Membres
        </button>
        <button
          onClick={() => setTab('establishments')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
            tab === 'establishments' ? 'bg-primary-500/15 text-primary-300' : 'text-stone-400 hover:bg-stone-800'
          }`}
        >
          <Building2 size={16} /> Établissements
        </button>
      </div>

      {/* Tab: Requests */}
      {tab === 'requests' && (
        <div>
          {pendingCount > 0 && (
            <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4 mb-4">
              <p className="text-sm text-warning-300 font-medium">
                {pendingCount} demande{pendingCount > 1 ? 's' : ''} d'accès en attente de validation
              </p>
            </div>
          )}
          {requests.length === 0 ? (
            <EmptyState icon={<Check size={48} />} title="Aucune demande en attente" message="Toutes les demandes ont été traitées." />
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="card flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-warning-500/10">
                    <Clock size={20} className="text-warning-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-100">{req.full_name ?? 'Sans nom'}</p>
                    <p className="text-sm text-stone-400 flex items-center gap-2">
                      <Mail size={12} /> {req.email}
                      <Badge color="neutral">{req.auth_provider === 'google' ? 'Google' : 'Email'}</Badge>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setApproveForm({ role: 'employee', establishmentId: '' });
                        setApproveModal(req);
                      }}
                      className="btn-primary px-3 py-2 flex items-center gap-1"
                    >
                      <Check size={16} /> Approuver
                    </button>
                    <button
                      onClick={() => rejectRequest(req)}
                      disabled={actionLoading === req.id}
                      className="btn-danger px-3 py-2 flex items-center gap-1"
                    >
                      <X size={16} /> Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Members */}
      {tab === 'members' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setMemberModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Créer un accès
            </button>
          </div>
          {members.length === 0 ? (
            <EmptyState icon={<Users size={48} />} title="Aucun membre" message="Créez le premier accès." />
          ) : (
            <div className="space-y-2">
              {members.map((m) => {
                const est = establishments.find((e) => e.id === m.establishment_id);
                return (
                  <div key={m.id} className="card flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-stone-800">
                      <Users size={20} className="text-stone-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-stone-100 truncate">{m.full_name ?? m.email}</p>
                        <Badge color={m.status === 'active' ? 'success' : 'error'}>
                          {m.status === 'active' ? 'Actif' : 'Suspendu'}
                        </Badge>
                      </div>
                      <p className="text-sm text-stone-400">
                        {m.email} · {ROLE_LABELS[m.role]} · {est?.name ?? 'Aucun établissement'}
                      </p>
                    </div>
                    {m.role !== 'super_admin' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleSuspend(m)}
                          className="p-2 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-warning-400"
                          title={m.status === 'active' ? 'Suspendre' : 'Réactiver'}
                        >
                          <Ban size={18} />
                        </button>
                        <button
                          onClick={() => deleteMember(m)}
                          className="p-2 rounded-lg hover:bg-error-500/10 text-stone-400 hover:text-error-400"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Establishments */}
      {tab === 'establishments' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setEstModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Créer un établissement
            </button>
          </div>
          {establishments.length === 0 ? (
            <EmptyState icon={<Building2 size={48} />} title="Aucun établissement" message="Créez votre premier établissement." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {establishments.map((est) => {
                const memberCount = members.filter((m) => m.establishment_id === est.id).length;
                return (
                  <div key={est.id} className="card">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-secondary-500/10">
                        <Building2 size={20} className="text-secondary-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-stone-100">{est.name}</p>
                        <p className="text-sm text-stone-400">{est.type}</p>
                        {est.address && <p className="text-xs text-stone-500 mt-1">{est.address}</p>}
                        {est.phone && <p className="text-xs text-stone-500">{est.phone}</p>}
                        <p className="text-xs text-stone-500 mt-2">{memberCount} membre{memberCount > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Approve request */}
      <Modal open={!!approveModal} onClose={() => setApproveModal(null)} title="Approuver la demande">
        {approveModal && (
          <div className="space-y-4">
            <div className="bg-stone-800/50 rounded-xl p-3">
              <p className="text-sm text-stone-400">{approveModal.full_name ?? 'Sans nom'}</p>
              <p className="text-stone-200">{approveModal.email}</p>
            </div>
            <div>
              <label className="label">Rôle</label>
              <select
                value={approveForm.role}
                onChange={(e) => setApproveForm({ ...approveForm, role: e.target.value as Role })}
                className="input-field"
              >
                {(Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== 'super_admin').map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Établissement</label>
              <select
                value={approveForm.establishmentId}
                onChange={(e) => setApproveForm({ ...approveForm, establishmentId: e.target.value })}
                className="input-field"
              >
                <option value="">— Choisir —</option>
                {establishments.map((est) => (
                  <option key={est.id} value={est.id}>{est.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => approveRequest(approveModal)}
              disabled={actionLoading === approveModal.id || !approveForm.establishmentId}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {actionLoading === approveModal.id ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Confirmer l'accès
            </button>
          </div>
        )}
      </Modal>

      {/* Modal: Create establishment */}
      <Modal open={estModal} onClose={() => setEstModal(false)} title="Nouvel établissement">
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input value={estForm.name} onChange={(e) => setEstForm({ ...estForm, name: e.target.value })} className="input-field" placeholder="Maquis Le Comptoir" />
          </div>
          <div>
            <label className="label">Type</label>
            <select value={estForm.type} onChange={(e) => setEstForm({ ...estForm, type: e.target.value })} className="input-field">
              <option value="maquis">Maquis</option>
              <option value="restaurant">Restaurant</option>
              <option value="bar">Bar</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="label">Adresse</label>
            <input value={estForm.address} onChange={(e) => setEstForm({ ...estForm, address: e.target.value })} className="input-field" placeholder="Cocody, Abidjan" />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input value={estForm.phone} onChange={(e) => setEstForm({ ...estForm, phone: e.target.value })} className="input-field" placeholder="+225 ..." />
          </div>
          <button onClick={createEstablishment} className="btn-primary w-full">Créer</button>
        </div>
      </Modal>

      {/* Modal: Create member (direct access) */}
      <Modal open={memberModal} onClose={() => setMemberModal(false)} title="Créer un accès direct">
        <DirectAccessForm establishments={establishments} onDone={() => { setMemberModal(false); loadData(); }} />
      </Modal>
    </div>
  );
}

function DirectAccessForm({ establishments, onDone }: { establishments: Establishment[]; onDone: () => void }) {
  const { member } = useAuth();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('employee');
  const [estId, setEstId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email || !password || !estId || !member) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      if (data.user) {
        const { error: insertError } = await supabase.from('members').insert({
          user_id: data.user.id,
          email,
          full_name: fullName,
          role,
          establishment_id: estId,
          status: 'active',
        });
        if (insertError) {
          setError(insertError.message);
          setLoading(false);
          return;
        }
      }
      onDone();
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="bg-error-500/10 border border-error-500/30 rounded-xl p-3 text-sm text-error-300">{error}</div>}
      <div>
        <label className="label">Nom complet</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" placeholder="Jean Kouassi" />
      </div>
      <div>
        <label className="label">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="vous@exemple.com" />
      </div>
      <div>
        <label className="label">Mot de passe temporaire</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="••••••••" />
      </div>
      <div>
        <label className="label">Rôle</label>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input-field">
          {(Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== 'super_admin').map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Établissement</label>
        <select value={estId} onChange={(e) => setEstId(e.target.value)} className="input-field">
          <option value="">— Choisir —</option>
          {establishments.map((est) => (
            <option key={est.id} value={est.id}>{est.name}</option>
          ))}
        </select>
      </div>
      <button onClick={submit} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
        {loading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Créer l'accès
      </button>
    </div>
  );
}
