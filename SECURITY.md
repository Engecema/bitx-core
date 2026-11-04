# Security Setup

## Supabase

1. Apply `SUPABASE_SECURITY.sql` in the Supabase SQL editor for the correct project.
2. Provision the first administrator through the Supabase Admin API or a trusted server process. Set `app_metadata.role` to `admin`; never accept this role from browser input or `user_metadata`.
3. Configure Supabase Auth password policy, MFA for administrators, email confirmation, session lifetime, and rate limits in the Supabase dashboard.
4. Keep the service-role key and any daemon credentials only on a trusted backend. Do not add them to `VITE_*` variables or browser code.

### Administrator invitations from the login screen

After the first administrator exists and can sign in, the login screen exposes the administrator invitation form. Invitations are processed by `supabase/functions/invite-admin`; the function validates the caller's access token and `app_metadata.role`, then creates an email invitation and assigns the role with the Admin API.

Deploy the function from a trusted development environment:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set APP_ORIGINS="https://YOUR_PRODUCTION_DOMAIN,http://localhost:3000"
supabase functions deploy invite-admin
```

Keep the function's service-role secret in Supabase's function environment. Do not expose it to the frontend. Configure the Supabase Auth invitation email template and allowed redirect URLs to include `https://YOUR_PRODUCTION_DOMAIN/login.html?invite=1` (and the local development URL if needed). The first administrator still must be provisioned once through the Admin API; the login screen cannot grant the first caller administrator access.

The current browser app is read-only for customer and transfer records. Do not restore client-side inserts, updates, or deletes. Financial mutations require a server-side Edge Function/API that validates the actor, ownership, amounts, limits, and transaction state before writing.

## RPC Credentials

The checked-in daemon configuration now binds RPC to loopback and uses the daemon cookie. If a password from an earlier version was ever used, rotate it immediately in the daemon and every dependent service. Because credentials appeared in repository history, removing them from the current files does not revoke them; if the repository was shared, coordinate revocation and consider removing the old commits from shared history.

Do not expose the daemon RPC port to the public internet. Remote access must go through an authenticated backend or a private network tunnel.

## Deployment

The application still needs deployment-level monitoring, backup/restore procedures, and review of Supabase policies and Auth settings. Do not treat frontend route guards as authorization; database RLS is the enforcement boundary.