'use strict';

/**
 * Follows Claude Code's transcripts (~/.claude/projects/**\/*.jsonl) and hands
 * every new line to the collector, so sessions show up even without hooks.
 *
 *   <root>/<project>/<session>.jsonl                            main agent
 *   <root>/<project>/<session>/subagents/agent-<id>.jsonl       a subagent
 *   <root>/<project>/<session>/subagents/agent-<id>.meta.json   its type and launching call
 *
 * Only bytes appended since the last read are parsed. At boot, a transcript
 * written in the last `backfillMs` is read from the start (a session open
 * right now), unless the collector already knows that session; older ones
 * are followed from their end, so the history of every past session is not
 * imported each time the panel starts.
 *
 * `rescan` is the dashboard's refresh button: it walks the folder by hand,
 * which picks up anything the file watcher missed (a network or Docker mount
 * can drop events), reads what was appended since, and reads from the start a
 * transcript that is now inside the backfill window and belongs to a session
 * the collector has never seen.
 *
 * Reads are batched: Claude Code appends a few lines per step, and waiting a
 * moment lets the HTTP hook for the same step (when hooks are on) arrive
 * first, which is what tells the collector to ignore the transcript.
 */

const FLUSH_MS = 1_000;
const NEWLINE = 0x0a;

const SUBAGENT_FILE = /[\\/]([^\\/]+)[\\/]subagents[\\/]agent-([^\\/]+)\.jsonl$/;
const MAIN_FILE = /[\\/]([^\\/]+)\.jsonl$/;

/**
 * @param {string} path
 * @returns {{ sessionId: string, agentId: string|null } | null}
 */
export const transcriptFileOf = path => {
  const subagent = SUBAGENT_FILE.exec(path);
  if (subagent) return { sessionId: subagent[1], agentId: subagent[2] };
  const main = MAIN_FILE.exec(path);
  if (main) return { sessionId: main[1], agentId: null };
  return null;
};

// Directories are walked; of the files, only transcripts are read.
const isIgnored = (path, stats) => Boolean(stats?.isFile()) && !path.endsWith('.jsonl');

