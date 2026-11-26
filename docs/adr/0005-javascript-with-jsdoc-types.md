# 5. JavaScript with JSDoc types, not TypeScript

**Status:** accepted

## Context

The team writes JavaScript. TypeScript would add a build step to the API (which
currently has none — what you read is what runs) and a compile stage to every
script and test.

But untyped JavaScript at scale produces the failure this template exists to
avoid: a field renamed in one layer and silently absent three layers away.

## Decision

JavaScript with JSDoc annotations, checked by `svelte-check` under `strict` and
`checkJs` on the web side. Shared shapes live in `src/lib/types.js`. `npm run check`
reporting 0 errors is a required CI gate.

Test files are excluded: Vitest and Playwright type-check nothing, and checking
them buys casts rather than safety.

## Consequences

- Real type errors are caught, in the editor, with no build step.
- JSDoc is more verbose than TypeScript annotations, and generics are awkward.
- The gate has to stay green from day one. A project that accumulates type
  errors here stops trusting the annotations, and then stops writing them —
  which is exactly how the practice dies.
- The API has no equivalent gate today; its safety comes from the integration
  test that boots the real router. Extending `checkJs` to `api/` is open.
