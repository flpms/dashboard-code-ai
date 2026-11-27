<script>
  import { baseName, formatDateTime } from '$lib/utils/format.js';

  /**
   * The sessions the collector has seen, most recent first, as the panorama
   * header of the live-tiles layout: the selected one is bright, the others
   * wait dimmed to its right. A session with activity in the last few minutes
   * and no end is marked live.
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

<nav aria-label="Sessões" class="min-w-0">
  {#if !sessions.length}
    <p class="text-sm font-light text-white/60">
      Nenhuma sessão ainda. Use o Claude Code nesta máquina: as sessões aparecem aqui sozinhas,
      inclusive as que já estavam abertas.
    </p>
  {/if}

  <ul class="flex items-end gap-x-7 overflow-x-auto pb-1">
    {#each sessions as session (session.id)}
      <li class="shrink-0">
        <button
          type="button"
          class="group flex flex-col items-start text-left text-white/40 transition-colors hover:text-white/75 aria-[current=true]:text-white"
          aria-current={selectedId === session.id}
          title={`${session.cwd ?? session.id} · ${formatDateTime(session.startedAt)} · ${session.eventCount} eventos`}
          onclick={() => onselect?.(session)}
        >
          <span class="flex items-center gap-2 text-[11px] font-light tracking-wide">
            {#if isLive(session)}
              <span class="h-1.5 w-1.5 bg-emerald-400" aria-hidden="true"></span>
              <span class="text-emerald-300">ao vivo</span>
            {/if}
            <span class="tabular-nums">{formatDateTime(session.startedAt)}</span>
          </span>
          <span
            class="font-display text-[28px] leading-tight font-extralight tracking-tight group-aria-[current=true]:text-[56px] group-aria-[current=true]:leading-none"
            >{baseName(session.cwd)}</span
          >
        </button>
      </li>
    {/each}
  </ul>
</nav>
