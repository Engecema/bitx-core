import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const hasAdminRole = (user: User | null | undefined): user is User =>
  user?.app_metadata?.role === 'admin';

export async function signInAsAdmin(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    throw new Error('Credenciais inválidas ou não foi possível autenticar no Supabase.');
  }

  if (!hasAdminRole(data.user)) {
    await signOutAdmin();
    throw new Error('A conta não está provisionada como administradora no Supabase.');
  }

  return data.user;
}

export async function requestAdminPasswordReset(email: string): Promise<void> {
  const redirectTo = new URL('login.html?flow=recovery', window.location.origin).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });

  if (error) {
    throw new Error('Não foi possível solicitar a redefinição de senha. Tente novamente mais tarde.');
  }
}

export async function updateAdminPassword(password: string): Promise<User> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw new Error('O link de redefinição expirou ou não é válido. Solicite um novo link.');
  }

  if (!hasAdminRole(userData.user)) {
    await signOutAdmin();
    throw new Error('A conta não está provisionada como administradora no Supabase.');
  }

  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw new Error('Não foi possível atualizar a senha. Verifique os requisitos e tente novamente.');
  }

  return data.user;
}

export async function hasAdminSession(): Promise<boolean> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Não foi possível verificar a sessão Supabase: ${sessionError.message}`);
  }
  if (!sessionData.session) return false;

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(`Não foi possível validar a sessão Supabase: ${error.message}`);
  }

  if (!hasAdminRole(data.user)) {
    await signOutAdmin();
    return false;
  }

  return true;
}

export async function signOutAdmin(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(`Não foi possível encerrar a sessão Supabase: ${error.message}`);
  }
}
