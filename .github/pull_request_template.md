## What changed

<!-- One paragraph. What now behaves differently, and why. -->

## How it was verified

<!-- Commands run, cases exercised. "Tests pass" is not verification. -->

## Checklist

- [ ] `npm run verify` is green — `npm run check` reports 0 errors
- [ ] `CHANGELOG.md` has an entry under `[Unreleased]` (or the `skip-changelog` label, with the reason above)
- [ ] Docs the change makes wrong are updated (map in `CONTRIBUTING.md`)
- [ ] Layer rules respected (`docs/ARCHITECTURE.md`)
- [ ] New route declares `local: true` in `routes.json`; new hook fields are declared in `collector.schema.js`
- [ ] New environment variables declared in `api/app/config/env.manifest.js` and `api/.env.example`
- [ ] No secret behind a `PUBLIC_` prefix, none logged; no real transcript or settings file committed
- [ ] Failure paths covered by a test, not just the happy path
- [ ] Screenshots attached if the dashboard looks different
