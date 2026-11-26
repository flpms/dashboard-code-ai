import '@testing-library/jest-dom/vitest';

// jsdom has no layout, so no ResizeObserver. Svelte's `bind:clientWidth`
// needs the constructor to exist; components fall back to a fixed width.
globalThis.ResizeObserver ??= /** @type {any} */ (
  function ResizeObserver() {
    return { observe: () => {}, unobserve: () => {}, disconnect: () => {} };
  }
);
