<script>
  import Button from '$lib/components/ui/button.svelte';
  import InputField from '$lib/components/ui/input-field.svelte';
  import PaginationBar from '$lib/components/pagination-bar.svelte';
  import ItemForm from '$panels/items/item-form.svelte';
  import ItemsTable from '$panels/items/items-table.svelte';
  import { itemSchema, validate } from '$schemas/index.js';
  import { ApiClient } from '$services/api-client.js';
  import { ItemsService } from '$services/items.service.js';
  import { session } from '$store/session.svelte.js';

  /**
   * The page is the only layer allowed to know about all the others: it builds
   * the service, calls it, holds the screen state, and hands plain data down to
   * the panels.
   *
   * @import { Item } from '$lib/types.js'
   */
  const client = ApiClient({
    getToken: () => session.token,
    onUnauthorized: () => session.clear(),
  });

  const items = ItemsService(client);

  /**
   * The layout above already refuses to render without a session, so this only
   * fires if a page is mounted outside it — a wiring mistake, loud on purpose.
   * @returns {string}
   */
  const tenant = () => {
    const id = session.tenantId;
    if (!id) throw new Error('Tela aberta sem sessão ativa.');
    return id;
  };

  /** Anything thrown can be anything. Narrow once, here. @param {unknown} error */
  const reasonFor = error => (error instanceof Error ? error.message : 'Erro inesperado.');

  /** @type {Item[]} */
  let rows = $state([]);
  let page = $state(1);
  let total = $state(0);
  let totalPages = $state(1);
  let search = $state('');
  let loading = $state(false);
  let saving = $state(false);
  let failure = $state('');
  /** @type {Partial<Item>|null} */
  let editing = $state(null);
  /** @type {Record<string, string>} */
  let errors = $state({});

  const load = async () => {
    loading = true;
    failure = '';
    try {
      const result = await items.list(tenant(), { page, search });
      rows = result.items;
      total = result.total;
      totalPages = result.totalPages;
    } catch (error) {
      failure = reasonFor(error);
    } finally {
      loading = false;
    }
  };

  $effect(() => {
    // Re-runs whenever page or search changes — the dependency list is the code.
    void page;
    void search;
    load();
  });

  /** @param {Partial<Item>} attributes */
  const save = async attributes => {
    const result = validate(itemSchema, attributes);

    if (!result.success) {
      errors = result.errors;
      return;
    }

    saving = true;
    errors = {};
    try {
      const write = editing?.id
        ? items.update(tenant(), editing.id, result.data)
        : items.create(tenant(), result.data);
      await write;
      editing = null;
      await load();
    } catch (error) {
      failure = reasonFor(error);
    } finally {
      saving = false;
    }
  };

  /** @param {Item} item */
  const remove = async item => {
    if (!confirm(`Excluir "${item.name}"?`)) return;
    try {
      await items.remove(tenant(), item.id);
      await load();
    } catch (error) {
      failure = reasonFor(error);
    }
  };
</script>

<div class="flex flex-col gap-6">
  <div class="flex items-end justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-slate-900">Itens</h1>
      <p class="text-sm text-slate-500">Recurso de exemplo — copie esta pasta para criar o seu.</p>
    </div>
    <Button onclick={() => (editing = {})}>Novo item</Button>
  </div>

  <InputField
    id="search"
    label="Buscar"
    bind:value={search}
    placeholder="Nome do item"
    class="max-w-sm"
  />

  {#if failure}
    <p role="alert" class="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{failure}</p>
  {/if}

  {#if editing}
    <div class="rounded-lg border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold text-slate-900">
        {editing.id ? 'Editar item' : 'Novo item'}
      </h2>
      <!-- Keyed on the record: opening a different item mounts a fresh form
           instead of leaving the previous record's text in the fields. -->
      {#key editing.id ?? 'new'}
        <ItemForm
          initial={editing}
          {errors}
          {saving}
          onsubmit={save}
          oncancel={() => {
            editing = null;
            errors = {};
          }}
        />
      {/key}
    </div>
  {/if}

  {#if loading}
    <p class="text-sm text-slate-500">Carregando…</p>
  {/if}

  {#if !loading}
    <ItemsTable items={rows} onedit={item => (editing = item)} ondelete={remove} />
    <PaginationBar {page} {total} {totalPages} onchange={value => (page = value)} />
  {/if}
</div>
