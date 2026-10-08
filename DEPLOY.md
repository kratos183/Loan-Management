# Deploying to Vercel

SafarLoan is a standard Next.js 16 app, so Vercel needs no framework config
beyond what `vercel.json` already declares. The parts that actually need care
are **environment variables** and **Supabase's allowed-redirect list**, both of
which fail in ways that look like application bugs.

Estimated time: 15 minutes.

---

## 1. Prerequisites

- The repo pushed to GitHub (done).
- A Supabase project with the schema and seed applied:

  ```bash
  npm run db:setup      # creates auth users, applies schema + seed, verifies
  ```

  Deploying without this gives you an app that builds and deploys cleanly, then
  fails on first sign-in with no rows to read.

- A Vercel account. The Hobby plan is fine; this app fits in the free tier.

---

## 2. Import the project

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import `kratos183/Loan-Management`.
3. Vercel auto-detects Next.js. Confirm:
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Install Command:** `npm ci`
4. Do **not** deploy yet — set the environment variables first.

Using the Git integration rather than `vercel --prod` from your laptop matters:
the Git integration gives a stable URL and a fresh deployment per push, whereas
CLI pushes get a new URL each time.

---

## 3. Environment variables

Project → **Settings** → **Environment Variables**.

| Variable | Scope | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Build + Runtime | Project Settings → Data API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build + Runtime | Project Settings → API Keys → **anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime | Project Settings → API Keys → **service_role** |
| `NEXT_PUBLIC_APP_URL` | Build + Runtime | Your Vercel domain, e.g. `https://safarloan.vercel.app` |

Tick **all three** environment boxes (Production, Preview, Development).

### Why `NEXT_PUBLIC_*` is marked "Build"

`NEXT_PUBLIC_*` variables are **inlined into the JavaScript bundle at build
time**, not read per request. Two consequences:

- They must be present *when the build runs*, not just when it serves.
- After changing one, the existing deployment is still broken. You must
  redeploy — adding the variable alone does nothing.

`npm run prebuild` enforces this: the build fails with an explicit list of
missing variables instead of producing a bundle that throws on first page load.

> `NEXT_PUBLIC_APP_URL` should be set **after** the first deploy, once you know
> the generated domain. Until then leave it as `http://localhost:3000`.

### Do not put these in Vercel

- **`DATABASE_URL`** — the migration tooling runs on your machine against
  Supabase directly. It is not needed at build or runtime, and putting a
  production connection string in the dashboard widens its exposure.
- The **service_role key must never be prefixed with `NEXT_PUBLIC_`.** That
  would publish it to every browser. The prebuild guard fails the build if the
  anon key and service key are identical, which is the usual way this mistake
  happens.

---

## 4. Tell Supabase about your Vercel domain

**This is the step that breaks sign-in if you skip it.** Supabase rejects any
redirect to a URL it does not recognise, so login appears to hang and then
redirect to the dashboard.

Supabase Dashboard → **Authentication** → **URL Configuration**:

| Field | Value |
|---|---|
| **Site URL** | `https://safarloan.vercel.app` |
| **Redirect URLs** | add `https://safarloan.vercel.app/**` |

Add the redirect patterns for any other hostname you will use — a preview
deployment gets a different domain, so add `https://safarloan-*.vercel.app/**`
if you want preview links to be able to sign in.

With email confirmation enabled, also check **Authentication → Sign In /
Providers → Email → Confirm email** and make sure confirmation links are
either accepted or disabled, since each confirmation email embeds a redirect
URL that must also be allow-listed.

---

## 5. Deploy

Push to `main`, or hit **Deploy** in the Vercel dashboard.

Watch the build log. You should see:

```
> prebuild
> node scripts/check-build-env.mjs
  Environment OK
```

Then sign in at `/login` with a demo account (see the README) and walk one
dashboard per portal.

---

## 6. After deploying: checklist

| Check | Expected |
|---|---|
| `/` loads without console errors | yes |
| `/login` signs in as `officer@demo.in` | redirects to `/employee/dashboard` |
| Officer portal shows assigned applications | populated |
| `/admin/users` as `admin@demo.in` | user list renders |
| `/user/loans` as `rahul@demo.in` | EMI schedule with correct maths |
| Realtime chat receives a message in a second tab | appears without refresh |
| Vercel logs show no Supabase errors | clean |

---

## Troubleshooting

**Sign-in fails, redirects back to `/login`.**
Supabase is rejecting the redirect URL. Go back to step 4 and confirm the Site
URL and Redirect URLs both cover the exact domain, with no trailing slash
mismatch.

**Page loads but every query returns empty.**
The schema was never applied to the project this deployment points at. Run
`npm run db:setup` against that specific project.

**`NEXT_PUBLIC_SUPABASE_URL is missing` at build time.**
Add the variable for the environment being built (Preview vs Production) and
redeploy. Adding it without redeploying changes nothing.

**Every request returns a doubled path like `/rest/v1/rest/v1/...`.**
The URL variable was copied including the `/rest/v1` suffix. `config.ts` strips
it defensively, so this should not happen — but set the bare project URL.

**`SUPABASE_SERVICE_ROLE_KEY is missing` on an admin page.**
Set it for the Runtime environment. Admin pages use the privileged client
(`lib/supabase/admin.ts`), which bypasses RLS.

**Build fails on Node version.**
`engines.node` is `>=20.9.0`. Vercel's default Node may be older; set it under
Project → Settings → Node.js Version.

---

## Cost note

Hobby plan limits apply. If you hit them the usual causes are too many distinct
preview deployments (each is a full build) or a Supabase project pausing after
a week of inactivity. Preview builds are configured to be safe: `ci.yml` gates
the database-backed checks behind secrets so a fork's pull request cannot read
`service_role`.

## Security on a public deployment

This project ships demo accounts with a shared password (`demo1234`) and a
`service_role` key. Fine for a demo; **not** fine for real data. Before any real
use:

- Delete the demo users, or change all their passwords.
- Rotate the `service_role` key.
- Review every RLS policy in `0001_core_schema.sql` — it is the only thing
  standing between a leaked anon key and your database.