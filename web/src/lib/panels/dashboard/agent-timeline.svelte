<script>
  import Tile from '$lib/components/ui/tile.svelte';
  import { CATEGORIES, categoryStyle } from '$lib/utils/categories.js';
  import { formatDuration } from '$lib/utils/format.js';

  /**
   * One lane per agent, subagents nested under the agent that launched them,
   * time running left to right — the flamegraph of the session. Every tool
   * call is a block as long as it took, coloured by category. Running calls
   * extend to `nowMs` and are drawn striped, so "still going" reads without
   * a legend.
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

  // Narrow screens give the plot the room the lane names would take.
  const NARROW = 640;
  const LANE_H = 56;
  const LANE_GAP = 6;
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

  const LABEL_W = $derived(width && width < NARROW ? 112 : 168);

  const drawWidth = $derived(width || FALLBACK_WIDTH);
  const span = $derived(Math.max(model.range.endMs - model.range.startMs, 1000));
  const plotW = $derived(drawWidth - LABEL_W - PAD_RIGHT);
  const height = $derived(AXIS_H + Math.max(model.agents.length, 1) * (LANE_H + LANE_GAP));

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
    if (item.status === 'error') return 'stroke-red-400';
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

<Tile label="Timeline de agentes" heading="top" class="min-h-[420px]">
  <ul class="flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-white/70" aria-label="Legenda">
    {#each usedCategories as [key, style] (key)}
      <li class="flex items-center gap-1.5">
        <span class={`h-2.5 w-2.5 ${style.swatch}`} aria-hidden="true"></span>
        {style.label}
      </li>
    {/each}
  </ul>

  {#if !model.agents.length}
    <p class="py-8 text-center text-sm font-light text-white/60">
      Nenhuma atividade registrada nesta sessão ainda.
    </p>
  {/if}

  {#if model.agents.length}
    <div class="overflow-x-auto" bind:clientWidth={width}>
      <svg width={drawWidth} {height} role="group" aria-label="Chamadas de ferramenta por agente">
        <defs>
          <!-- Running calls show through vertical slats: a mask, so one pattern
               serves every category colour. -->
          <pattern id="running-slats" width="9" height="8" patternUnits="userSpaceOnUse">
            <rect width="6" height="8" fill="white" />
          </pattern>
          <mask id="running-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={drawWidth} {height}>
            <rect width={drawWidth} {height} fill="url(#running-slats)" />
          </mask>
        </defs>

        <g aria-hidden="true">
          {#each ticks as offset (offset)}
            <text
              x={x(model.range.startMs + offset)}
              y={AXIS_H - 10}
              text-anchor="middle"
              class="fill-white/45 text-[11px] font-light tabular-nums">{tickLabel(offset)}</text
            >
          {/each}
        </g>

        {#each model.agents as agent, lane (agent.id)}
          {@const y = AXIS_H + lane * (LANE_H + LANE_GAP)}
          <g>
            <rect x={LABEL_W} {y} width={plotW} height={LANE_H} class="fill-white/[0.04]" />
            <text
              x={agent.depth * INDENT}
              y={y + LANE_H / 2 + 4}
              class="fill-white text-[13px] font-light"
            >
              <tspan class="fill-white/45">{agent.depth ? '↳ ' : ''}</tspan
              >{agent.type}{agent.endMs === null && agent.id !== 'main' ? ' •' : ''}
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
                  x={x(item.startMs) + 1.5}
                  y={y + 1.5}
                  width={Math.max(MIN_BLOCK, blockWidth(item) - 3)}
                  height={LANE_H - 3}
                  class={`${categoryStyle(item.category).fill} ${strokeOf(item)}`}
                  stroke-width="3"
                  mask={item.status === 'running' ? 'url(#running-mask)' : undefined}
                />
              </g>
            {/each}
          </g>
        {/each}
      </svg>
    </div>
  {/if}
</Tile>
