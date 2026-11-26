<script>
  import { cn } from '$lib/utils/cn.js';

  /**
   * @type {{
   *   id: string,
   *   label: string,
   *   error?: string,
   *   hint?: string,
   *   value?: string,
   *   class?: string,
   *   [key: string]: unknown,
   * }}
   */
  let {
    id,
    label,
    error = '',
    hint = '',
    value = $bindable(''),
    class: className = '',
    ...rest
  } = $props();

  const describedBy = $derived(
    [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ')
  );
</script>

<div class="flex flex-col gap-1.5">
  <label for={id} class="text-sm font-medium text-slate-700">{label}</label>

  <input
    {id}
    bind:value
    aria-invalid={Boolean(error)}
    aria-describedby={describedBy || undefined}
    class={cn(
      'h-10 rounded-md border px-3 text-sm transition-colors outline-none',
      'focus:ring-brand-500/40 focus:ring-2',
      error ? 'border-red-500' : 'focus:border-brand-500 border-slate-300',
      className
    )}
    {...rest}
  />

  {#if hint && !error}
    <p id="{id}-hint" class="text-xs text-slate-500">{hint}</p>
  {/if}

  {#if error}
    <p id="{id}-error" class="text-xs text-red-600">{error}</p>
  {/if}
</div>
