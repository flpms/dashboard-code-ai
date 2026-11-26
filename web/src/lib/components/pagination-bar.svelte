<script>
  import Button from './ui/button.svelte';

  /**
   * @type {{ page?: number, totalPages?: number, total?: number, onchange?: (page: number) => void }}
   */
  let { page = 1, totalPages = 1, total = 0, onchange } = $props();

  const canGoBack = $derived(page > 1);
  const canGoForward = $derived(page < totalPages);
</script>

<div class="flex items-center justify-between gap-4 text-sm text-slate-600">
  <p>{total} registro{total === 1 ? '' : 's'}</p>

  <div class="flex items-center gap-2">
    <Button
      variant="secondary"
      size="sm"
      disabled={!canGoBack}
      onclick={() => onchange?.(page - 1)}
    >
      Anterior
    </Button>
    <span class="tabular-nums">{page} / {Math.max(totalPages, 1)}</span>
    <Button
      variant="secondary"
      size="sm"
      disabled={!canGoForward}
      onclick={() => onchange?.(page + 1)}
    >
      Próxima
    </Button>
  </div>
</div>
