<script>
  import '../app.css';
  import { PUBLIC_APP_NAME } from '$env/static/public';

  let { children } = $props();
</script>

<!-- The field the glass tiles sit on: a few soft colour washes for the
     backdrop blur to pick up. Purely decorative. -->
<div class="bg-field pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
  <div
    class="bg-tile-tests absolute -top-56 -left-40 h-[600px] w-[700px] rounded-full opacity-70 blur-[90px]"
  ></div>
  <div
    class="bg-tile-security absolute -top-40 -right-24 h-[600px] w-[600px] rounded-full opacity-60 blur-[90px]"
  ></div>
  <div
    class="bg-tile-resources absolute -bottom-80 left-1/4 h-[600px] w-[900px] rounded-full opacity-70 blur-[90px]"
  ></div>
</div>

<div class="flex min-h-full flex-col">
  <header class="flex h-9 items-center gap-3 px-4 pt-2 text-xs font-light text-white/55 md:px-10">
    <span class="font-normal text-white/80">{PUBLIC_APP_NAME}</span>
    <span>instrumentação para sessões de IA de código</span>
  </header>

  <main class="flex-1">
    {@render children?.()}
  </main>
</div>
