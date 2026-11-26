<script>
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { session } from '$store/session.svelte.js';

  // The entry point only decides where to send the visitor. Any screen that
  // renders here would flash before the redirect.
  $effect(() => {
    goto(resolve(session.isAuthenticated ? '/items' : '/login'), { replaceState: true });
  });
</script>
