<script>
  /** @type {{ title?: string, description?: string, children?: import('svelte').Snippet }} */
  let { title = 'Nada por aqui', description = '', children } = $props();
</script>

<div
  class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 p-12 text-center"
>
  <p class="text-sm font-medium text-slate-900">{title}</p>
  {#if description}
    <p class="max-w-sm text-sm text-slate-500">{description}</p>
  {/if}
  {@render children?.()}
</div>