export const TranscriptWatcher = ({
  enabled,
  root,
  backfillMs,
  fs,
  join,
  Logger,
  watch,
  now = Date.now,
}) => {
  const files = new Map();
  const dirty = new Set();
  let watcher = null;
  let timer = null;
  let ready = false;
  let onEntry = () => {};
  let isKnownSession = () => false;

  const metaOf = path => {
    const file = path.replace(/\.jsonl$/, '.meta.json');
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  };

  const sourceOf = (path, file) => {
    if (!file.agentId) return { agentId: null, agentType: null, launchedBy: null };
    const meta = metaOf(path);
    return {
      agentId: file.agentId,
      agentType: meta?.agentType ?? null,
      launchedBy: meta?.toolUseId ?? null,
    };
  };

  const readNew = path => {
    const state = files.get(path);
    const file = transcriptFileOf(path);
    if (!state || !file) return;

    const { size } = fs.statSync(path);
    // Rewritten from scratch (or truncated): start over.
    if (size < state.offset) Object.assign(state, { offset: 0, partial: Buffer.alloc(0) });
    if (size === state.offset) return;

    const chunk = Buffer.alloc(size - state.offset);
    const fd = fs.openSync(path, 'r');
    try {
      fs.readSync(fd, chunk, 0, chunk.length, state.offset);
    } finally {
      fs.closeSync(fd);
    }
    state.offset = size;

    const buffer = Buffer.concat([state.partial, chunk]);
    const end = buffer.lastIndexOf(NEWLINE);
    state.partial = buffer.subarray(end + 1);
    if (end < 0) return;

    const source = sourceOf(path, file);
    buffer
      .subarray(0, end)
      .toString('utf8')
      .split('\n')
      .filter(line => line.trim())
      .forEach(line => {
        try {
          onEntry({ entry: JSON.parse(line), source });
        } catch (error) {
          Logger.verbose(`TranscriptWatcher::skip line in ${path} - ${error.message}`);
        }
      });
  };

  // Main transcripts first, so a subagent's launching call is already stored
  // when the subagent's first line arrives.
  const flush = () => {
    timer = null;
    const batch = [...dirty].sort(
      (a, b) =>
        Number(Boolean(transcriptFileOf(a)?.agentId)) -
        Number(Boolean(transcriptFileOf(b)?.agentId))
    );
    dirty.clear();
    batch.forEach(path => {
      try {
        readNew(path);
      } catch (error) {
        Logger.warn(`TranscriptWatcher::read ${path} - ${error.message}`);
      }
    });
  };

  const schedule = path => {
    dirty.add(path);
    if (!timer) timer = setTimeout(flush, FLUSH_MS);
  };

  const isRecentUnknown = (path, file, windowMs) =>
    !isKnownSession(file.sessionId) && now() - fs.statSync(path).mtimeMs <= windowMs;

  const shouldBackfill = (path, file, windowMs) => ready || isRecentUnknown(path, file, windowMs);

  // `fromStart` remembers whether the file was read from its first byte, so a
  // rescan with a wider window can go back for the ones that were not.
  const follow = (path, file, windowMs) => {
    const fromStart = shouldBackfill(path, file, windowMs);
    const offset = fromStart ? 0 : fs.statSync(path).size;
    files.set(path, { offset, fromStart, partial: Buffer.alloc(0) });
    return fromStart;
  };

  const onAdd = path => {
    const file = transcriptFileOf(path);
    if (!file || files.has(path)) return;
    if (follow(path, file, backfillMs)) schedule(path);
  };

  const listTranscripts = () => {
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root, { recursive: true })
      .map(relative => join(root, String(relative)))
      .filter(path => path.endsWith('.jsonl') && transcriptFileOf(path));
  };

  // What a rescan does with one file: whether it has anything to read.
  const revisit = (path, windowMs) => {
    const file = transcriptFileOf(path);
    const state = files.get(path);
    if (!state) return follow(path, file, windowMs);
    if (!state.fromStart && isRecentUnknown(path, file, windowMs)) {
      Object.assign(state, { offset: 0, fromStart: true, partial: Buffer.alloc(0) });
      return true;
    }
    return fs.statSync(path).size !== state.offset;
  };

  /**
   * @param {{ backfillMs?: number }} [options]  the window for this rescan
   * @returns {{ transcripts: number, read: number, newSessions: number }}
   */
  const rescan = ({ backfillMs: windowMs = backfillMs } = {}) => {
    clearTimeout(timer);
    const paths = listTranscripts();
    const toRead = paths.filter(path => {
      try {
        return revisit(path, windowMs);
      } catch (error) {
        Logger.warn(`TranscriptWatcher::rescan ${path} - ${error.message}`);
        return false;
      }
    });
    const fresh = new Set(
      toRead.map(path => transcriptFileOf(path)?.sessionId).filter(id => !isKnownSession(id))
    );
    toRead.forEach(path => dirty.add(path));
    flush();
    const newSessions = [...fresh].filter(id => isKnownSession(id)).length;
    Logger.info(
      `TranscriptWatcher::rescan read ${toRead.length} of ${paths.length} transcripts, ${newSessions} new sessions`
    );
    return { transcripts: paths.length, read: toRead.length, newSessions };
  };

  /**
   * @param {(line: { entry: Record<string, any>, source: object }) => void} handler
   * @param {{ isKnownSession?: (sessionId: string) => boolean }} [options]
   */
  const start = (handler, options = {}) => {
    onEntry = handler;
    isKnownSession = options.isKnownSession ?? isKnownSession;
    if (!enabled) return;

    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

    watcher = watch(root, { ignored: isIgnored, ignoreInitial: false, persistent: true });
    watcher.on('add', path => {
      try {
        onAdd(path);
      } catch (error) {
        Logger.warn(`TranscriptWatcher::add ${path} - ${error.message}`);
      }
    });
    watcher.on('change', path => files.has(path) && schedule(path));
    watcher.on('ready', () => {
      ready = true;
      Logger.info(`TranscriptWatcher::following ${files.size} transcripts in ${root}`);
    });
    watcher.on('error', error => Logger.warn(`TranscriptWatcher - ${error.message}`));
  };

  const stop = async () => {
    clearTimeout(timer);
    timer = null;
    await watcher?.close();
    watcher = null;
  };

  return { flush, rescan, start, stop };
};
