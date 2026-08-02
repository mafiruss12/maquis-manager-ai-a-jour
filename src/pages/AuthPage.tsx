import { useState } from 'react';
import { Beer, Mail, Lock, User, Loader2, Chrome } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const MARQUEE_MESSAGES = [
  'Gérez votre maquis en temps réel',
  'Caisse, inventaire et clôture en un clic',
  'Fonctionne hors ligne',
  'Suivez vos ventes et bénéfices',
  'Clôture quotidienne sécurisée',
  'Contrôle total des accès',
];

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(err === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : err);
        }
      } else {
        if (password.length < 6) {
          setError('Le mot de passe doit contenir au moins 6 caractères');
          setLoading(false);
          return;
        }
        const { error: err } = await signUp(email, password, fullName);
        if (err) {
          setError(err);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    await signInWithGoogle();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/30 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Messages défilants en haut */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-primary-600/90 overflow-hidden flex items-center z-20">
        <div className="flex whitespace-nowrap animate-marquee">
          {MARQUEE_MESSAGES.concat(MARQUEE_MESSAGES).map((msg, i) => (
            <span key={i} className="mx-8 text-sm font-medium text-white flex items-center gap-2">
              <Beer size={14} /> {msg}
            </span>
          ))}
        </div>
      </div>

      {/* Bulles dorées qui montent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary-400/10 animate-rise"
            style={{
              left: `${(i * 5 + 3) % 100}%`,
              width: `${8 + (i % 4) * 6}px`,
              height: `${8 + (i % 4) * 6}px`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${8 + (i % 5) * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Casiers de bière flottants en arrière-plan */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        {[
          { top: '15%', left: '10%', anim: 'animate-float-slow', delay: '0s' },
          { top: '20%', left: '80%', anim: 'animate-float-medium', delay: '1s' },
          { top: '60%', left: '5%', anim: 'animate-float-fast', delay: '0.5s' },
          { top: '65%', left: '85%', anim: 'animate-float-slow', delay: '2s' },
          { top: '40%', left: '90%', anim: 'animate-swing', delay: '1.5s' },
        ].map((pos, i) => (
          <div
            key={i}
            className={`absolute ${pos.anim}`}
            style={{ top: pos.top, left: pos.left, animationDelay: pos.delay }}
          >
            <Beer size={64} className="text-primary-500/40" />
          </div>
        ))}
      </div>

      {/* Carte de connexion */}
      <div className="relative z-10 w-full max-w-md mt-10">
        <div className="bg-stone-900/90 backdrop-blur-xl border border-stone-700/50 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center mb-3 shadow-lg shadow-primary-500/30">
              <Beer size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold font-display text-stone-100">Maquis Manager</h1>
            <p className="text-sm text-stone-400 mt-1">Gérez votre maquis en temps réel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Nom complet</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jean Kouassi"
                    className="input-field pl-10"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="input-field pl-10"
                />
              </div>
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10"
                />
              </div>
            </div>

            {error && (
              <div className="bg-error-500/10 border border-error-500/30 rounded-xl p-3 text-sm text-error-300">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={18} /> : null}
              {mode === 'signin' ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>

          {/* Séparateur */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-stone-700" />
            <span className="text-xs text-stone-500">OU</span>
            <div className="flex-1 h-px bg-stone-700" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            className="w-full px-4 py-2.5 rounded-xl bg-white text-stone-800 font-semibold flex items-center justify-center gap-2 transition-all hover:bg-stone-100 active:scale-95"
          >
            <Chrome size={18} /> Continuer avec Google
          </button>

          <p className="text-center text-sm text-stone-400 mt-5">
            {mode === 'signin' ? "Nouveau membre ? " : 'Déjà un compte ? '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="font-semibold text-primary-400 hover:text-primary-300"
            >
              {mode === 'signin' ? "S'inscrire" : 'Se connecter'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
