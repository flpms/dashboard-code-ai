import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  TranscriptWatcher,
  transcriptFileOf,
} from '../../../app/services/transcript-watcher.service.js';
import { fakeLogger } from '../../helpers/fakes.js';

const fixture = name =>
  fs.readFileSync(new URL(`../../fixtures/transcript/${name}`, import.meta.url), 'utf8');

const SESSION = '5f1c2e9a-0000-4000-8000-000000000001';
const HOUR = 3_600_000;

let root;
let emitter;
let received;

const fakeWatch = () => {
  emitter = new EventEmitter();
  emitter.close = async () => {};
  return emitter;
};

const watcher = (options = {}) =>
  TranscriptWatcher({
    enabled: true,
    root,
    backfillMs: HOUR,
    fs,
    join,
    Logger: fakeLogger(),
    watch: fakeWatch,
    ...options,
  });

const mainPath = () => join(root, '-home-dev-shop-api', `${SESSION}.jsonl`);
const subagentPath = () =>
  join(root, '-home-dev-shop-api', SESSION, 'subagents', 'agent-abc123.jsonl');

beforeEach(() => {
  root = fs.mkdtempSync(join(tmpdir(), 'transcripts-'));
  fs.mkdirSync(join(root, '-home-dev-shop-api', SESSION, 'subagents'), { recursive: true });
  received = [];
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('transcriptFileOf', () => {
  it('tells a session transcript from a subagent transcript', () => {
    assert.deepEqual(transcriptFileOf('/r/p/abc.jsonl'), { sessionId: 'abc', agentId: null });
    assert.deepEqual(transcriptFileOf('/r/p/abc/subagents/agent-x1.jsonl'), {
      sessionId: 'abc',
      agentId: 'x1',
    });
    assert.equal(transcriptFileOf('/r/p/abc/subagents/agent-x1.meta.json'), null);
  });
});

describe('TranscriptWatcher', () => {
  it('reads a recently written transcript from its start at boot', () => {
    fs.writeFileSync(mainPath(), fixture('main.jsonl'));
    const transcripts = watcher();
    transcripts.start(line => received.push(line));

    emitter.emit('add', mainPath());
    transcripts.flush();

    assert.equal(received.length, fixture('main.jsonl').trim().split('\n').length);
    assert.equal(received[0].source.agentId, null);
  });

  it('follows an old or already known transcript from its end only', () => {
    fs.writeFileSync(mainPath(), fixture('main.jsonl'));
    const transcripts = watcher();
    transcripts.start(line => received.push(line), { isKnownSession: () => true });

    emitter.emit('add', mainPath());
    transcripts.flush();
    assert.equal(received.length, 0);

    fs.appendFileSync(mainPath(), `${JSON.stringify({ type: 'user', sessionId: SESSION })}\n`);
    emitter.emit('change', mainPath());
    transcripts.flush();
    assert.equal(received.length, 1);
  });

  it('waits for the rest of a line that is still being written', () => {
    const transcripts = watcher();
    transcripts.start(line => received.push(line));
    emitter.emit('ready');

    fs.writeFileSync(mainPath(), '{"type":"user","sess');
    emitter.emit('add', mainPath());
    transcripts.flush();
    assert.equal(received.length, 0);

    fs.appendFileSync(mainPath(), `ionId":"${SESSION}"}\n`);
    emitter.emit('change', mainPath());
    transcripts.flush();
    assert.equal(received[0].entry.sessionId, SESSION);
  });

  it('names the subagent, its type and its launching call from the meta file', () => {
    fs.writeFileSync(subagentPath(), fixture('subagent.jsonl'));
    fs.writeFileSync(subagentPath().replace('.jsonl', '.meta.json'), fixture('subagent.meta.json'));
    const transcripts = watcher();
    transcripts.start(line => received.push(line));

    emitter.emit('add', subagentPath());
    transcripts.flush();

    assert.deepEqual(received[0].source, {
      agentId: 'abc123',
      agentType: 'Explore',
      launchedBy: 'toolu_agent',
    });
  });

  it('reads session transcripts before subagent ones in the same batch', () => {
    fs.writeFileSync(subagentPath(), fixture('subagent.jsonl'));
    fs.writeFileSync(mainPath(), fixture('main.jsonl'));
    const transcripts = watcher();
    transcripts.start(line => received.push(line));

    emitter.emit('add', subagentPath());
    emitter.emit('add', mainPath());
    transcripts.flush();

    assert.equal(received[0].source.agentId, null);
    assert.equal(received.at(-1).source.agentId, 'abc123');
  });

  it('skips a line that is not JSON and keeps going', () => {
    const transcripts = watcher();
    transcripts.start(line => received.push(line));
    emitter.emit('ready');

    fs.writeFileSync(
      mainPath(),
      `not json\n${JSON.stringify({ type: 'user', sessionId: SESSION })}\n`
    );
    emitter.emit('add', mainPath());
    transcripts.flush();

    assert.equal(received.length, 1);
  });
});

describe('TranscriptWatcher.rescan', () => {
  const lines = () => fixture('main.jsonl').trim().split('\n').length;

  // A session counts as known once one of its lines reached the collector.
  const startTracking = transcripts => {
    const known = new Set();
    transcripts.start(
      line => {
        received.push(line);
        known.add(SESSION);
      },
      { isKnownSession: id => known.has(id) }
    );
  };

  it('picks up a transcript the file watcher never announced', () => {
    fs.writeFileSync(mainPath(), fixture('main.jsonl'));
    const transcripts = watcher();
    startTracking(transcripts);
    emitter.emit('ready');

    assert.deepEqual(transcripts.rescan(), { transcripts: 1, read: 1, newSessions: 1 });
    assert.equal(received.length, lines());
    assert.deepEqual(transcripts.rescan(), { transcripts: 1, read: 0, newSessions: 0 });
  });

  it('reads lines appended without a change event', () => {
    fs.writeFileSync(mainPath(), fixture('main.jsonl'));
    const transcripts = watcher();
    startTracking(transcripts);
    emitter.emit('add', mainPath());
    transcripts.flush();

    fs.appendFileSync(mainPath(), `${JSON.stringify({ type: 'user', sessionId: SESSION })}\n`);
    assert.equal(transcripts.rescan().read, 1);
    assert.equal(received.length, lines() + 1);
  });

  it('goes back for an older session once the window covers it', () => {
    fs.writeFileSync(mainPath(), fixture('main.jsonl'));
    const threeHoursAgo = new Date(Date.now() - 3 * HOUR);
    fs.utimesSync(mainPath(), threeHoursAgo, threeHoursAgo);
    const transcripts = watcher();
    startTracking(transcripts);
    emitter.emit('add', mainPath());
    transcripts.flush();
    assert.equal(received.length, 0);

    assert.equal(transcripts.rescan().read, 0);
    assert.deepEqual(transcripts.rescan({ backfillMs: 4 * HOUR }), {
      transcripts: 1,
      read: 1,
      newSessions: 1,
    });
    assert.equal(received.length, lines());
  });

  it('finds nothing when Claude Code has no projects folder yet', () => {
    const transcripts = watcher({ root: join(root, 'missing') });
    assert.deepEqual(transcripts.rescan(), { transcripts: 0, read: 0, newSessions: 0 });
  });
});
