<script>
  import { categoryStyle } from '$lib/utils/categories.js';
  import { formatClock, formatDuration } from '$lib/utils/format.js';

  /**
   * What one tool call did: the read-only answer to "what is this block?".
   *
   * @import { ToolSpan } from '$lib/types.js'
   * @type {{ span: ToolSpan|null, agentLabel?: string, nowMs: number }}
   */
  let { span, agentLabel = '', nowMs } = $props();

  const STATUS_LABELS = { running: 'rodando', ok: 'concluída', error: 'falhou' };
  const STATUS_CLASSES = {
    running: 'text-sky-300',
    ok: 'text-emerald-300',
    error: 'text-red-300',
  };
</script>

<section
  class="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-4"
  aria-label="Detalhes da chamada"
>
  <h2 class="mb-3 text-xs font-medium tracking-wide text-slate-400 uppercase">
    Detalhes da chamada
  </h2>

  {#if !span}
    <p class="text-sm text-slate-500">
      Clique em um bloco da timeline para ver o que a chamada fez.
    </p>
  {/if}

  {#if span}
    <div class="flex flex-col gap-3 text-sm">
      <div class="flex flex-wrap items-center gap-2">
        <span class={`h-3 w-3 rounded-sm ${categoryStyle(span.category).swatch}`} aria-hidden="true"
        ></span>
        <span class="font-semibold text-slate-100">{span.name}</span>
        <span class="text-slate-400">{categoryStyle(span.category).label}</span>
        <span class={STATUS_CLASSES[span.status]}>{STATUS_LABELS[span.status]}</span>
      </div>

      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt class="text-slate-500">Agente</dt>
        <dd class="text-slate-300">{agentLabel || span.agentId}</dd>
        <dt class="text-slate-500">Início</dt>
        <dd class="text-slate-300 tabular-nums">{formatClock(span.startMs)}</dd>
        <dt class="text-slate-500">Duração</dt>
        <dd class="text-slate-300 tabular-nums">
          {formatDuration((span.endMs ?? nowMs) - span.startMs)}
        </dd>
        <dt class="text-slate-500">Resumo</dt>
        <dd class="break-all text-slate-300">{span.summary || '—'}</dd>
      </dl>

      <div>
        <h3 class="mb-1 text-xs text-slate-500">Entrada</h3>
        <pre
          class="max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs whitespace-pre-wrap text-slate-300">{span.input ||
            '—'}</pre>
      </div>
      <div>
        <h3 class="mb-1 text-xs text-slate-500">Saída</h3>
        <pre
          class="max-h-60 overflow-auto rounded bg-slate-950 p-2 text-xs whitespace-pre-wrap text-slate-300">{span.output ||
            '—'}</pre>
      </div>
    </div>
  {/if}
</section>
