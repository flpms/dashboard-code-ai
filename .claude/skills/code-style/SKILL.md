---
name: code-style
description: The house style for this repository — functional composition, dependency injection, lookup tables instead of chained ifs, early returns, immutability. Use when writing or reviewing any JavaScript or Svelte file here, when a review comment mentions "style", or when a function grows a branch ladder, a switch, or an else.
---

# Code Style

Two ideas produce almost every rule below.

**Behaviour is data.** A branch that exists only to pick between known
alternatives is a table written the long way. Tables are readable at a glance,
extensible without editing control flow, and testable by iterating their keys.

**Dependencies are arguments.** A module that reaches out for what it needs —
importing a connection, reading `process.env`, grabbing a store — can only run
in the situation it was written for. A module that receives what it needs runs
anywhere, including inside a test with no infrastructure at all.

---

## 1. Lookup tables instead of chained conditionals

This is the rule that shapes the codebase most. When a value selects between
known outcomes, write the mapping.

```javascript
// ✗ Six branches to maintain, and the compiler cannot tell you when one is
//   missing. Adding a status means finding this function and every copy of it.
function statusLabel(status) {
  if (status === 'draft') return 'Rascunho';
  else if (status === 'active') return 'Ativo';
  else if (status === 'archived') return 'Arquivado';
  else return status;
}

// ✓ The mapping is the code. Adding a status is one line; the fallback is
//   explicit; the whole table can be iterated in a test.
const STATUS_LABELS = Object.freeze({
  draft: 'Rascunho',
  active: 'Ativo',
  archived: 'Arquivado',
});

const statusLabel = status => STATUS_LABELS[status] ?? status;
```

### Tables of functions

The same applies when the outcomes are behaviour rather than values. This is how
`lib/route-processor.js` turns a row of `routes.json` into a chain of Fastify
`onRequest` guards:

```javascript
const GUARD_BUILDERS = Object.freeze({
  local: ({ requireLoopback }) => requireLoopback,
});

// Order is data too — and being data, it is reviewable.
const GUARD_ORDER = Object.freeze(['local']);

const buildGuards = (deps, route) =>
  GUARD_ORDER.filter(flag => Boolean(route[flag])).map(flag =>
    GUARD_BUILDERS[flag](deps, route[flag])
  );
```

Adding a capability is a new key plus a position in the order. No `if` is
touched, and the security-relevant ordering is one array that a reviewer reads
in a second.

### When a table is the wrong tool

Do not force it. Keep the conditional when:

- The condition is a **relation**, not a key: `if (page > totalPages)`,
  `if (total > limit)`. A table keyed on a comparison is just an `if` in costume.
- There are **exactly two** outcomes and the second is a guard:
  `if (!user) return unauthorized(res);`
- The branches **do genuinely different work with different data** — three
  branches each calling a different service with a different payload is clearer
  as three named functions than as a table of closures.

The test: if adding a case means adding a row, use a table. If it means adding
logic, use a function.

---

## 2. Early returns, never `else`

Guards first, at the top, one per line. The happy path is then flat and reads
top to bottom.

```javascript
// ✗ The real work is buried three levels deep, and the reason for each refusal
//   is far from the condition that caused it.
const publish = report => {
  if (report) {
    if (report.status === 'complete') {
      if (report.approvedBy) {
        return send(report);
      } else {
        throw new Error('Not approved');
      }
    } else {
      throw new Error('Not complete');
    }
  } else {
    throw new Error('No report');
  }
};

// ✓ Every refusal is one line, next to its cause. The work is at indent zero.
const publish = report => {
  if (!report) throw new Error('No report');
  if (report.status !== 'complete') throw new Error('Not complete');
  if (!report.approvedBy) throw new Error('Not approved');

  return send(report);
};
```

Enforced by ESLint (`no-else-return`, `max-depth: 3`). In Svelte templates the
same applies: prefer separate `{#if}` blocks to `{:else}` when the two branches
render substantially different things.

---

## 3. Factory functions, not classes

Every unit in this codebase is a function that takes its dependencies and
returns an object of functions. No `class`, no `new`, no `this`, no inheritance.

```javascript
export const SessionsRepository = ({ db, logger }) => {
  logger.info('Start Table - sessions');
  const find = db.prepare('SELECT id, cwd FROM sessions WHERE id = ?');

  return {
    cwdOf: id => find.get(id)?.cwd ?? null,
  };
};
```

Why this and not a class:

- **Testing needs no framework.** A fake is `{ findOne: async () => null }`. No
  module interception, nothing that breaks when a file is renamed.
- **The dependency list is the signature.** What a module needs is visible in
  its first line, so an accidental new coupling shows up in the diff.
- **Nothing is half-built.** There is no instance that exists before its
  collaborators do.

The composition root — `app/config/index.js` on the API, the page component on
the web — is the only place allowed to know about everything.

---

## 4. Never reach for a dependency

