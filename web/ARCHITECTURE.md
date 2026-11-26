# Web architecture

SvelteKit 2 with Svelte 5 runes, Tailwind 4, Vite 8. Built as a single-page app:
`adapter-static` with a fallback, so the output is static files any web server
can host.

---

## Layers

```
┌──────────────────────────────────────────┐
│  Routes / Pages   src/routes/**          │  orchestration
├──────────────────────────────────────────┤
│  Panels           src/lib/panels/**      │  domain UI
├──────────────────────────────────────────┤
│  Components       src/lib/components/**  │  generic UI
├──────────────────────────────────────────┤
│  Services         src/lib/services/**    │  HTTP
├──────────────────────────────────────────┤
│  Schemas          src/lib/schemas/**     │  validation
└──────────────────────────────────────────┘
    Session store — read and written by pages only
```

### Pages — `src/routes/**`

The only layer permitted to know about all the others. A page builds its
services, holds screen state in runes, calls schemas, and hands plain data down
to panels.

Route groups: `(auth)` for the unauthenticated screens, `(app)` for everything
behind the session guard. The guard lives once, in `(app)/+layout.svelte`.

Forbidden: raw `fetch`, business validation.

### Panels — `src/lib/panels/**`

Domain-shaped compositions. Props in, callbacks out. No data access, no store
access — which is what lets a panel be rendered in a test with three literal
objects and no infrastructure.

### Components — `src/lib/components/**`

Generic and domain-free. Variants are lookup tables, not ternary chains:

```javascript
const VARIANTS = { primary: '…', secondary: '…', ghost: '…', danger: '…' };
```

Caller classes merge through `cn()`, so a call site can override a default
instead of fighting the cascade.

### Services — `src/lib/services/**`

Stateless factories over `ApiClient`. One resource per file. The tenant is a
parameter, never a module constant — a hardcoded tenant is why a "multi-tenant"
front end quietly only ever works for one customer.

Forbidden: importing stores, importing another service, module-level mutable
state, calling `fetch` directly.

`api-client.js` is the only door to HTTP. It holds the token, the status →
message table, the 401 handler and the non-JSON-body fallback. "Add a retry" or
"send a correlation id" is one file, not thirty call sites.

### Schemas — `src/lib/schemas/**`

Zod, importing nothing from the app. They mirror the API's Joi rules: this copy
is for feedback, the API's copy is what protects the database.

`validate(schema, input)` returns either `{ success: true, data }` or
`{ success: false, errors }` — field to first message, the shape a form renders
directly.

---

## State

`src/lib/store/session.svelte.js` is the only mutable global.

Svelte 5 runes replace the writable-store ceremony: `$state` in a `.svelte.js`
module is reactive wherever it is read. The module exports an object of getters
rather than the raw binding, so writes funnel through `start()` and `clear()` and
"who changed the session?" has a small answer.

Everything else is local `$state` in the page that owns it. There is no global
data cache; a screen fetches what it shows.

---

## User feedback

- Every load renders three states: loading, failure, empty. Reset the loading
  flag in `finally`, so a failure never leaves a spinner behind.
- Every mutation reports **both** outcomes visibly — a confirmation on success,
  a `role="alert"` message on failure. The failure text comes from `ApiClient`'s
  status → message table; a validation failure names the fields.
- Never swallow an error: log it with a location (`[ItemsPage.save]`), show it,
  and re-throw only if the caller reacts to it.

---

## Listings and the details drawer

When a listing has more to show than its columns, the answer is a read-only
drawer that answers one question — _what is recorded in this row?_ — built the
same way on every screen:

1. **An eye button in the first column** opens it: empty header, fixed width,
   an `aria-label` the tests query by. Rows and data cells are never clickable —
   a clickable cell takes no focus and is invisible to a screen reader.
2. **The drawer only reads.** Edit, delete and navigate stay in the last column.
3. **The page owns the data** (`selected` entity, `detailsOpen`) and calls the
   services; the `panels/<domain>/details/<entity>-details.svelte` panel
   receives the entity by prop. The shell (drawer · section · field) is a
   domain-free component in `components/details-drawer/`.
4. **Use what the row already has.** Fetch again only when the listing provably
   lacks a field.
5. **Names of referenced records come from a catalog** the page loads once, on
   the first opening, and whole — a truncated catalog resolves some names and
   not others. Read reference ids through one helper that accepts `{ id }`,
   `{ _id }` or a bare id.
6. **An unresolved reference shows its position** ("Item 2") and the count stays
   right. Never "unknown" or "not selected": that accuses the record of being
   incomplete, which the drawer did not check. Loading is not missing.
7. **Empty fields stay visible** as `—`.
8. **Rich-text HTML is sanitised** before `{@html}`.

The panel shows what the record **is**, then what it **includes**, inside an
outer `{#if entity}` — the drawer exists before any row is selected. Its test
covers: closed renders nothing; open shows the data; references resolve by
name, in any id shape; an unresolved reference becomes its position; a catalog
arriving while open updates it; `entity: null` does not throw.

---

## Forms and uploads

- The schema lives in `schemas/`, never inline; validate on submit and show the
  first message per field.
- Uploads take one of two shapes, chosen per form and written down where the
  form is: **upload first** (the default — upload when the file is picked, keep
  only the returned reference in form state) or **upload on save** (keep files
  locally until the record exists, when abandoning a draft must not leave
  orphans in storage).
- A form that keeps a local draft namespaces the key by tenant and user and
  clears it on a successful save.

---

## Svelte 5 idioms used here

|         |                                                                         |
| ------- | ----------------------------------------------------------------------- |
| Props   | `let { x, onedit } = $props()` — callbacks, not `createEventDispatcher` |
| State   | `let rows = $state([])`                                                 |
| Derived | `const canGoBack = $derived(page > 1)`                                  |
| Effects | `$effect(() => load())`                                                 |
| Slots   | `{@render children?.()}`                                                |
| Two-way | `let { value = $bindable('') } = $props()`                              |

Seeding local state from a prop captures only the initial value. Either wrap in
`untrack()` and let the parent remount with `{#key}` (see
`panels/items/item-form.svelte`), or derive it. `svelte-check` warns when you
forget.

`prefer-const` is disabled inside components: runes require `let`.

---

## Types

JavaScript with JSDoc, checked by `svelte-check` under `strict` + `checkJs`.
Shared shapes live in `src/lib/types.js`.

```bash
npm run check   # must report 0 errors
```

This is a required gate. A project that tolerates type errors here stops
trusting the annotations, and then they stop being written.

Test files are excluded — Vitest and Playwright type-check nothing, and checking
them buys casts rather than safety.

---

## Styling

Tailwind 4 through `@tailwindcss/vite`. There is no `tailwind.config.js`: design
tokens are CSS custom properties under `@theme` in `src/app.css`, and a token
added there is immediately available as a utility (`bg-brand-600`).

---

## Testing

```bash
npm test        # Vitest — services, schemas, utils, components
npm run test:e2e  # Playwright against the built app
```

- Services are tested with an injected `fetchImpl`, so no network is involved.
- Components are tested through Testing Library: query by role and label, assert
  what a user sees. Never assert on class names.
- Playwright runs against `npm run build && npm run preview`, not the dev server:
  a bug that only appears after bundling is exactly what a smoke test is for.
