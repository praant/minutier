'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { roleLabel, type Profile } from '../../lib/auth';
import { createClient } from '../../lib/supabase/client';

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!data) { setMessage('Profil introuvable.'); return; }
      const loaded = data as Profile;
      setProfile(loaded);
      setDisplayName(loaded.display_name || '');
    };
    void load();
  }, []);

  const saveProfile = async () => {
    if (!profile || !displayName.trim()) return;
    setBusy(true); setMessage('');
    const { error } = await createClient().from('profiles').update({ display_name: displayName.trim() }).eq('id', profile.id);
    if (error) setMessage(error.message);
    else { setProfile({ ...profile, display_name: displayName.trim() }); setMessage('Profil enregistré.'); }
    setBusy(false);
  };

  const changePassword = async () => {
    setMessage('');
    if (password.length < 8) { setMessage('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (password !== confirmation) { setMessage('Les deux mots de passe ne correspondent pas.'); return; }
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) setMessage(error.message);
    else { setPassword(''); setConfirmation(''); setMessage('Mot de passe modifié.'); }
    setBusy(false);
  };

  const logout = async () => {
    await createClient().auth.signOut();
    window.location.href = '/login';
  };

  if (!profile) return <main className="auth-page"><p>{message || 'Chargement de votre compte…'}</p></main>;

  return <main className="account-page">
    <header className="account-header"><Link href="/">← Retour aux MEP</Link><button className="button button--logout" onClick={logout}>Déconnexion</button></header>
    <section className="account-hero"><p className="eyebrow">ESPACE PERSONNEL</p><h1>Mon compte</h1><p>Consultez votre accès et gérez vos informations personnelles.</p></section>
    {message && <p className="account-message" role="status">{message}</p>}
    <div className="account-grid">
      <section className="account-card"><h2>Profil</h2><label>Nom affiché<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></label><label>Adresse e-mail<input value={profile.email} disabled /></label><label>Rôle<input value={roleLabel[profile.role]} disabled /></label><button className="button button--primary button--wide" disabled={busy || !displayName.trim()} onClick={saveProfile}>Enregistrer le profil</button></section>
      <section className="account-card"><h2>Sécurité</h2><label>Nouveau mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label><label>Confirmer le mot de passe<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" /></label><small>8 caractères minimum.</small><button className="button button--primary button--wide" disabled={busy || !password || !confirmation} onClick={changePassword}>Modifier le mot de passe</button></section>
    </div>
  </main>;
}
