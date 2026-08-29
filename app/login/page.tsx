'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [bootstrap, setBootstrap] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { createClient().rpc('is_bootstrap_available').then(({ data }) => setBootstrap(Boolean(data))); }, []);
  const submit = async () => {
    setBusy(true); setMessage(''); const supabase = createClient();
    const result = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
    if (result.error) setMessage(result.error.message);
    else if (mode === 'signup') setMessage('Compte administrateur créé. Confirmez votre adresse e-mail si demandé, puis connectez-vous.');
    else window.location.href = '/';
    setBusy(false);
  };
  return <main className="auth-page"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark">M</span><div><strong>MEP Tempo</strong><span>Accès sécurisé</span></div></div><p className="eyebrow">SUPABASE AUTH</p><h1>{mode === 'login' ? 'Connexion' : 'Créer le premier administrateur'}</h1><p className="auth-copy">Accédez aux minutiers selon votre rôle.</p>{mode === 'signup' && <label>Nom affiché<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>}<label>Adresse e-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label>Mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>{message && <p className="auth-message">{message}</p>}<button className="button button--primary button--wide" disabled={busy || !email || password.length < 8} onClick={submit}>{busy ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}</button>{bootstrap && <button className="auth-switch" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Première installation ? Créer l’administrateur' : 'Retour à la connexion'}</button>}</section></main>;
}
