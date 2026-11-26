---
name: web-feature
description: Add a screen or feature to the SvelteKit front end following the layer rules — page orchestrates, panel renders, service calls, schema validates. Use when adding a route, a form, a listing, or a component under web/, or when a change would put a fetch or business rule in the wrong layer.
---

# Adding a feature to the web app

The dependency rule, outermost first:

```
Route / Page   →  may use everything below, plus the session store
Panel          →  components only; props in, callbacks out
Service        →  HTTP; no stores, no other services
Schema         →  pure validation; imports nothing from the app
```

A change is in the wrong place if it needs to break one of those arrows.

---

## Order of work

### 1. Schema → `src/lib/schemas/<resource>.schema.js`

Zod, mirroring the API's Joi rules. Client validation is for feedback; the API's
copy is what actually protects the database. Export from `schemas/index.js`.

```javascript
export const orderSchema = z.object({
  reference: z.string().trim().min(2, 'Mínimo de 2 caracteres.'),
  status: z.enum(ORDER_STATUS).default('draft'),
});
```

### 2. Service → `src/lib/services/<resource>.service.js`

A factory over `ApiClient`. Ids are parameters, never module constants.

```javascript
export const OrdersService = client => {
  const base = sessionId => `/v1/sessions/${encodeURIComponent(sessionId)}/orders`;

  return {
    list: (sessionId, query) => client.get(`${base(sessionId)}?${new URLSearchParams(query)}`),
    create: (sessionId, attributes) => client.post(base(sessionId), attributes),
  };
};
```

Forbidden here: importing a store, importing another service, holding mutable
module state, calling `fetch` directly. `ApiClient` is the only door to HTTP —
it is where the base URL, the error-message table and the SSE subscription live.

### 3. Panel → `src/lib/panels/<domain>/<thing>.svelte`

Domain-shaped UI. Receives rows, emits intent through callback props. No
fetching, no store access — that is what lets it be rendered in a test with
three literal objects.

```svelte
<script>
  /** @type {{ orders?: Order[], onedit?: (order: Order) => void }} */
  let { orders = [], onedit } = $props();
</script>
```

Always render a real empty state. A table with zero rows and no message reads as
a bug.

### 4. Page → `src/routes/<route>/+page.svelte`

The only layer that knows about all the others. It builds the service, holds
screen state in runes, and hands plain data down.

```svelte
<script>
  const orders = OrdersService(ApiClient());

  /** @type {Order[]} */
  let rows = $state([]);
  let loading = $state(false);
  let failure = $state('');
</script>
```

Every async call needs three visible states: loading, failure, empty. A screen
that only handles success is a screen that shows nothing when the API is down.
Every mutation reports both outcomes — a confirmation on success, a
`role="alert"` message on failure.

### 5. Listing with details (when the table cannot show everything)

A read-only drawer, opened by an eye button in the **first** column — never by a
clickable row or cell. The page holds `selected` and `detailsOpen` and loads any
name catalog once, on the first opening; the `panels/<domain>/details/` panel
only receives props. An unresolved reference shows its position ("Item 2"), an
empty field shows `—`. Full rules: `web/ARCHITECTURE.md`, *Listings and the
details drawer*.

---

## Svelte 5 notes

| Svelte 4                     | Here                                                |
| ---------------------------- | --------------------------------------------------- |
| `export let x`               | `let { x } = $props()`                              |
| `let x = 0` (reactive)       | `let x = $state(0)`                                 |
| `$: doubled = x * 2`         | `const doubled = $derived(x * 2)`                   |
| `$: { sideEffect(x) }`       | `$effect(() => sideEffect(x))`                      |
| `createEventDispatcher`      | callback props: `onedit`, `onchange`                |
| `<slot />`                   | `{@render children?.()}`                            |
| `writable()` in a `.js`      | `$state` in a `.svelte.js`                          |

- Seeding local state from a prop captures only the initial value. Either wrap
  in `untrack()` and remount with `{#key}` from the parent (see
  `panels/items/item-form.svelte`), or derive it.
- Navigate with `resolve()` from `$app/paths`, so a sub-path deployment works.
  ESLint enforces this.
- `prefer-const` is off inside components: runes need `let`.

---

## Styling

Tailwind 4. Tokens live in `src/app.css` under `@theme` — there is no
`tailwind.config.js`. Component variants are lookup tables (see
`components/ui/button.svelte`), never ternary chains in the class attribute.
Merge caller classes with `cn()` so a call site can override a default.

---

## Definition of done

```bash
cd web && npm run lint && npm run check && npm test
```

- [ ] `npm run check` reports **0 errors** — JSDoc types are the type system here.
- [ ] No `fetch` outside `api-client.js`.
- [ ] No service imports a store or another service.
- [ ] The panel has no data access; the page has no raw HTTP.
- [ ] Loading, failure and empty states all render.
- [ ] Every mutation shows its success and its failure.
- [ ] No clickable table rows or cells; details open from the first-column eye
      button.
- [ ] Inputs have labels tied by `id`; errors use `aria-describedby`; failures
      are in a `role="alert"`.
- [ ] A component test covers the empty state and one interaction.
