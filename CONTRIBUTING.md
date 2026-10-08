# Contributing to SafarLoan

How we work on this repo. Read this before opening your first PR.

---

## The one-minute version

```bash
git checkout main && git pull
git checkout -b feat/short-description   # your branch
# ... work ...
git commit -m "type(scope): what you changed"
git push -u origin feat/short-description
```

Then open a PR against `main`. CI must be green before review. Never push
directly to `main`.

---

## Branches

| Branch | Who writes to it | Rule |
|---|---|---|
| `main` | nobody directly | protected; changes land only via PR |
| `develop` | nobody directly | optional integration branch if we outgrow `main` |
| `feat/…`, `fix/…`, `refactor/…` | you | short-lived, deleted after merge |

Branch names, lowercase, hyphen-separated:

```
feat/em i-schedule-generator     ← no
feat/emi-schedule-generator      ← yes
```

| Prefix | Use for |
|---|---|
| `feat/` | new capability |
| `fix/` | bug fix |
| `refactor/` | no behaviour change |
| `docs/` | documentation only |
| `chore/` | tooling, dependencies, config |
| `sql/` | migration-only change |

One concern per branch. A branch that changes the loan engine *and* the CSS
is two PRs.

---

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <imperative summary under 72 chars>

type  = feat | fix | refactor | docs | chore | test | sql
scope = the area: emi, risk, auth, chat, admin, seed, schema, ui
```

```
feat(emi): add reduce-tenure prepayment option
fix(rls): allow officers to read applications assigned to them
sql(seed): give each loan a distinct receipt_no prefix
refactor(ui): extract DataList from the dashboard tiles
```

The body explains **why**, not what. The diff already shows what.

---

## Pull requests

### Before you open it

```bash
npm run typecheck   # must be clean
npm test            # 60 assertions
npm run db:check    # SQL parses + structural checks
npm run build       # includes the prebuild env-var guard
```

All four locally first. CI takes 3–5 minutes; your own loop is faster.

Then `npm run smoke` (needs `npm run dev` in another terminal) if your change
touches a page — it renders all 29 authenticated routes with a real session,
which is the only way to catch a component that throws only when data is
present.

Touching SQL? `npm run db:setup` re-applies schema and seed against your own
project and re-runs the verification, in the only order that works. Never paste
a migration into the SQL Editor without running `db:check` first — see
[SQL migrations](#sql-migrations).

### The PR should explain

- **What** changed, in one or two sentences
- **Why** — the problem, not just the solution
- **How you verified it**
- **What you did not do**, if something was left out

### Size

Aim for under ~400 changed lines. If a PR is large, say why — sometimes a
schema change forces a wide diff, and that's fine when stated.

---

## Where things live

```
app/
  page.tsx            marketing landing
  login/ signup/      auth (split-screen layout)
  user/               applicant portal  — 7 routes, per USER-OMA.txt line 8
  employee/           officer portal    — queue, review, servicing, NOC
  admin/              admin portal      — users, products, staff, reports, audit

lib/
  finance/emi.ts      EMI, amortisation, prepayment   ← the maths lives here
  finance/risk.ts     FOIR, eligibility, approval authority
  supabase/           three client variants (browser / server / admin)
  actions/            Server Actions
  queries/            read models per portal

supabase/migrations/
  0001_core_schema.sql   tables, enums, indexes, RLS, triggers
  0002_seed.sql          demo data

components/
  ui/                 design-system primitives
  layout/             portal shell, sidebar, notification bell

tests/finance.test.ts 60 assertions over the maths
```

### Conventions that matter

- **Never import the service_role key into anything the browser can reach.**
  Use `lib/supabase/admin.ts`, which is `server-only`.
- **Money maths goes through `lib/finance/`.** If you need a new calculation,
  add it there with tests rather than inline in a component.
- **The document checklist is data, not code.** `document_requirements` drives
  the wizard; add rows rather than branching in the UI.
- **Interest is reducing-balance everywhere.** Flat-rate is prohibited for
  retail lending. See `0001_core_schema.sql` for the full list of decisions.

---

## SQL migrations

The parser gate (`db:check`) will catch syntax errors, unbalanced dollar
quoting, truncation, unescaped apostrophes, and INSERT arity mismatches. It
will **not** catch type errors — those need a real database:

```bash
npm run db:migrate   # applies to your Supabase project
npm run db:verify    # 61 data-integrity assertions
npm run db:embeds    # 17 PostgREST queries
```

`0001_core_schema.sql` is **idempotent** — safe to re-run after an edit.
`0002_seed.sql` **truncates** first, so it wipes anything you have created.

Two traps that have bitten us, both now covered by tooling:

1. **PostgREST embed hints are constraint names.** `applications_assigned_officer_id_fkey`
   — with the `_id`. `db:relations` validates every hint in the codebase.
2. **Re-runnable DDL needs guards.** Postgres has no `create type if not exists`
   and no `create policy if not exists`; use a `DO` block or `drop` first.

---

## Review

Two approvals to merge. One of them must be someone other than the author.

Reviewers should check:
- Does the change do what the PR claims, and nothing more?
- Is money maths correct, with a test that would fail if it regressed?
- Does it leak data across roles? (RLS in `0001_core_schema.sql`)
- Does `npm run smoke` pass locally?

Authors: respond to every comment, even if only to say you've read it.
Push follow-up commits rather than force-pushing — reviewers can see the
change evolve. Squash-merge keeps the main history readable.

---

## Reporting bugs

Open an issue with:
- What you did, what you expected, what happened
- The route and the role you were signed in as
- Output from `npm run db:diagnose` if login is involved

Demo accounts use password `demo1234` — see the README table.

---

## Adding a dependency

Say why in the PR. Prefer a well-maintained package with few transitive deps.
If a package has a licence that affects us commercially, flag it before adding.