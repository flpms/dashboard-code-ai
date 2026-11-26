<script>
  import { cn } from '$lib/utils/cn.js';

  /**
   * Variants are a lookup table, not a chain of ternaries. Adding "danger" is
   * one line here and zero changes at every call site.
   */
  /** @type {Record<string, string>} */
  const VARIANTS = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
    secondary: 'bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
  };

  /** @type {Record<string, string>} */
  const SIZES = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-6 text-base',
  };

  /**
   * @type {{
   *   variant?: 'primary'|'secondary'|'ghost'|'danger',
   *   size?: 'sm'|'md'|'lg',
   *   type?: 'button'|'submit'|'reset',
   *   disabled?: boolean,
   *   loading?: boolean,
   *   class?: string,
   *   children?: import('svelte').Snippet,
   *   [key: string]: unknown,
   * }}
   */
  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    loading = false,
    class: className = '',
    children,
    ...rest
  } = $props();
</script>

<button
  {type}
  disabled={disabled || loading}
  class={cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    className
  )}
  {...rest}
>
  {#if loading}
    <span
      class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    ></span>
  {/if}
  {@render children?.()}
</button>
