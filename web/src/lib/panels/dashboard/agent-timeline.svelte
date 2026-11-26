<script>
  import { CATEGORIES, categoryStyle } from '$lib/utils/categories.js';
  import { formatDuration } from '$lib/utils/format.js';

  /**
   * One lane per agent, subagents nested under the agent that launched them,
   * time running left to right — the flamegraph of the session. Every tool
   * call is a block as long as it took, coloured by category. Running calls
   * extend to `nowMs` and are drawn translucent.
   *
   * Props in, the selected span id out through `onselect`.
   *
   * @import { SessionModel, ToolSpan } from '$lib/types.js'
   * @type {{
   *   model: SessionModel,
   *   nowMs: number,
   *   selectedId?: string|null,
   *   onselect?: (span: ToolSpan) => void
   * }}
   */
  let { model, nowMs, selectedId = null, onselect } = $props();

  const LABEL_W = 184;
  const LANE_H = 30;
  const AXIS_H = 26;
  const PAD_RIGHT = 12;
  const INDENT = 14;
  const MIN_BLOCK = 3;
  const FALLBACK_WIDTH = 960;

  // Tick steps a person reads without arithmetic; the first that keeps the
  // axis under eight labels wins.
  const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].map(s => s * 1000);
  const MAX_TICKS = 8;

  let width = $state(0);

  const drawWidth = $derived(width || FALLBACK_WIDTH);
  const span = $derived(Math.max(model.range.endMs - model.range.startMs, 1000));
  const plotW = $derived(drawWidth - LABEL_W - PAD_RIGHT);
  const height = $derived(AXIS_H + Math.max(model.agents.length, 1) * LANE_H + 4);

  /** @param {number} ms */
  const x = ms => LABEL_W + ((ms - model.range.startMs) / span) * plotW;

  const step = $derived(TICK_STEPS.find(s => span / s <= MAX_TICKS) ?? TICK_STEPS.at(-1) ?? 1000);
  const ticks = $derived(Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => i * step));

  /** @param {number} offset */
  const tickLabel = offset => {
    const seconds = Math.round(offset / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };

  /** @param {ToolSpan} item */
  const endOf = item => item.endMs ?? nowMs;

  /** @param {ToolSpan} item */
  const blockWidth = item => Math.max(MIN_BLOCK, x(endOf(item)) - x(item.startMs));

  /** @param {ToolSpan} item */
  const describe = item =>
    `${item.name}: ${item.summary || categoryStyle(item.category).label}, ${formatDuration(endOf(item) - item.startMs)}${item.status === 'error' ? ', falhou' : ''}`;

  /** @param {ToolSpan} item */
  const strokeOf = item => {
    if (item.status === 'error') return 'stroke-red-500';
    if (selectedId === item.id) return 'stroke-white';
    return 'stroke-transparent';
  };

  /**
   * @param {KeyboardEvent} event
   * @param {ToolSpan} item
   */
  const onkey = (event, item) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onselect?.(item);
  };

  const usedCategories = $derived(
    Object.entries(CATEGORIES).filter(([key]) =>
      model.agents.some(agent => agent.spans.some(item => item.category === key))
    )
  );
</script>

<section
  class="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-4"
  aria-label="Timeline de agentes"
>
  <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
    <h2 class="text-xs font-medium tracking-wide text-slate-400 uppercase">Timeline de agentes</h2>
    <ul class="flex flex-wrap gap-3 text-xs text-slate-400" aria-label="Legenda">
      {#each usedCategories as [key, style] (key)}
        <li class="flex items-center gap-1">
          <span class={`h-2.5 w-2.5 rounded-sm ${style.swatch}`} aria-hidden="true"></span>
          {style.label}
        </li>
      {/each}
    </ul>
  </div>

  {#if !model.agents.length}
    <p class="py-8 text-center text-sm text-slate-500">
      Nenhuma atividade registrada nesta sessão ainda.
    </p>
  {/if}

  {#if model.agents.length}
    <div class="overflow-x-auto" bind:clientWidth={width}>
      <svg width={drawWidth} {height} role="group" aria-label="Chamadas de ferramenta por agente">
        <g aria-hidden="true">
          {#each ticks as offset (offset)}
            <line
              x1={x(model.range.startMs + offset)}
              x2={x(model.range.startMs + offset)}
              y1={AXIS_H - 6}
              y2={height}
              class="stroke-slate-800"
            />
            <text
              x={x(model.range.startMs + offset)}
              y={AXIS_H - 10}
              text-anchor="middle"
              class="fill-slate-500 text-[10px] tabular-nums">{tickLabel(offset)}</text
            >
          {/each}
        </g>

        {#each model.agents as agent, lane (agent.id)}
          {@const y = AXIS_H + lane * LANE_H}
          <g>
            <rect
              x="0"
              {y}
              width={drawWidth}
              height={LANE_H}
              class={lane % 2 ? 'fill-slate-900' : 'fill-slate-950/40'}
            />
            <text
              x={8 + agent.depth * INDENT}
              y={y + LANE_H / 2 + 4}
              class="fill-slate-300 text-xs"
            >
              {agent.depth ? '↳ ' : ''}{agent.type}{agent.endMs === null && agent.id !== 'main'
                ? ' •'
                : ''}
            </text>

            {#each agent.spans as item (item.id)}
              <g
                role="button"
                tabindex="0"
                aria-label={describe(item)}
                aria-pressed={selectedId === item.id}
                class="cursor-pointer outline-none focus-visible:[&>rect]:stroke-white"
                onclick={() => onselect?.(item)}
                onkeydown={event => onkey(event, item)}
              >
                <title>{describe(item)}</title>
                <rect
                  x={x(item.startMs)}
                  y={y + 5}
                  width={blockWidth(item)}
                  height={LANE_H - 10}
                  rx="2"
                  class={`${categoryStyle(item.category).fill} ${strokeOf(item)}`}
                  stroke-width="2"
                  fill-opacity={item.status === 'running' ? 0.45 : 0.9}
                />
              </g>
            {/each}
          </g>
        {/each}
      </svg>
    </div>
  {/if}
</section>
