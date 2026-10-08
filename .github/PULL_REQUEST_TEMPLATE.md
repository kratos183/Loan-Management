## What

<!-- One or two sentences. What does this PR change? -->

## Why

<!-- The problem this solves, or the motivation. Not a restatement of the diff. -->

Closes #<!-- issue number, if any -->

## How it was verified

<!-- Tick what you ran locally, and say "not applicable" where sensible. -->

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run db:check`  (required if you touched `supabase/`)
- [ ] `npm run smoke`    (required if you touched a page or query)
- [ ] `npm run db:migrate && npm run db:verify` (required if you changed a migration)

<!-- Anything checked manually in the browser: -->

## Things a reviewer should look at

<!-- Point at the files/lines that need the most scrutiny. Especially: -->

- [ ] Money maths — does it go through `lib/finance/`?
- [ ] RLS — does this expose data across roles?
- [ ] Server → client boundaries — any component or function passed as a prop?

## Not done

<!-- Anything deliberately left out, follow-up work, or known limitation. -->

## Risk

<!-- What breaks if this is wrong, and how would we notice? -->