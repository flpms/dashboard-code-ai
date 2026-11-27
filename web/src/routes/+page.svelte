<script>
  import AgentTimeline from '$panels/dashboard/agent-timeline.svelte';
  import InstrumentsBar from '$panels/dashboard/instruments-bar.svelte';
  import SessionsList from '$panels/dashboard/sessions-list.svelte';
  import SpanDetails from '$panels/dashboard/span-details.svelte';
  import SettingsMenu from '$panels/settings/settings-menu.svelte';
  import Button from '$lib/components/ui/button.svelte';
  import { eventSchema, settingsSchema, validate } from '$schemas/index.js';
  import { ApiClient, ApiError } from '$services/api-client.js';
  import { SessionsService } from '$services/sessions.service.js';
  import { SettingsService } from '$services/settings.service.js';
  import { buildSessionModel } from '$lib/utils/session-model.js';
  import { baseName } from '$lib/utils/format.js';

  /**
   * The dashboard. The page is the only layer that knows about all the others:
   * it builds the service, holds the event log of the selected session, keeps
   * the live stream open, and hands a derived model down to the panels.
   *
   * The event log is the state; everything drawn is `buildSessionModel(log)`.
   *
   * @import { CollectorEvent, CollectorSettings, SessionSummary, ToolSpan } from '$lib/types.js'
   */
  const client = ApiClient();
  const sessionsService = SessionsService(client);
  const settingsService = SettingsService(client);

  /** Anything thrown can be anything. Narrow once, here. @param {unknown} error */
  const reasonFor = error => (error instanceof Error ? error.message : 'Erro inesperado.');

  const STREAM_LABELS = Object.freeze({
    connecting: { text: 'conectando…', dot: 'bg-white/40' },
    open: { text: 'coletor conectado', dot: 'bg-emerald-400' },
    error: { text: 'coletor offline', dot: 'bg-red-500' },
  });

  /** @param {number} count */
  const refreshNoticeFor = count =>
    ({ 0: 'nenhuma sessão nova', 1: '1 sessão nova' })[count] ?? `${count} sessões novas`;

  // What the person is told when a settings call fails, by status; the rest
  // falls back to the API client's message.
  /** @type {Record<number, string>} */
  const SETTINGS_FAILURES = {
    422: 'O settings.json do Claude Code não é um JSON válido. Corrija o arquivo à mão e tente de novo.',
  };

  /** @param {unknown} error */
  const settingsFailureFor = error =>
    (error instanceof ApiError && SETTINGS_FAILURES[error.status]) || reasonFor(error);

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
  let refreshing = $state(false);
  let refreshNotice = $state('');

  let settingsOpen = $state(false);
  /** @type {CollectorSettings|null} */
  let settingsView = $state(null);
  /** @type {''|'load'|'save'|'install'|'remove'} */
  let settingsBusy = $state('');
  let settingsNotice = $state('');
  let settingsError = $state('');
  /** @type {Record<string, string>} */
  let settingsErrors = $state({});

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

  // Rescans Claude Code's transcripts; what it finds arrives through the stream.
  const refresh = async () => {
    refreshing = true;
    refreshNotice = '';
    try {
      const result = await sessionsService.refresh();
      await loadSessions();
      refreshNotice = refreshNoticeFor(result.newSessions);
    } catch (error) {
      console.error('[DashboardPage.refresh]', error);
      failure = `Não foi possível atualizar as sessões: ${reasonFor(error)}`;
    } finally {
      refreshing = false;
    }
  };

  /**
   * One settings call: shows it as busy, keeps the fresh settings it returns
   * and reports both outcomes.
   *
   * @param {'load'|'save'|'install'|'remove'} busy
   * @param {() => Promise<CollectorSettings>} action
   * @param {string} notice  the confirmation, empty for a plain load
   */
  const runSettings = async (busy, action, notice) => {
    settingsBusy = busy;
    settingsNotice = '';
    settingsError = '';
    try {
      settingsView = await action();
      settingsNotice = notice;
    } catch (error) {
      console.error(`[DashboardPage.settings.${busy}]`, error);
      settingsError = settingsFailureFor(error);
    } finally {
      settingsBusy = '';
    }
  };

  const openSettings = () => {
    settingsOpen = true;
    settingsErrors = {};
    runSettings('load', settingsService.get, '');
  };

  /** @param {{ autoInstallHooks: boolean, backfillHours: number|string }} form */
  const saveSettings = form => {
    const result = validate(settingsSchema, form);
    if (!result.success) {
      settingsErrors = result.errors;
      return;
    }
    settingsErrors = {};
    runSettings('save', () => settingsService.update(result.data), 'Configurações salvas.');
  };

  const installHooks = () =>
    runSettings(
      'install',
      settingsService.installHooks,
      'Hooks instalados. Sessões novas do Claude Code já enviam eventos.'
    );

  const removeHooks = () =>
    runSettings(
      'remove',
      settingsService.removeHooks,
      'Hooks removidos e instalação automática desligada.'
    );

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
      <div class="flex items-center gap-2 pb-1">
        <Button variant="tile" size="sm" loading={refreshing} onclick={refresh}>
          {#if !refreshing}<span aria-hidden="true">↻</span>{/if}
          atualizar
        </Button>
        <Button
          variant="tile"
          size="sm"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onclick={openSettings}
        >
          <span aria-hidden="true">☰</span>
          configurações
        </Button>
      </div>
      <span class="flex items-center gap-2" role="status">
        <span class={`h-2 w-2 ${STREAM_LABELS[streamStatus].dot}`} aria-hidden="true"></span>
        {STREAM_LABELS[streamStatus].text}{refreshNotice ? ` · ${refreshNotice}` : ''}
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

    <!-- The timeline is what a person comes here to read, so it takes the top
         left, where the eye lands first; the instrument wall sits below it. -->
    <div class="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
      <AgentTimeline {model} {nowMs} selectedId={selectedSpanId} onselect={selectSpan} />
      <SpanDetails
        span={selectedSpan}
        agentLabel={selectedSpan ? (agentsById.get(selectedSpan.agentId)?.type ?? '') : ''}
        {nowMs}
      />
    </div>

    <InstrumentsBar {model} cwd={selected.cwd} />
  {/if}

  {#if !selected && !loadingSessions && !failure}
    <div class="glass-tile p-12 text-center text-sm font-light text-white/70">
      Nenhuma sessão registrada. Abra uma sessão do Claude Code ou toque em atualizar.
    </div>
  {/if}
</div>

<SettingsMenu
  open={settingsOpen}
  view={settingsView}
  busy={settingsBusy}
  notice={settingsNotice}
  error={settingsError}
  errors={settingsErrors}
  onclose={() => (settingsOpen = false)}
  onsave={saveSettings}
  oninstall={installHooks}
  onremove={removeHooks}
/>
