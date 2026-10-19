# Screenshots

Every image referenced by the root `README.md` lives here and is referenced with a
full path relative to the repository root, e.g.:

```markdown
![Dashboard](docs/screenshots/user-dashboard.png)
```

That means a file dropped in this folder at `user-dashboard.png` is already at the
right path. Nothing else needs editing.

---

## Naming convention

`{portal}-{feature}.png`

| Prefix | Portal | Sign in as |
|---|---|---|
| `user-` | Borrower | `rahul@demo.in` / `demo1234` |
| `officer-` | Loan officer | `officer@demo.in` / `demo1234` |
| `admin-` | Administrator | `admin@demo.in` / `demo1234` |
| `chat-` | Realtime chat | two browser profiles |

The filename must match the caption it is given. That keeps the gallery
alphabetical-but-meaningful and makes a rename a one-line edit.

---

## Where each screenshot comes from

The exact URL for every file, with the account to sign in as first. Routes with an
ID in them are pinned to a seeded row so the URL is stable.

### Hero

| File | URL | Sign in as |
|---|---|---|
| `hero-portals.png` | compose the three below | — |

### User portal — `rahul@demo.in`

| File | URL |
|---|---|
| `user-dashboard.png` | `/user/dashboard` |
| `user-new-loan.png` | `/user/new-loan` |
| `user-document-wizard.png` | `/user/new-loan/10000000-0000-4000-8000-000000000001` |
| `user-application-detail.png` | `/user/applications/20000000-0000-4000-8000-000000000001` |
| `user-loan-detail.png` | `/user/loans/40000000-0000-4000-8000-000000000001` |
| `user-emi-calculator.png` | `/user/emi-calculator` |
| `user-cibil.png` | `/user/cibil` |
| `user-payments.png` | `/user/payments` |
| `user-applications.png` | `/user/applications` |
| `user-tickets.png` | `/user/tickets` |

Resubmission state needs a different account:

| File | URL | Sign in as |
|---|---|---|
| `user-resubmission.png` | `/user/applications/20000000-0000-4000-8000-000000000003` | `priya@demo.in` |

### Officer portal — `officer@demo.in`

| File | URL |
|---|---|
| `officer-queue.png` | `/employee/dashboard` |
| `officer-applications.png` | `/employee/applications` |
| `officer-scorecard.png` | `/employee/applications/20000000-0000-4000-8000-000000000002` |
| `officer-decision.png` | `/employee/applications/20000000-0000-4000-8000-000000000002` |
| `officer-loans.png` | `/employee/loans` |
| `officer-noc.png` | `/employee/noc` |
| `officer-tickets.png` | `/employee/tickets` |
| `officer-chats.png` | `/employee/chat` |

### Admin portal — `admin@demo.in`

| File | URL |
|---|---|
| `admin-dashboard.png` | `/admin/dashboard` |
| `admin-users.png` | `/admin/users` |
| `admin-products.png` | `/admin/products` |
| `admin-staff.png` | `/admin/staff` |
| `admin-reports.png` | `/admin/reports` |
| `admin-audit-log.png` | `/admin/audit` |

### Chat (Realtime) — `chat.png`

Open `/user/chat/50000000-0000-4000-8000-000000000003` in a normal window and
`/employee/chat/50000000-0000-4000-8000-000000000003` in a private window, send a
message, and capture both. That proves the push actually works — a single-window
screenshot does not.

### Public pages

| File | URL |
|---|---|
| `landing.png` | `/` |
| `login.png` | `/login` |
| `signup.png` | `/signup` |

---

## Seeded IDs, for reference

| Resource | ID |
|---|---|
| Home Loan product | `10000000-0000-4000-8000-000000000001` |
| Personal Loan product | `10000000-0000-4000-8000-000000000005` |
| Application — approved | `20000000-0000-4000-8000-000000000001` |
| Application — under review | `20000000-0000-4000-8000-000000000002` |
| Application — resubmission requested | `20000000-0000-4000-8000-000000000003` |
| Application — submitted | `20000000-0000-4000-8000-000000000005` |
| Application — rejected | `20000000-0000-4000-8000-000000000006` |
| Loan — active, home | `40000000-0000-4000-8000-000000000001` |
| Loan — NOC issued | `40000000-0000-4000-8000-000000000004` |
| Chat — overdue EMI thread | `50000000-0000-4000-8000-000000000003` |
| Ticket — in progress | `60000000-0000-4000-8000-000000000001` |

The nine product IDs are sequential from `...0001` (Home) to `...0009` (Working
Capital), in the order Home, Vehicle, Gold, LAP, Personal, Education, Business,
Credit Card, Working Capital.

---

## Rules that keep this from rotting

- **Full paths in every screenshot.** A screenshot that contradicts the spec tables
  above it reads as a bug.
- **Blur or crop real PII before committing.** The `demo.in` seed accounts are fine.
  Any screen you pull from a real environment is not.
- **Export at 2× and compress.** Eighteen full-page PNGs at 2× is several MB of
  scroll-jank for no added detail.
- **Match the viewport across the set.** Pick one desktop width and one mobile width
  and reuse them, or the gallery looks like three different applications.
- **Capture the mobile set too.** Column priority, the drawer and the 44px touch
  targets are all invisible in a desktop screenshot.

This folder is tracked in git by the presence of this file, so it exists on a fresh
clone even before any images land. Delete it once the first screenshot is committed
and the folder is holding images anyway.