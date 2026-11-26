<script>
  import { cn } from '$lib/utils/cn.js';

  /**
   * The big number on a tile, with its unit beside it: "3 alterados".
   * Thin and large, so it reads from across the room.
   *
   * @type {{ value: string|number, unit?: string, size?: keyof typeof SIZES, class?: string }}
   */
  let { value, unit = '', size = 'md', class: className = '' } = $props();

  const SIZES = Object.freeze({
    md: 'text-[48px]',
    lg: 'text-[120px] font-thin',
  });
</script>

<p
  class={cn(
    'font-display leading-none font-extralight tracking-tight tabular-nums',
    SIZES[size] ?? SIZES.md,
    className
  )}
>
  {value}{#if unit}<span class="ml-2 font-sans text-base font-light tracking-normal opacity-85"
      >{unit}</span
    >{/if}
</p>
