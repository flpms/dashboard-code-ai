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

  const STREAM_LABELS = {
    connecting: { text: 'conectando…', dot: 'bg-slate-500' },
    open: { text: 'ao vivo', dot: 'bg-emerald-400' },
    error: { text: 'coletor offline', dot: 'bg-red-500' },
  };

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

<div class="grid min-h-[calc(100vh-3rem)] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
  <aside class="border-b border-slate-800 bg-slate-950 p-3 lg:border-r lg:border-b-0">
    <div class="mb-3 flex items-center gap-2 px-2 text-xs text-slate-400" role="status">
      <span class={`h-2 w-2 rounded-full ${STREAM_LABELS[streamStatus].dot}`} aria-hidden="true"
      ></span>
      {STREAM_LABELS[streamStatus].text}
    </div>

    {#if loadingSessions}
      <p class="px-2 text-sm text-slate-500">Carregando sessões…</p>
    {/if}

    {#if !loadingSessions}
      <SessionsList {sessions} {selectedId} {nowMs} onselect={selectSession} />
    {/if}
  </aside>

  <section class="flex min-w-0 flex-col gap-4 p-4">
    {#if failure}
      <p
        role="alert"
        class="rounded-md border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200"
      >
        {failure}
      </p>
    {/if}

    {#if selected}
      <div class="flex flex-wrap items-baseline gap-x-3">
        <h1 class="text-lg font-semibold text-slate-100">{baseName(selected.cwd)}</h1>
        <span class="truncate text-xs text-slate-500">{selected.cwd ?? ''} · {selected.id}</span>
        {#if loadingEvents}
          <span class="text-xs text-slate-500">carregando eventos…</span>
        {/if}
      </div>

      <InstrumentsBar {model} cwd={selected.cwd} />

      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <AgentTimeline {model} {nowMs} selectedId={selectedSpanId} onselect={selectSpan} />
        <SpanDetails
          span={selectedSpan}
          agentLabel={selectedSpan ? (agentsById.get(selectedSpan.agentId)?.type ?? '') : ''}
          {nowMs}
        />
      </div>
    {/if}

    {#if !selected && !loadingSessions && !failure}
      <div
        class="rounded-lg border border-dashed border-slate-700 p-12 text-center text-sm text-slate-400"
      >
        Nenhuma sessão registrada. Instale os hooks e abra uma sessão do Claude Code.
      </div>
    {/if}
  </section>
</div>
