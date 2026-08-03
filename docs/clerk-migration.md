# NextAuth → Clerk migration

Replaces NextAuth v4 (Google provider, JWT sessions) with Clerk, keeping the
Xano roster as the source of truth for who is allowed in and what role they get.

**This branch has not been run against a live Clerk instance.** It typechecks
and lints, but sign-in has not been exercised end to end. Do the setup below on
a preview deployment before merging to `main`.

## What changed

| Concern | Before | After |
|---|---|---|
| Identity provider | NextAuth Google provider | Clerk `oauth_google` |
| Session storage | NextAuth JWT cookie | Clerk session |
| Roster gating | `signIn` callback in `lib/auth.ts` | `getAppSession()` in `app/(authenticated)/layout.tsx` |
| Role / school IDs | NextAuth JWT claims | Clerk `publicMetadata`, written on first sign-in |
| Client session access | `useSession` from `next-auth/react` | `useSession` from `@/components/session-provider` |
| Route handler auth | `getToken` in `lib/api-auth.ts` | `getAppSession()`, same `getApiSession` signature |
| Route protection | `middleware.ts` cookie check | `clerkMiddleware` + `createRouteMatcher` |

### Session shape is unchanged

Client components still read `session.user.{name,email,image,role,students_id,teachers_id}`
and `status`. The ~20 call sites only had their import swapped, so their logic is
untouched.

The difference is where the data comes from: `app/(authenticated)/layout.tsx`
resolves the session on the server and passes it down through context, instead
of each component fetching it. `status` is therefore never `"loading"` inside
the authenticated tree — the data is present on first render.

### Roster gating

`lib/roster.ts` holds the Xano lookups that used to live in `lib/auth.ts`.
`lib/clerk-session.ts` resolves a signed-in Clerk user against that roster:

1. Read roster metadata off the session token, if the Clerk instance is
   configured to include it (fastest path, no API call).
2. Otherwise read it off the Clerk user's `publicMetadata`.
3. Otherwise look the email up in Xano and write it to `publicMetadata`.
4. If the email is on neither roster, return `null` — the authenticated layout
   then redirects to `/login?error=not_authorized`.

A Clerk account by itself grants nothing. This is what replaces the old
NextAuth `signIn` callback returning `false`.

## Required setup

### 1. Environment variables

Add to Vercel (and `.env.local` for local work):

```
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
```

These NextAuth variables become unused and can be removed once the migration
lands: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` move into the Clerk dashboard for a
production instance (see below) rather than being read by the app.

### 2. Clerk dashboard

- **User & Authentication → Social Connections**: enable Google. For a
  production instance, supply the existing SailFuture Google OAuth client ID and
  secret so the consent screen stays the one under verification. A development
  instance uses Clerk's shared credentials and will show Clerk's consent screen.
- **Sessions → Customize session token**: add

  ```json
  { "metadata": "{{user.public_metadata}}" }
  ```

  Optional but recommended — without it every request falls back to a Clerk API
  call to read `publicMetadata`.
- **Paths**: sign-in URL `/login`.

### 3. Google Cloud Console

Clerk terminates the OAuth handshake, so the redirect URI changes. Add Clerk's
callback to the same OAuth client:

```
https://clerk.<your-production-domain>/v1/oauth_callback
```

The exact URI is shown in Clerk's Google connection settings. Keep the existing
`/api/auth/callback/google` entry until the migration is confirmed, so a
rollback still works.

This interacts with the in-flight OAuth verification: the app name, home page,
privacy policy, and terms requirements are unchanged, but the client's
authorized redirect URIs are not.

## No user data to migrate

NextAuth ran JWT-only with no adapter and no user table — Xano was always the
roster. There are no accounts to export. Existing users are signed out once and
sign in again with the same Google account; `publicMetadata` is populated on
their first authenticated request.

## Rollback

Revert the merge. `NEXTAUTH_SECRET` and `NEXTAUTH_URL` must still be set, and
the Google OAuth client must still list `/api/auth/callback/google`.
