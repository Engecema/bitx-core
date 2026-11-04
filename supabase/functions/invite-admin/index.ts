import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = new Set(
  (Deno.env.get('APP_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const jsonResponse = (status: number, body: Record<string, string>, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  });

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') ?? '';
  if (!allowedOrigins.has(origin)) {
    return new Response('Origin not allowed', { status: 403 });
  }

  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, origin);
  }

  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    return jsonResponse(415, { error: 'Content-Type must be application/json.' }, origin);
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (contentLength > 8192) {
    return jsonResponse(413, { error: 'Request body is too large.' }, origin);
  }

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error('Missing Supabase Edge Function configuration.');
    return jsonResponse(500, { error: 'Invitation service is not configured.' }, origin);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'Authentication required.' }, origin);
  }

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerResult, error: callerError } = await callerClient.auth.getUser();
  if (callerError || callerResult.user?.app_metadata?.role !== 'admin') {
    return jsonResponse(403, { error: 'Administrator access required.' }, origin);
  }

  let payload: { email?: unknown; name?: unknown };
  try {
    const rawPayload = await request.text();
    if (new TextEncoder().encode(rawPayload).byteLength > 8192) {
      return jsonResponse(413, { error: 'Request body is too large.' }, origin);
    }
    payload = JSON.parse(rawPayload);
  } catch {
    return jsonResponse(400, { error: 'Invalid request body.' }, origin);
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const name = typeof payload.name === 'string' ? payload.name.trim().replace(/\s+/g, ' ') : '';
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    name.length < 2 ||
    name.length > 120 ||
    /[<>\u0000-\u001f]/.test(name)
  ) {
    return jsonResponse(400, { error: 'Enter a valid name and email address.' }, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: invitation, error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name: name },
      redirectTo: `${origin}/login.html?invite=1`,
    }
  );

  if (invitationError || !invitation.user) {
    console.error('Admin invitation failed:', invitationError?.message ?? 'No user returned.');
    return jsonResponse(400, { error: 'Could not send invitation. Check whether the account already exists.' }, origin);
  }

  const { error: roleError } = await adminClient.auth.admin.updateUserById(invitation.user.id, {
    app_metadata: { ...invitation.user.app_metadata, role: 'admin' },
  });

  if (roleError) {
    console.error('Admin role assignment failed:', roleError.message);
    await adminClient.auth.admin.deleteUser(invitation.user.id);
    return jsonResponse(500, { error: 'Could not complete administrator provisioning.' }, origin);
  }

  return jsonResponse(201, { message: 'Administrator invitation sent.' }, origin);
});