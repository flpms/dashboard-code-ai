<script>
  import Tile from '$lib/components/ui/tile.svelte';
  import { categoryStyle } from '$lib/utils/categories.js';
  import { formatClock, formatDuration } from '$lib/utils/format.js';

  /**
   * What one tool call did: the read-only answer to "what is this block?".
   *
   * @import { ToolSpan } from '$lib/types.js'
   * @type {{ span: ToolSpan|null, agentLabel?: string, nowMs: number }}
   */
  let { span, agentLabel = '', nowMs } = $props();

  const STATUS_LABELS = Object.freeze({ running: 'rodando', ok: 'concluída', error: 'falhou' });
  const STATUS_CLASSES = Object.freeze({
    running: 'text-sky-300',
    ok: 'text-emerald-300',
    error: 'text-red-300',
  });
</script>

<Tile label="Detalhes da chamada" heading="top">
  {#if !span}
    <p class="text-sm font-light text-white/60">
      Clique em um bloco da timeline para ver o que a chamada fez.
    </p>
  {/if}

  {#if span}
    <div class="flex min-w-0 flex-col gap-3 text-[13px] font-light">
      <p class="flex flex-wrap items-baseline gap-x-3">
        <span class="font-display text-[40px] leading-none font-extralight">{span.name}</span>
        <span class={`text-sm ${STATUS_CLASSES[span.status]}`}>{STATUS_LABELS[span.status]}</span>
      </p>

      <dl class="grid grid-cols-[5.5rem_1fr] gap-y-1">
        <dt class="text-white/55">Tipo</dt>
        <dd class="flex items-center gap-2">
          <span class={`h-2.5 w-2.5 ${categoryStyle(span.category).swatch}`} aria-hidden="true"
          ></span>
          {categoryStyle(span.category).label}
        </dd>
        <dt class="text-white/55">Agente</dt>
        <dd>{agentLabel || span.agentId}</dd>
        <dt class="text-white/55">Início</dt>
        <dd class="tabular-nums">{formatClock(span.startMs)}</dd>
        <dt class="text-white/55">Duração</dt>
        <dd class="tabular-nums">{formatDuration((span.endMs ?? nowMs) - span.startMs)}</dd>
        <dt class="text-white/55">Resumo</dt>
        <dd class="break-all">{span.summary || '—'}</dd>
      </dl>

      <div>
        <h3 class="mb-1 text-xs text-white/55 lowercase">Entrada</h3>
        <pre
          class="max-h-40 overflow-auto bg-black/35 px-3 py-2.5 font-mono text-xs whitespace-pre-wrap">{span.input ||
            '—'}</pre>
      </div>
      <div>
        <h3 class="mb-1 text-xs text-white/55 lowercase">Saída</h3>
        <pre
          class="max-h-60 overflow-auto bg-black/35 px-3 py-2.5 font-mono text-xs whitespace-pre-wrap">{span.output ||
            '—'}</pre>
      </div>
    </div>
  {/if}
</Tile>
