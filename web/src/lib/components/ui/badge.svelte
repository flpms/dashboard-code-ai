<script>
  import { cn } from '$lib/utils/cn.js';

  /** @type {{ class?: string, children?: import('svelte').Snippet }} */
  let { class: className = '', children } = $props();
</script>

<span
  class={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', className)}
>
  {@render children?.()}
</span>