```javascript
// ✗ Untestable without a real environment, and invisible in the signature.
import { spawn } from 'node:child_process';
const audit = cwd => spawn('npm', ['audit', '--json'], { cwd, timeout: Number(process.env.AUDIT_TIMEOUT) });

// ✓ Both dependencies are arguments. The function runs anywhere, and a test
// passes a fake `spawn` that answers with a fixture.
export const SecurityAuditor = ({ spawn, timeoutMs }) => ({
  audit: cwd => spawn('npm', ['audit', '--json'], { cwd, timeout: timeoutMs }),
});
```

Concretely, in this repo:

- `process.env` is read in **one** file per app (`app/config/env.config.js`,
  and `$env/static/public` on the web). Nowhere else.
- Services never import stores. A service that reads global state cannot be
  called twice with different inputs.
- Services never import other services. Composition happens one layer up.

---

## 5. Immutability by default

```javascript
// ✗ Mutating the argument. The caller's object is now different and nothing said so.
const withDefaults = item => {
  item.status ??= 'draft';
  return item;
};

// ✓ A new object. The input is still the input.
const withDefaults = item => ({ status: 'draft', ...item });
```

- Build objects with spread, not by assigning into them.
- `Object.freeze` every module-level constant table.
- Transform with `map`/`filter`/`reduce`/`flatMap`, not by pushing into an array
  declared above a loop.
- `const` everywhere. `let` only for genuinely evolving local state (and for
  Svelte runes, where the compiler requires it).

Two sanctioned exceptions, both encoded in the ESLint config: a Fastify hook
decorating `request`, and a reducer writing into its own accumulator.

### Conditional keys instead of conditional statements

```javascript
// ✗
const event = { kind, ts };
if (agentId) event.agentId = agentId;
if (status) event.status = status;

// ✓ The object is built in one expression, and it is `const`.
const event = {
  kind,
  ts,
  ...(agentId && { agentId }),
  ...(status && { status }),
};
```

---

## 6. Small, named, single-purpose functions

Prefer arrow consts. Name the intermediate step rather than nesting expressions
three deep.

```javascript
// ✓ Each name is a fact the next reader does not have to derive.
const isDependencyFile = path => DEPENDENCY_FILES.has(baseName(path));
const isStale = (lastEventAt, nowMs) => nowMs - Date.parse(lastEventAt) > STALE_MS;
const messageFor = (status, body) => body?.message || MESSAGES[status] || 'Erro inesperado.';
```

If a function needs a comment to explain *what* it does, it wants a better name.
Comments explain **why** — the constraint, the bug that motivated the shape, the
thing the next person would otherwise "simplify" back into a defect.

---

## 7. Errors and failure

- A use case **never throws to the transport**. It calls one outcome on
  `onFinish` — `onFinish.NOT_FOUND(...)`, `onFinish.CONFLICT(...)`.
- 5xx bodies say nothing specific. The detail goes to the log, keyed to the
  request. A stack trace in a response body is a gift to an attacker.
- Never `catch {}` silently. Log with the location (`Collector::ingestHook`), then
  choose an outcome.
- `catch (error)` receives `unknown`. Narrow it once —
  `error instanceof Error ? error.message : 'Erro inesperado.'` — rather than
  assuming `.message` exists.

---

## 8. Naming

| Artifact              | Convention                        | Example                         |
| --------------------- | --------------------------------- | ------------------------------- |
| Factory / composition | PascalCase                        | `EventsRepository`, `ApiClient` |
| Function / value      | camelCase                         | `statusLabel`, `messageFor`     |
| Constant table        | SCREAMING_SNAKE + `Object.freeze` | `STATUS_LABELS`                 |
| File                  | kebab-case, suffixed by layer     | `items.repository.js`          |
| Svelte component      | kebab-case file, PascalCase import | `items-table.svelte`          |
| Boolean               | `is` / `has` / `can` prefix       | `isAuthenticated`, `canGoBack` |

---

## 9. Documentation that earns its place

JSDoc on every exported function: `@param`, `@returns`, and `@throws` when it
throws. `npm run check` in `web/` type-checks these — they are not decoration,
they are the type system.

Do not narrate the obvious (`// increment i`). Do write down the reason a piece
of code is shaped strangely, because that is the comment that survives:

```javascript
// Both sides are hashed again so the buffers are always 32 bytes:
// timingSafeEqual throws on a length mismatch, and that throw would itself
// leak whether the stored hash was well-formed.
```

---

## Review checklist

Before opening a pull request:

- [ ] No `else`. Guards are early returns.
- [ ] No chained `if`/`switch` selecting among known values — that is a table.
- [ ] Every constant table is `Object.freeze`d and has a `??` fallback at use.
- [ ] No `class`, no `new` outside the SDK types (`ObjectId`, `Date`, `URL`).
- [ ] No module reaches for a dependency it did not receive.
- [ ] `process.env` appears only in `env.config.js`.
- [ ] No argument is mutated (except `request` in a guard).
- [ ] Every exported function has JSDoc; `npm run check` passes with 0 errors.
- [ ] Every `catch` logs with a location and picks an outcome.
- [ ] `npm run lint` and `npm test` are green in both `api/` and `web/`.
