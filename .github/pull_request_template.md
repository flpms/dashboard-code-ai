## What changed

<!-- One paragraph. What now behaves differently, and why. -->

## How it was verified

<!-- Commands run, cases exercised. "Tests pass" is not verification. -->

## Checklist

- [ ] `cd api && npm run lint && npm test && npm run test:integration`
- [ ] `cd web && npm run lint && npm run check && npm test` — check reports 0 errors
- [ ] Layer rules respected (`docs/ARCHITECTURE.md`)
- [ ] New tenant-scoped route declares `tenant: true` in `routes.json`
- [ ] New environment variables declared in `api/app/config/env.manifest.js`
- [ ] No secret behind a `PUBLIC_` prefix, none logged
- [ ] Failure paths covered by a test, not just the happy path
