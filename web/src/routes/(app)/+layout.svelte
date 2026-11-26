<script>
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { PUBLIC_APP_NAME } from '$env/static/public';
  import Button from '$lib/components/ui/button.svelte';
  import { session } from '$store/session.svelte.js';

  let { children } = $props();

  // `as const` keeps each href a literal route id, which is what lets
  // resolve() type-check the link instead of accepting any string.
  const NAV = /** @type {const} */ ([{ href: '/items', label: 'Itens' }]);

  // The guard lives at the layout, once, instead of at the top of every page.
  $effect(() => {
    if (!session.isAuthenticated) goto(resolve('/login'), { replaceState: true });
  });

  const signOut = () => {
    session.clear();
    goto(resolve('/login'), { replaceState: true });
  };
</script>

{#if session.isAuthenticated}
  <div class="flex min-h-full flex-col">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <span class="font-semibold text-slate-900">{PUBLIC_APP_NAME}</span>

        <!-- resolve() keeps every link correct when the app is served from a
             sub-path (`/admin/`) rather than the domain root. -->
        <nav class="flex items-center gap-1" aria-label="Principal">
          {#each NAV as link (link.href)}
            <a
              href={resolve(link.href)}
              aria-current={page.url.pathname.startsWith(link.href) ? 'page' : undefined}
              class="aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              {link.label}
            </a>
          {/each}
        </nav>

        <div class="ml-auto flex items-center gap-3">
          <span class="text-sm text-slate-500">{session.user?.email}</span>
          <Button variant="ghost" size="sm" onclick={signOut}>Sair</Button>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      {@render children?.()}
    </main>
  </div>
{/if}
