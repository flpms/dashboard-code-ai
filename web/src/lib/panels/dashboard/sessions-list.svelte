<script>
  import { baseName, formatDateTime } from '$lib/utils/format.js';

  /**
   * The sessions the collector has seen, most recent first. A session with
   * activity in the last few minutes and no end is marked live.
   *
   * @import { SessionSummary } from '$lib/types.js'
   * @type {{
   *   sessions: SessionSummary[],
   *   selectedId?: string|null,
   *   nowMs: number,
   *   onselect?: (session: SessionSummary) => void
   * }}
   */
  let { sessions, selectedId = null, nowMs, onselect } = $props();

  const LIVE_WINDOW_MS = 5 * 60_000;

  /** @param {SessionSummary} session */
  const isLive = session =>
    !session.endedAt && nowMs - Date.parse(session.lastEventAt) < LIVE_WINDOW_MS;
</script>

<nav aria-label="Sessões" class="flex flex-col gap-1">
  <h2 class="px-2 pb-1 text-xs font-medium tracking-wide text-slate-400 uppercase">Sessões</h2>

  {#if !sessions.length}
    <p class="px-2 text-sm text-slate-500">
      Nenhuma sessão ainda. Rode <code class="text-slate-300">npm run hooks:install</code> na pasta
      <code class="text-slate-300">api</code> e abra o Claude Code.
    </p>
  {/if}

  {#each sessions as session (session.id)}
    <button
      type="button"
      class="flex flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left hover:bg-slate-800 aria-[current=true]:bg-slate-800"
      aria-current={selectedId === session.id}
      onclick={() => onselect?.(session)}
    >
      <span class="flex w-full items-center gap-2 text-sm text-slate-100">
        <span
          class={isLive(session)
            ? 'h-2 w-2 rounded-full bg-emerald-400'
            : 'h-2 w-2 rounded-full bg-slate-600'}
          aria-hidden="true"
        ></span>
        <span class="truncate" title={session.cwd ?? session.id}>{baseName(session.cwd)}</span>
        {#if isLive(session)}
          <span class="ml-auto text-xs text-emerald-300">ao vivo</span>
        {/if}
      </span>
      <span class="text-xs text-slate-500">
        {formatDateTime(session.startedAt)} · {session.eventCount} eventos
      </span>
    </button>
  {/each}
</nav>
