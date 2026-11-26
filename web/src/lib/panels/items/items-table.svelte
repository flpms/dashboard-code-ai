<script>
  import Badge from '$lib/components/ui/badge.svelte';
  import Button from '$lib/components/ui/button.svelte';
  import EmptyState from '$lib/components/empty-state.svelte';
  import { formatDateTime, statusClass, statusLabel } from '$lib/utils/format.js';

  /**
   * A panel: domain-shaped UI, no data fetching.
   *
   * It receives rows and emits intent through callback props. That is what lets
   * it be rendered in a test with three literal objects, and what keeps "where
   * does this data come from?" answerable by looking at the page above it.
   */
  /**
   * @import { Item } from '$lib/types.js'
   * @type {{ items?: Item[], onedit?: (item: Item) => void, ondelete?: (item: Item) => void }}
   */
  let { items = [], onedit, ondelete } = $props();
</script>

{#if items.length === 0}
  <EmptyState title="Nenhum item" description="Crie o primeiro item para começar."></EmptyState>
{/if}

{#if items.length > 0}
  <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
        <tr>
          <th scope="col" class="px-4 py-3 font-medium">Nome</th>
          <th scope="col" class="px-4 py-3 font-medium">Status</th>
          <th scope="col" class="px-4 py-3 font-medium">Criado em</th>
          <th scope="col" class="px-4 py-3 text-right font-medium">Ações</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        {#each items as item (item.id)}
          <tr class="hover:bg-slate-50">
            <td class="px-4 py-3">
              <p class="font-medium text-slate-900">{item.name}</p>
              {#if item.description}
                <p class="line-clamp-1 text-xs text-slate-500">{item.description}</p>
              {/if}
            </td>
            <td class="px-4 py-3">
              <Badge class={statusClass(item.status)}>{statusLabel(item.status)}</Badge>
            </td>
            <td class="px-4 py-3 text-slate-600 tabular-nums">{formatDateTime(item.createdAt)}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onclick={() => onedit?.(item)}>Editar</Button>
                <Button variant="ghost" size="sm" onclick={() => ondelete?.(item)}>Excluir</Button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
