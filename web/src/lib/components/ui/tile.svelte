<script>
  import { cn } from '$lib/utils/cn.js';

  /**
   * A live tile: one pane of tinted glass with its label in the bottom corner.
   * Domain-free; the caller picks the tint and the grid span through `class`.
   *
   * @type {{
   *   label: string,
   *   tint?: keyof typeof TINTS,
   *   heading?: 'top'|'bottom',
   *   class?: string,
   *   children?: import('svelte').Snippet
   * }}
   */
  let { label, tint = 'neutral', heading = 'bottom', class: className = '', children } = $props();

  // Literal class names, so Tailwind finds them. Each sets the `--tile` the
  // `glass-tile` utility mixes into its background.
  const TINTS = Object.freeze({
    tests: '[--tile:var(--color-tile-tests)]',
    agents: '[--tile:var(--color-tile-agents)]',
    containers: '[--tile:var(--color-tile-containers)]',
    alerts: '[--tile:var(--color-tile-alerts)]',
    files: '[--tile:var(--color-tile-files)]',
    resources: '[--tile:var(--color-tile-resources)]',
    security: '[--tile:var(--color-tile-security)]',
    neutral: '[--tile:var(--color-tile-neutral)]',
    warning: '[--tile:var(--color-tile-warning)]',
    critical: '[--tile:var(--color-tile-critical)]',
  });

  const HEADINGS = Object.freeze({
    top: 'order-first font-display text-2xl font-extralight',
    bottom: 'order-last pt-2 text-[15px] font-normal',
  });
</script>

<section
  class={cn(
    'glass-tile flex min-w-0 flex-col gap-2 px-4 pt-3.5 pb-3 text-white',
    TINTS[tint] ?? TINTS.neutral,
    className
  )}
  aria-label={label}
>
  <h2 class={cn('shrink-0 lowercase', HEADINGS[heading] ?? HEADINGS.bottom)}>{label}</h2>
  <!-- The body gives way before the label does: a tile of fixed height clips
       its own content, never the name that says what it is. -->
  <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
    {@render children?.()}
  </div>
</section>
