<script>
  import { untrack } from 'svelte';

  import Button from '$lib/components/ui/button.svelte';
  import InputField from '$lib/components/ui/input-field.svelte';
  import { ITEM_STATUS } from '$schemas/items.schema.js';
  import { statusLabel } from '$lib/utils/format.js';

  /**
   * @import { Item } from '$lib/types.js'
   * @type {{
   *   initial?: Partial<Item>,
   *   errors?: Record<string, string>,
   *   saving?: boolean,
   *   onsubmit?: (values: Partial<Item>) => void,
   *   oncancel?: () => void,
   * }}
   */
  let { initial = {}, errors = {}, saving = false, onsubmit, oncancel } = $props();

  // The draft is seeded once, on mount. The page remounts this form with
  // `{#key}` when a different record is opened, so re-reading `initial` on every
  // change would fight the user's typing rather than help. `untrack` states that
  // intent to the compiler instead of leaving a warning behind.
  let name = $state(untrack(() => initial.name ?? ''));
  let description = $state(untrack(() => initial.description ?? ''));
  let status = $state(untrack(() => initial.status ?? 'draft'));

  /** @param {SubmitEvent} event */
  const submit = event => {
    event.preventDefault();
    onsubmit?.({ name, description, status, tags: initial.tags ?? [] });
  };
</script>

<form class="flex flex-col gap-4" onsubmit={submit} novalidate>
  <InputField id="item-name" label="Nome" bind:value={name} error={errors.name} required />

  <InputField
    id="item-description"
    label="Descrição"
    bind:value={description}
    error={errors.description}
    hint="Opcional. Até 2000 caracteres."
  />

  <div class="flex flex-col gap-1.5">
    <label for="item-status" class="text-sm font-medium text-slate-700">Status</label>
    <select
      id="item-status"
      bind:value={status}
      class="focus:border-brand-500 focus:ring-brand-500/40 h-10 rounded-md border border-slate-300 px-3 text-sm focus:ring-2 focus:outline-none"
    >
      {#each ITEM_STATUS as value (value)}
        <option {value}>{statusLabel(value)}</option>
      {/each}
    </select>
  </div>

  <div class="flex justify-end gap-2 pt-2">
    <Button variant="secondary" onclick={() => oncancel?.()}>Cancelar</Button>
    <Button type="submit" loading={saving}>Salvar</Button>
  </div>
</form>
