<script>
  import AgentTimeline from '$panels/dashboard/agent-timeline.svelte';
  import InstrumentsBar from '$panels/dashboard/instruments-bar.svelte';
  import SessionsList from '$panels/dashboard/sessions-list.svelte';
  import SpanDetails from '$panels/dashboard/span-details.svelte';
  import { eventSchema, validate } from '$schemas/index.js';
  import { ApiClient } from '$services/api-client.js';
  import { SessionsService } from '$services/sessions.service.js';
  import { buildSessionModel } from '$lib/utils/session-model.js';
  import { baseName } from '$lib/utils/format.js';

  /**
   * The dashboard. The page is the only layer that knows about all the others:
   * it builds the service, holds the event log of the selected session, keeps
   * the live stream open, and hands a derived model down to the panels.
   *
   * The event log is the state; everything drawn is `buildSessionModel(log)`.
   *
   * @import { CollectorEvent, SessionSummary, ToolSpan } from '$lib/types.js'
   */
  const sessionsService = SessionsService(ApiClient());

  /** Anything thrown can be anything. Narrow once, here. @param {unknown} error */
  const reasonFor = error => (error instanceof Error ? error.message : 'Erro inesperado.');

  const STREAM_LABELS = Object.freeze({
    connecting: { text: 'conectando…', dot: 'bg-white/40' },
    open: { text: 'coletor conectado', dot: 'bg-emerald-400' },
    error: { text: 'coletor offline', dot: 'bg-red-500' },
  });

  /** @type {SessionSummary[]} */
  let sessions = $state([]);
  /** @type {string|null} */
  let selectedId = $state(null);
  /** @type {CollectorEvent[]} */
  let events = $state([]);
  /** @type {string|null} */
  let selectedSpanId = $state(null);
  let loadingSessions = $state(true);
  let loadingEvents = $state(false);
  let failure = $state('');
  /** @type {'connecting'|'open'|'error'} */
  let streamStatus = $state('connecting');
  let nowMs = $state(Date.now());

  const selected = $derived(sessions.find(session => session.id === selectedId) ?? null);
  const model = $derived(buildSessionModel(events, nowMs));
  const agentsById = $derived(new Map(model.agents.map(agent => [agent.id, agent])));
  const selectedSpan = $derived(
    model.agents.flatMap(agent => agent.spans).find(span => span.id === selectedSpanId) ?? null
  );

  const loadSessions = async () => {
    try {
      sessions = await sessionsService.list();
      failure = '';
      if (!selectedId && sessions.length) selectedId = sessions[0].id;
    } catch (error) {
      console.error('[DashboardPage.loadSessions]', error);
      failure = `Não foi possível falar com o coletor: ${reasonFor(error)}`;
    } finally {
      loadingSessions = false;
    }
  };

  /** @param {string} sessionId */
  const loadEvents = async sessionId => {
    loadingEvents = true;
    try {
      const result = await sessionsService.events(sessionId);
      if (sessionId !== selectedId) return;
      events = result.events;
    } catch (error) {
      console.error('[DashboardPage.loadEvents]', error);
      failure = reasonFor(error);
    } finally {
      loadingEvents = false;
    }
  };

  // After the stream drops and comes back, fetch only what was missed.
  const catchUp = async () => {
    const sessionId = selectedId;
    if (!sessionId) return;
    const after = events.at(-1)?.seq ?? 0;
    try {
      const result = await sessionsService.events(sessionId, { after });
      if (sessionId !== selectedId) return;
      events = [...events, ...result.events.filter(event => event.seq > after)];
    } catch (error) {
      console.error('[DashboardPage.catchUp]', error);
    }
  };

  /** @param {CollectorEvent} event */
  const touchSession = event => {
    const known = sessions.some(session => session.id === event.sessionId);
    if (!known) return loadSessions();

    sessions = sessions.map(session =>
      session.id === event.sessionId
        ? { ...session, lastEventAt: event.ts, eventCount: session.eventCount + 1 }
        : session
    );
  };

  /** @param {unknown} raw */
  const onStreamEvent = raw => {
    const result = validate(eventSchema, raw);
    if (!result.success) {
      console.error('[DashboardPage.onStreamEvent] invalid event', result.errors);
      return;
    }

    const event = /** @type {CollectorEvent} */ (result.data);
    touchSession(event);

    if (event.sessionId !== selectedId) return;
    if (event.seq <= (events.at(-1)?.seq ?? 0)) return;
    events = [...events, event];
  };

  /** @param {'open'|'error'} status */
  const onStreamStatus = status => {
    const recovered = status === 'open' && streamStatus === 'error';
    streamStatus = status;
    if (recovered) {
      loadSessions();
      catchUp();
    }
  };

  /** @param {SessionSummary} session */
  const selectSession = session => {
    selectedId = session.id;
  };

  /** @param {ToolSpan} span */
  const selectSpan = span => {
    selectedSpanId = span.id;
  };

  $effect(() => {
    loadSessions();
    const close = sessionsService.stream(onStreamEvent, onStreamStatus);
    const ticker = setInterval(() => (nowMs = Date.now()), 1000);
    return () => {
      close();
      clearInterval(ticker);
    };
  });

  $effect(() => {
    const sessionId = selectedId;
    if (!sessionId) return;
    events = [];
    selectedSpanId = null;
    loadEvents(sessionId);
  });
</script>

<div class="flex flex-col gap-4 px-4 pt-2 pb-8 md:px-10">
  <div class="flex flex-wrap items-end gap-x-8 gap-y-3">
    {#if loadingSessions}
      <p class="font-display text-[28px] font-extralight text-white/50">carregando sessões…</p>
    {/if}

    {#if !loadingSessions}
      <SessionsList {sessions} {selectedId} {nowMs} onselect={selectSession} />
    {/if}

    <div
      class="ml-auto flex max-w-full min-w-0 flex-col items-end gap-0.5 pb-1 text-[13px] font-light text-white/65"
    >
      <span class="flex items-center gap-2" role="status">
        <span class={`h-2 w-2 ${STREAM_LABELS[streamStatus].dot}`} aria-hidden="true"></span>
        {STREAM_LABELS[streamStatus].text}
      </span>
      {#if selected}
        <span
          class="max-w-full truncate font-mono text-[11px] text-white/45 md:max-w-[28rem]"
          title={selected.id}
        >
          {selected.cwd ?? ''} · {selected.eventCount} eventos{loadingEvents
            ? ' · carregando…'
            : ''}
        </span>
      {/if}
    </div>
  </div>

  {#if failure}
    <p role="alert" class="glass-tile px-4 py-3 text-sm [--tile:var(--color-tile-critical)]">
      {failure}
    </p>
  {/if}

  {#if selected}
    <!-- The panorama header shows the name big; this keeps it the page's
         heading for screen readers and for anyone navigating by headings. -->
    <h1 class="sr-only">{baseName(selected.cwd)}</h1>

    <InstrumentsBar {model} cwd={selected.cwd} />

    <div class="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
      <AgentTimeline {model} {nowMs} selectedId={selectedSpanId} onselect={selectSpan} />
      <SpanDetails
        span={selectedSpan}
        agentLabel={selectedSpan ? (agentsById.get(selectedSpan.agentId)?.type ?? '') : ''}
        {nowMs}
      />
    </div>
  {/if}

  {#if !selected && !loadingSessions && !failure}
    <div class="glass-tile p-12 text-center text-sm font-light text-white/70">
      Nenhuma sessão registrada. Instale os hooks e abra uma sessão do Claude Code.
    </div>
  {/if}
</div>
