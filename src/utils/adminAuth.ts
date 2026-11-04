import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const hasAdminRole = (user: User | null | undefined): user is User =>
  user?.app_metadata?.role === 'admin';

export async function signInAsAdmin(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !hasAdminRole(data.user)) {
    await supabase.auth.signOut();
    throw new Error('Credenciais inválidas ou conta sem permissão administrativa.');
  }

  return data.user;
}

export async function hasAdminSession(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  return !error && hasAdminRole(data.user);
}

export async function inviteAdminAccount(email: string, name: string): Promise<void> {
  const { error } = await supabase.functions.invoke('invite-admin', {
    body: {
      email: email.trim().toLowerCase(),
      name: name.trim(),
    },
  });

  if (error) {
    throw new Error('Não foi possível enviar o convite. Verifique a Edge Function e a autorização administrativa.');
  }
}

export async function completeAdminInvitation(password: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !hasAdminRole(data.user)) {
    throw new Error('O convite não está ativo. Abra novamente o link recebido por e-mail.');
  }
  if (password.length < 12) {
    throw new Error('A senha deve conter pelo menos 12 caracteres.');
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    throw new Error('Não foi possível definir a senha. Verifique a política de senha do Supabase.');
  }
}

export async function signOutAdmin(): Promise<void> {
  await supabase.auth.signOut();
}