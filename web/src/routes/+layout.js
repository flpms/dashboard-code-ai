// A single-page app: no server render, no prerender. Everything below `/` is
// resolved in the browser, which is what lets the build be static files.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
