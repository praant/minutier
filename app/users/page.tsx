'use client';
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-html-link-for-pages */
import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { roleLabel, type AppRole, type Profile } from '../../lib/auth';

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]); const [allowed, setAllowed] = useState(false);
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [role, setRole] = useState<AppRole>('ops'); const [message, setMessage] = useState('');
  const load = async () => { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single(); if (me?.role !== 'admin') { window.location.href = '/'; return; } setAllowed(true); const { data } = await supabase.from('profiles').select('*').order('created_at'); setUsers((data ?? []) as Profile[]); };
  useEffect(() => { void load(); }, []);
  const invite = async () => { setMessage(''); const response = await fetch('/api/admin/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, displayName: name, role }) }); const result = await response.json(); setMessage(response.ok ? 'Invitation envoyée.' : result.error); if (response.ok) { setEmail(''); setName(''); await load(); } };
  if (!allowed) return <main className="auth-page">Vérification des droits…</main>;
  return <main className="management-page"><a href="/">← Retour aux MEP</a><div className="management-hero"><div><p className="eyebrow">ADMINISTRATION</p><h1>Utilisateurs</h1><p>Invitez un utilisateur et choisissez son rôle.</p></div></div><section className="creator-modal user-create"><h2>Nouvelle invitation</h2><label>Nom<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Rôle<select value={role} onChange={(e) => setRole(e.target.value as AppRole)}>{Object.entries(roleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{message && <p>{message}</p>}<button className="button button--primary button--wide" onClick={invite} disabled={!email || !name}>Envoyer l’invitation</button></section><div className="management-list user-list">{users.map((user) => <div className="management-row" key={user.id}><span><b>{user.display_name || user.email}</b><small>{user.email}</small></span><span>{roleLabel[user.role]}</span></div>)}</div></main>;
}
