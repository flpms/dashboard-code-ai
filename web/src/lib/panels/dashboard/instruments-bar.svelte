<script>
  import Reading from '$lib/components/ui/reading.svelte';
  import Tile from '$lib/components/ui/tile.svelte';
  import { safeLink, shortPath } from '$lib/utils/format.js';

  /**
   * The wall of live tiles at the top: one reading per instrument, taken in at
   * a glance like the gauges in a cockpit. A tile keeps its instrument's tint
   * until it has something to say; failing tests, a known CVE or an alert
   * switch it to a signal tint. Props in, nothing out.
   *
   * @import { SessionModel } from '$lib/types.js'
   * @type {{ model: SessionModel, cwd?: string|null }}
   */
  let { model, cwd = null } = $props();

  // Lights are white on tinted glass: lit means "up", hollow means "not".
  const CONTAINER_LIGHTS = Object.freeze({
    running: { light: 'bg-white', label: 'rodando' },
    stopped: { light: 'bg-white/30', label: 'parado' },
    failed: { light: 'bg-red-300 ring-2 ring-red-200/60', label: 'caiu' },
  });

  const SEVERITIES = Object.freeze([
    { key: 'critical', label: 'crítica' },
    { key: 'high', label: 'alta' },
    { key: 'moderate', label: 'média' },
    { key: 'low', label: 'baixa' },
  ]);

  // The worst severities get a solid mark, the rest a faint one.
  const SEVERITY_MARKS = Object.freeze({
    critical: 'bg-white',
    high: 'bg-white',
    moderate: 'bg-white/45',
    low: 'bg-white/25',
    info: 'bg-white/25',
  });

  /**
   * Grid placement. On a wide screen the wall is ten columns: tests and
   * security are the 2×2 anchors at each end, the rest fill between them.
   */
  const PLACEMENT = Object.freeze({
    tests: 'md:col-span-2 md:row-span-2',
    agents: 'md:col-span-2',
    containers: 'md:col-span-2',
    alerts: 'md:col-span-2 xl:col-span-1',
    security: 'md:col-span-2 md:row-span-2 xl:col-span-3',
    files: 'md:col-span-2 xl:col-span-3',
    resources: 'md:col-span-2',
  });

  const security = $derived(model.security);

  /** @returns {'neutral'|'security'|'warning'} */
  const securityTintOf = () => {
    if (!security?.total) return 'neutral';
    if (security.counts.critical || security.counts.high) return 'security';
    return 'warning';
  };

  const subagents = $derived(model.agents.filter(agent => agent.id !== 'main'));
  const running = $derived(model.containers.filter(c => c.state === 'running').length);
  const lastRun = $derived(model.tests.at(-1));
  const recentRuns = $derived(model.tests.slice(-10));
  const resources = $derived([
    ...model.resources.skills.map(item => ({ ...item, kind: 'skill' })),
    ...model.resources.mcp.map(item => ({ ...item, kind: 'mcp' })),
    ...model.resources.agentTypes.map(item => ({ ...item, kind: 'agente' })),
  ]);
  const highest = $derived(Math.max(1, ...recentRuns.map(run => run.passed + run.failed)));

  const testTint = $derived(lastRun?.failed ? 'critical' : 'tests');

  // The worst level present sets the tint; no alert at all stays quiet.
  const ALERT_TINTS = Object.freeze({ critical: 'critical', warning: 'alerts', none: 'neutral' });
  const alertLevel = $derived(
    /** @type {const} */ (['critical', 'warning']).find(level =>
      model.alerts.some(alert => alert.level === level)
    ) ?? 'none'
  );
</script>

<div
  class="grid grid-flow-row-dense grid-cols-1 gap-2 md:auto-rows-[200px] md:grid-cols-4 xl:grid-cols-10"
