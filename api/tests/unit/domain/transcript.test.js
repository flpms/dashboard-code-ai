import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { TranscriptTranslator } from '../../../app/v1/domain/transcript.js';

const lines = name =>
  readFileSync(new URL(`../../fixtures/transcript/${name}`, import.meta.url), 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));

const MAIN = { agentId: null, agentType: null };
const EXPLORE = { agentId: 'abc123', agentType: 'Explore' };

const translateAll = (translator, entries, source) =>
  entries.flatMap(entry => translator.translate(entry, source));

const events = translated => translated.map(({ payload }) => payload.hook_event_name);

describe('TranscriptTranslator', () => {
  it('turns the main transcript into the hooks Claude Code would have sent', () => {
    const translated = translateAll(TranscriptTranslator(), lines('main.jsonl'), MAIN);

    assert.deepEqual(events(translated), [
      'UserPromptSubmit',
      'PreToolUse',
      'PreToolUse',
      'PostToolUseFailure',
      'PostToolUse',
      'Stop',
    ]);
  });

  it('keeps the time each line was written, not the time it was read', () => {
    const [prompt] = translateAll(TranscriptTranslator(), lines('main.jsonl'), MAIN);
    assert.equal(prompt.ts, '2026-11-27T10:00:01.000Z');
    assert.equal(prompt.payload.session_id, '5f1c2e9a-0000-4000-8000-000000000001');
    assert.equal(prompt.payload.cwd, '/home/dev/shop-api');
  });

  it('gives a tool result the name and input of the call that asked for it', () => {
    const translated = translateAll(TranscriptTranslator(), lines('main.jsonl'), MAIN);
    const failure = translated.find(
      ({ payload }) => payload.hook_event_name === 'PostToolUseFailure'
    );

    assert.equal(failure.payload.tool_name, 'Bash');
    assert.equal(failure.payload.tool_input.command, 'npm test -- orders');
    assert.match(failure.payload.error.stdout, /fail 2/);
  });

  it('skips meta lines, attachments and bookkeeping records', () => {
    const translated = translateAll(TranscriptTranslator(), lines('main.jsonl'), MAIN);
    const prompts = translated.filter(
      ({ payload }) => payload.hook_event_name === 'UserPromptSubmit'
    );
    assert.equal(prompts.length, 1);
  });

  it('ends a turn once even when its message spans several lines', () => {
    const translated = translateAll(TranscriptTranslator(), lines('main.jsonl'), MAIN);
    assert.equal(events(translated).filter(name => name === 'Stop').length, 1);
  });

  it('starts a subagent on its first line and tags its calls with its id and type', () => {
    const translated = translateAll(TranscriptTranslator(), lines('subagent.jsonl'), EXPLORE);

    assert.deepEqual(events(translated), ['SubagentStart', 'PreToolUse', 'PostToolUse']);
    assert.ok(translated.every(({ payload }) => payload.agent_id === 'abc123'));
    assert.ok(translated.every(({ payload }) => payload.agent_type === 'Explore'));
  });

  it('ends the subagent when the call that launched it returns', () => {
    const translator = TranscriptTranslator();
    const [prompt, ...rest] = lines('main.jsonl');
    translator.translate(prompt, MAIN);
    translator.linkSubagent('toolu_agent', { agentId: 'abc123', agentType: 'Explore' });

    const translated = translateAll(translator, rest, MAIN);
    const stop = translated.findIndex(({ payload }) => payload.hook_event_name === 'SubagentStop');
    const agentEnd = translated.findIndex(
      ({ payload }) => payload.hook_event_name === 'PostToolUse' && payload.tool_name === 'Agent'
    );

    assert.ok(stop >= 0 && stop < agentEnd);
    assert.equal(translated[stop].payload.agent_id, 'abc123');
  });

  it('ignores slash-command echoes as prompts', () => {
    const translated = TranscriptTranslator().translate(
      {
        type: 'user',
        sessionId: 's',
        timestamp: '2026-11-27T10:00:00.000Z',
        message: { content: '<command-name>/clear</command-name>' },
      },
      MAIN
    );
    assert.deepEqual(translated, []);
  });
});
