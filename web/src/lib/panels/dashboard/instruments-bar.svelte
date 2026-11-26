<script>
  import InstrumentCard from '$lib/components/instrument-card.svelte';
  import { shortPath } from '$lib/utils/format.js';

  /**
   * The fixed strip at the top: six readings a person takes in at a glance,
   * like the gauges in a cockpit. Props in, nothing out.
   *
   * @import { SessionModel } from '$lib/types.js'
   * @type {{ model: SessionModel, cwd?: string|null }}
   */
  let { model, cwd = null } = $props();

  const CONTAINER_LIGHTS = {
    running: { dot: 'bg-emerald-400', label: 'rodando' },
    stopped: { dot: 'bg-slate-500', label: 'parado' },
    failed: { dot: 'bg-red-500', label: 'caiu' },
  };

  const ALERT_DOTS = { warning: 'bg-amber-400', critical: 'bg-red-500' };

  const subagents = $derived(model.agents.filter(agent => agent.id !== 'main'));
  const running = $derived(model.containers.filter(c => c.state === 'running').length);
  const lastRun = $derived(model.tests.at(-1));
  const recentRuns = $derived(model.tests.slice(-10));
  const resources = $derived([
    ...model.resources.skills.map(item => ({ ...item, kind: 'skill' })),
    ...model.resources.mcp.map(item => ({ ...item, kind: 'mcp' })),
    ...model.resources.agentTypes.map(item => ({ ...item, kind: 'agente' })),
  ]);

  /** @param {{ passed: number, failed: number }} run */
  const total = run => Math.max(run.passed + run.failed, 1);

  /** @returns {'neutral'|'good'|'critical'} */
  const testToneOf = () => {
    if (!lastRun) return 'neutral';
    if (lastRun.failed > 0) return 'critical';
    return 'good';
  };

  const testTone = $derived(testToneOf());

  // The worst level present sets the tone; no alert at all reads as good.
  const alertTone = $derived(
    /** @type {const} */ (['critical', 'warning']).find(level =>
      model.alerts.some(alert => alert.level === level)
    ) ?? 'good'
  );
</script>

<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
  <InstrumentCard
    title="Agentes"
    value={`${model.activeAgents} ativos`}
    caption={`${subagents.length} subagentes na sessão`}
  >
    <ul class="flex flex-col gap-1 text-xs">
      {#each subagents.slice(-4) as agent (agent.id)}
        <li class="flex items-center gap-2 truncate text-slate-300">
          <span
            class={agent.endMs === null
              ? 'h-2 w-2 rounded-full bg-fuchsia-400'
              : 'h-2 w-2 rounded-full bg-slate-600'}
            aria-hidden="true"
          ></span>
          <span class="truncate">{agent.type}</span>
          <span class="ml-auto text-slate-500">{agent.endMs === null ? 'rodando' : 'terminou'}</span
          >
        </li>
      {/each}
    </ul>
  </InstrumentCard>

  <InstrumentCard
    title="Containers"
    value={`${running} de pé`}
    caption={`${model.containers.length} vistos na sessão`}
  >
    <ul class="flex flex-col gap-1 text-xs">
      {#each model.containers as container (container.id)}
        <li class="flex items-center gap-2 text-slate-300">
          <span
            class={`h-2 w-2 rounded-full ${CONTAINER_LIGHTS[container.state].dot}`}
            aria-hidden="true"
          ></span>
          <span class="truncate" title={container.image}>{container.name}</span>
          <span class="ml-auto text-slate-500">{CONTAINER_LIGHTS[container.state].label}</span>
        </li>
      {/each}
    </ul>
  </InstrumentCard>

  <InstrumentCard
    title="Testes"
    value={lastRun ? `${lastRun.passed} ✓ · ${lastRun.failed} ✗` : 'sem execução'}
    caption={lastRun
      ? `${lastRun.runner} · ${model.tests.length} execuções`
      : 'nenhum runner detectado'}
    tone={testTone}
  >
    {#if recentRuns.length}
      <div class="flex h-8 items-end gap-1" role="img" aria-label="Últimas execuções de teste">
        {#each recentRuns as run, index (index)}
          <span
            class={run.failed > 0 ? 'w-2 rounded-sm bg-red-400' : 'w-2 rounded-sm bg-emerald-400'}
            style={`height: ${Math.max(15, (run.passed / total(run)) * 100)}%`}
            title={`${run.passed} passaram, ${run.failed} falharam`}
          ></span>
        {/each}
      </div>
    {/if}
  </InstrumentCard>

  <InstrumentCard
    title="Arquivos"
    value={`${model.filesChanged.length} alterados`}
    caption={`${model.filesRead} lidos`}
  >
    <ul class="flex flex-col gap-1 text-xs">
      {#each model.filesChanged.slice(0, 5) as file (file.path)}
        <li class="flex items-center gap-2 text-slate-300" title={file.path}>
          <span class="truncate">{shortPath(file.path, cwd)}</span>
          <span class="ml-auto text-slate-500 tabular-nums">{file.changes}×</span>
        </li>
      {/each}
    </ul>
  </InstrumentCard>

  <InstrumentCard
    title="Recursos"
    value={`${resources.length} em uso`}
    caption="skills, MCPs e tipos de subagente"
  >
    <ul class="flex flex-wrap gap-1 text-xs">
      {#each resources as resource (`${resource.kind}:${resource.name}`)}
        <li class="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
          <span class="text-slate-500">{resource.kind}</span>
          {resource.name} <span class="text-slate-500">×{resource.count}</span>
        </li>
      {/each}
    </ul>
  </InstrumentCard>

  <InstrumentCard
    title="Alertas"
    value={model.alerts.length ? `${model.alerts.length}` : 'nenhum'}
    tone={alertTone}
  >
    <ul class="flex flex-col gap-1 text-xs" role="list">
      {#each model.alerts as alert, index (index)}
        <li class="flex items-start gap-2 text-slate-300">
          <span
            class={`mt-1 h-2 w-2 shrink-0 rounded-full ${ALERT_DOTS[alert.level]}`}
            aria-hidden="true"
          ></span>
          {alert.message}
        </li>
      {/each}
    </ul>
  </InstrumentCard>
</div>