>
  <Tile label="Testes" tint={testTint} class={PLACEMENT.tests}>
    <Reading value={lastRun ? lastRun.passed : '—'} size="lg" />
    <p class="text-[15px] leading-snug font-light">
      {lastRun ? `passaram · ${lastRun.failed} falharam` : 'sem execução'}
      <span class="block text-[13px] opacity-70">
        {lastRun
          ? `${lastRun.runner} · ${model.tests.length} execuções`
          : 'nenhum runner detectado'}
      </span>
    </p>
    {#if recentRuns.length}
      <div
        class="mt-auto flex h-16 items-end gap-1.5"
        role="img"
        aria-label="Últimas execuções de teste"
      >
        {#each recentRuns as run, index (index)}
          <span
            class={run.failed ? 'w-5 bg-white/35' : 'w-5 bg-white/85'}
            style={`height: ${Math.max(15, ((run.passed + run.failed) / highest) * 100)}%`}
            title={`${run.passed} passaram, ${run.failed} falharam`}
          ></span>
        {/each}
      </div>
    {/if}
  </Tile>

  <Tile label="Agentes" tint="agents" class={PLACEMENT.agents}>
    <Reading
      value={model.activeAgents}
      unit={`ativo${model.activeAgents === 1 ? '' : 's'} de ${subagents.length}`}
    />
    <ul class="flex flex-col gap-0.5 text-[12.5px]">
      {#each subagents.slice(-3) as agent (agent.id)}
        <li class="flex min-w-0 items-center gap-2">
          <span
            class={agent.endMs === null
              ? 'h-1.5 w-1.5 shrink-0 bg-white'
              : 'h-1.5 w-1.5 shrink-0 bg-white/35'}
            aria-hidden="true"
          ></span>
          <span class="truncate">{agent.type}</span>
          <span class="ml-auto shrink-0 text-[11.5px] opacity-75">
            {agent.endMs === null ? 'rodando' : 'terminou'}
          </span>
        </li>
      {/each}
    </ul>
  </Tile>

  <Tile label="Containers" tint="containers" class={PLACEMENT.containers}>
    <Reading value={running} unit={`de pé · ${model.containers.length} vistos`} />
    <ul class="flex flex-col gap-0.5 text-[12.5px]">
      {#each model.containers.slice(0, 3) as container (container.id)}
        <li class="flex min-w-0 items-center gap-2">
          <span
            class={`h-1.5 w-1.5 shrink-0 ${CONTAINER_LIGHTS[container.state].light}`}
            aria-hidden="true"
          ></span>
          <span class="truncate" title={container.image}>{container.name}</span>
          <span class="ml-auto shrink-0 text-[11.5px] opacity-75">
            {CONTAINER_LIGHTS[container.state].label}
          </span>
        </li>
      {/each}
    </ul>
  </Tile>

  <Tile label="Alertas" tint={ALERT_TINTS[alertLevel]} class={PLACEMENT.alerts}>
    <Reading value={model.alerts.length} class="text-[44px]" />
    <ul class="flex min-h-0 flex-col gap-1 overflow-hidden text-[11.5px] leading-tight" role="list">
      {#each model.alerts.slice(0, 3) as alert, index (index)}
        <li class="line-clamp-3">{alert.message}</li>
      {/each}
    </ul>
  </Tile>

  <Tile label="Segurança" tint={securityTintOf()} class={PLACEMENT.security}>
    <Reading
      value={security ? security.total : '—'}
      unit={security ? `vulnerab. · ${security.tool} audit` : 'sem auditoria'}
    />
    {#if !security}
      <p class="text-[13px] font-light opacity-80">
        Precisa de um package-lock.json na pasta da sessão.
      </p>
    {/if}
    {#if security}
      <ul class="grid grid-cols-4 gap-1" aria-label="Por severidade">
        {#each SEVERITIES as level (level.key)}
          <li class="bg-black/20 px-2 py-1.5 text-xs font-light">
            <span class="font-display block text-3xl font-extralight tabular-nums">
              {security.counts[level.key] ?? 0}
            </span>
            {level.label}
          </li>
        {/each}
      </ul>
      <ul class="flex flex-col gap-1.5 overflow-hidden text-[13px]">
        {#each security.advisories.slice(0, 4) as advisory (advisory.url || advisory.title)}
          <li class="flex min-w-0 items-start gap-2">
            <span
              class={`mt-1.5 h-2 w-2 shrink-0 ${SEVERITY_MARKS[advisory.severity] ?? 'bg-white/25'}`}
              aria-hidden="true"
            ></span>
            <!-- An external advisory page, not an app route: resolve() does not apply. -->
            <!-- eslint-disable svelte/no-navigation-without-resolve -->
            <a
              href={safeLink(advisory.url)}
              target="_blank"
              rel="noreferrer"
              class="truncate hover:underline"
              title={advisory.title}>{advisory.package}: {advisory.title}</a
            >
            <!-- eslint-enable svelte/no-navigation-without-resolve -->
          </li>
        {/each}
      </ul>
    {/if}
  </Tile>

  <Tile label="Arquivos" tint="files" class={PLACEMENT.files}>
    <Reading value={model.filesChanged.length} unit={`alterados · ${model.filesRead} lidos`} />
    <ul class="flex flex-col gap-0.5 font-mono text-xs">
      {#each model.filesChanged.slice(0, 3) as file (file.path)}
        <li class="flex min-w-0 items-center gap-2" title={file.path}>
          <span class="truncate">{shortPath(file.path, cwd)}</span>
          <span class="ml-auto shrink-0 tabular-nums opacity-75">{file.changes}×</span>
        </li>
      {/each}
    </ul>
  </Tile>

  <Tile label="Recursos" tint="resources" class={PLACEMENT.resources}>
    <Reading value={resources.length} unit="em uso" />
    <ul class="flex min-h-0 flex-wrap gap-1 overflow-hidden text-[11.5px]">
      {#each resources as resource (`${resource.kind}:${resource.name}`)}
        <li class="bg-white/15 px-1.5 py-0.5">
          <span class="opacity-70">{resource.kind}</span>
          {resource.name} <span class="opacity-70">×{resource.count}</span>
        </li>
      {/each}
    </ul>
  </Tile>
</div>
