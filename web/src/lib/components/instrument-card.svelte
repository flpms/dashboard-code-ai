<script>
  import { cn } from '$lib/utils/cn.js';

  /**
   * One gauge on the instrument strip: a title, the reading, a caption, and
   * whatever detail the caller renders below. Domain-free.
   *
   * @type {{
   *   title: string,
   *   value: string,
   *   caption?: string,
   *   tone?: 'neutral'|'good'|'warning'|'critical',
   *   children?: import('svelte').Snippet
   * }}
   */
  let { title, value, caption = '', tone = 'neutral', children } = $props();

  const TONES = {
    neutral: 'text-slate-100',
    good: 'text-emerald-300',
    warning: 'text-amber-300',
    critical: 'text-red-300',
  };
</script>

<section
  class="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900 p-4"
  aria-label={title}
>
  <h2 class="text-xs font-medium tracking-wide text-slate-400 uppercase">{title}</h2>
  <p class={cn('text-2xl font-semibold tabular-nums', TONES[tone] ?? TONES.neutral)}>{value}</p>
  {#if caption}
    <p class="text-xs text-slate-400">{caption}</p>
  {/if}
  {@render children?.()}
</section>
