<script>
  import '../app.css';
  import { PUBLIC_APP_NAME } from '$env/static/public';

  let { children } = $props();
</script>

<div class="flex min-h-full flex-col">
  <header class="border-b border-slate-800 bg-slate-950">
    <div class="flex h-12 items-center gap-3 px-4">
      <span class="font-semibold text-slate-100">{PUBLIC_APP_NAME}</span>
      <span class="text-xs text-slate-500">instrumentação para sessões de IA de código</span>
    </div>
  </header>

  <main class="flex-1">
    {@render children?.()}
  </main>
</div>
