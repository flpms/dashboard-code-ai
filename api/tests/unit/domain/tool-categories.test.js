import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { categorizeCommand, categorizeTool } from '../../../app/v1/domain/tool-categories.js';

describe('categorizeTool', () => {
  it('maps known tools by name', () => {
    assert.equal(categorizeTool('Read'), 'read');
    assert.equal(categorizeTool('Write'), 'edit');
    assert.equal(categorizeTool('Agent'), 'agent');
    assert.equal(categorizeTool('Task'), 'agent');
    assert.equal(categorizeTool('Skill'), 'skill');
  });

  it('recognises MCP tools by prefix and unknown tools as other', () => {
    assert.equal(categorizeTool('mcp__github__create_issue'), 'mcp');
    assert.equal(categorizeTool('SomethingNew'), 'other');
  });

  it('refines Bash by the command it runs', () => {
    assert.equal(categorizeTool('Bash', { command: 'npm test' }), 'test');
    assert.equal(categorizeTool('Bash', { command: 'docker compose up -d' }), 'docker');
    assert.equal(categorizeTool('Bash', { command: 'git status' }), 'git');
    assert.equal(categorizeTool('Bash', { command: 'ls -la' }), 'shell');
    assert.equal(categorizeTool('Bash'), 'shell');
  });
});

describe('categorizeCommand', () => {
  it('counts a test run inside Docker as a test run', () => {
    assert.equal(categorizeCommand('docker compose run app npm test'), 'test');
  });

  it('knows the common runners', () => {
    ['npx vitest run', 'node --test', 'pnpm test:unit', 'pytest -q', 'go test ./...'].forEach(
      command => assert.equal(categorizeCommand(command), 'test', command)
    );
  });
});
