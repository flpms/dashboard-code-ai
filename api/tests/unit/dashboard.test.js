import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { dashboardPolicy, inlineScriptHashes } from '../../app/dashboard.js';

const sha = body => `'sha256-${createHash('sha256').update(body).digest('base64')}'`;

describe('inlineScriptHashes', () => {
  it('hashes each inline script body, byte for byte', () => {
    const html = '<script>\n  boot();\n</script><p></p><script type="module">start()</script>';
    assert.deepEqual(inlineScriptHashes(html), [sha('\n  boot();\n'), sha('start()')]);
  });

  it('ignores scripts loaded from a file and empty ones', () => {
    const html = '<script src="/app.js"></script><script> </script>';
    assert.deepEqual(inlineScriptHashes(html), []);
  });
});

describe('dashboardPolicy', () => {
  it('adds the hashes to script-src and nothing unsafe', () => {
    const policy = dashboardPolicy(["'sha256-abc'"]);
    assert.ok(policy.includes("script-src 'self' 'sha256-abc'"));
    assert.ok(!/script-src[^;]*unsafe-inline/.test(policy));
  });

  it('keeps script-src to self when the page has no inline script', () => {
    assert.ok(dashboardPolicy([]).includes("script-src 'self';"));
  });
});
