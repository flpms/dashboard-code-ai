import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // A single-page app: the build is static files any web server can host, and
    // `fallback` hands every unknown path to the client router. Swap for
    // adapter-node the day a route needs to run on a server.
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: true,
      strict: true,
    }),
    alias: {
      $panels: 'src/lib/panels',
      $services: 'src/lib/services',
      $schemas: 'src/lib/schemas',
      $store: 'src/lib/store',
    },
  },
};
