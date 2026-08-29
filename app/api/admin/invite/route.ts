import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import type { AppRole } from '../../../../lib/auth';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Accès administrateur requis.' }, { status: 403 });
  const { email, displayName, role } = await request.json() as { email: string; displayName: string; role: AppRole };
  if (!['ops', 'po', 'release_manager', 'admin'].includes(role)) return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { display_name: displayName }, redirectTo: `${new URL(request.url).origin}/login` });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? 'Invitation impossible.' }, { status: 400 });
  await admin.from('profiles').update({ role, display_name: displayName }).eq('id', data.user.id);
  return NextResponse.json({ ok: true });
}
