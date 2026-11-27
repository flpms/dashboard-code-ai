<script>
  import Button from '$lib/components/ui/button.svelte';
  import Tile from '$lib/components/ui/tile.svelte';

  /**
   * The side menu where the collector is configured. Props in, callbacks out:
   * the page loads the settings, validates the form and calls the API; this
   * panel only draws them and says what the person asked for.
   *
   * Three tiles, most used first: Claude Code's hooks (install or remove them
   * now), how sessions are captured (the two saved settings), and the
   * collector itself, which comes from the environment and is only shown.
   *
   * @import { CollectorSettings } from '$lib/types.js'
   * @type {{
   *   open: boolean,
   *   view: CollectorSettings|null,
   *   busy?: ''|'load'|'save'|'install'|'remove',
   *   notice?: string,
   *   error?: string,
   *   errors?: Record<string, string>,
   *   onclose?: () => void,
   *   onsave?: (form: { autoInstallHooks: boolean, backfillHours: number|string }) => void,
   *   oninstall?: () => void,
   *   onremove?: () => void
   * }}
   */
  let {
    open,
    view,
    busy = '',
    notice = '',
    error = '',
    errors = {},
    onclose,
    onsave,
    oninstall,
    onremove,
  } = $props();

  // The form's draft, refilled whenever a fresh copy of the settings arrives.
  let autoInstallHooks = $state(true);
  // A number input binds a number, or '' while it is empty.
  /** @type {number|string} */
  let backfillHours = $state(6);

  $effect(() => {
    if (!view) return;
    autoInstallHooks = view.settings.autoInstallHooks;
    backfillHours = view.settings.backfillHours;
  });

  /** @type {ReadonlyArray<{ key: keyof CollectorSettings['watchers'], label: string, env: string }>} */
  const WATCHERS = Object.freeze([
    { key: 'transcripts', label: 'transcripts', env: 'WATCH_TRANSCRIPTS' },
    { key: 'docker', label: 'docker', env: 'WATCH_DOCKER' },
    { key: 'files', label: 'arquivos', env: 'WATCH_FILES' },
    { key: 'security', label: 'segurança', env: 'WATCH_SECURITY' },
  ]);

  const HOOK_STATES = Object.freeze({
    installed: { text: 'instalados', dot: 'bg-emerald-400' },
    missing: { text: 'não instalados', dot: 'bg-white/40' },
    unreadable: { text: 'settings.json ilegível', dot: 'bg-red-500' },
  });

  /** @param {CollectorSettings|null} current @returns {keyof typeof HOOK_STATES} */
  const hookKey = current => {
    if (!current) return 'missing';
    if (!current.hooks.readable) return 'unreadable';
    return current.hooks.installed ? 'installed' : 'missing';
  };

  const hookState = $derived(HOOK_STATES[hookKey(view)]);

  // Focus moves into the menu when it opens, so the keyboard lands where the eye does.
  /** @param {HTMLElement} node */
  const focusOnOpen = node => node.focus();

  /** @param {KeyboardEvent} event */
  const onkeydown = event => {
    if (open && event.key === 'Escape') onclose?.();
  };

  /** @param {SubmitEvent} event */
  const submit = event => {
    event.preventDefault();
    onsave?.({ autoInstallHooks, backfillHours });
  };
</script>

<svelte:window {onkeydown} />

{#if open}
  <div class="fixed inset-0 z-40 flex">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabindex="-1"
      use:focusOnOpen
      class="glass-tile flex h-full w-full max-w-[26rem] flex-col gap-2 overflow-y-auto px-4 pt-4 pb-6 text-white [--tile:var(--color-field)]"
    >
      <div class="flex items-center justify-between pb-2">
        <h2 id="settings-title" class="font-display text-[34px] leading-none font-extralight">
          configurações
        </h2>
        <Button variant="tile" size="sm" onclick={() => onclose?.()}>fechar</Button>
      </div>

      {#if busy === 'load' && !view}
        <p class="text-sm font-light text-white/60">carregando configurações…</p>
      {/if}

      {#if error}
        <p role="alert" class="glass-tile px-3 py-2 text-sm [--tile:var(--color-tile-critical)]">
          {error}
        </p>
      {/if}

      {#if notice}
        <p role="status" class="px-1 text-sm font-light text-emerald-200">{notice}</p>
      {/if}

      {#if view}
        <Tile label="hooks do claude code" tint="agents">
          <p class="flex items-center gap-2 text-[15px] font-light">
            <span class={`h-2 w-2 ${hookState.dot}`} aria-hidden="true"></span>
            {hookState.text}
          </p>
          <dl class="grid grid-cols-[4.5rem_1fr] gap-y-1 text-[12px] font-light">
            <dt class="text-white/60">envia para</dt>
            <dd class="truncate font-mono" title={view.hooks.url}>{view.hooks.url}</dd>
            <dt class="text-white/60">arquivo</dt>
            <dd class="truncate font-mono" title={view.hooks.settingsPath}>
              {view.hooks.settingsPath}
            </dd>
          </dl>
          <p class="text-[12px] font-light text-white/70">
            Sessões novas do Claude Code passam a enviar eventos na hora. As que já estavam abertas
            continuam aparecendo pelos transcripts.
          </p>
          <div class="flex gap-2 pt-1">
            {#if !view.hooks.installed}
              <Button
                variant="tile"
                size="sm"
                loading={busy === 'install'}
                disabled={Boolean(busy) || !view.hooks.readable}
                onclick={() => oninstall?.()}
              >
                instalar hooks
              </Button>
            {/if}
            {#if view.hooks.installed}
              <Button
                variant="tile-danger"
                size="sm"
                loading={busy === 'remove'}
                disabled={Boolean(busy)}
                onclick={() => onremove?.()}
              >
                remover hooks
              </Button>
            {/if}
          </div>
        </Tile>

        <Tile label="captura" tint="containers">
          <form class="flex flex-col gap-3 text-[13px] font-light" onsubmit={submit} novalidate>
            <label class="flex items-start gap-2">
              <input
                type="checkbox"
                class="mt-0.5 size-4 accent-white"
                bind:checked={autoInstallHooks}
              />
              <span>
                Instalar os hooks sozinho quando o painel iniciar
                <span class="block text-[12px] text-white/65">
                  Remover os hooks acima desliga isto, senão eles voltariam no próximo início.
                </span>
              </span>
            </label>

            <div class="flex flex-col gap-1">
              <label for="backfill-hours">Recuperar sessões das últimas</label>
              <div class="flex items-center gap-2">
                <input
                  id="backfill-hours"
                  type="number"
                  min="0"
                  max="168"
                  step="1"
                  inputmode="numeric"
                  bind:value={backfillHours}
                  aria-invalid={Boolean(errors.backfillHours)}
                  aria-describedby={errors.backfillHours
                    ? 'backfill-hours-error'
                    : 'backfill-hours-hint'}
                  class="h-9 w-24 bg-white/10 px-2 font-mono text-white ring-1 ring-white/25 outline-none focus:ring-white/70"
                />
                <span>horas</span>
              </div>
              {#if errors.backfillHours}
                <p id="backfill-hours-error" class="text-[12px] text-red-200">
                  {errors.backfillHours}
                </p>
              {/if}
              {#if !errors.backfillHours}
                <p id="backfill-hours-hint" class="text-[12px] text-white/65">
                  Vale para o botão atualizar e para o próximo início do painel.
                </p>
              {/if}
            </div>

            <div>
              <Button
                type="submit"
                variant="tile"
                size="sm"
                loading={busy === 'save'}
                disabled={Boolean(busy)}
              >
                salvar
              </Button>
            </div>
          </form>
        </Tile>

        <Tile label="coletor" tint="neutral">
          <dl class="grid grid-cols-[6rem_1fr] gap-y-1 text-[12px] font-light">
            <dt class="text-white/60">endereço</dt>
            <dd class="font-mono">{view.collector.host}:{view.collector.port}</dd>
            <dt class="text-white/60">versão</dt>
            <dd class="font-mono">{view.collector.version}</dd>
            <dt class="text-white/60">pasta do claude</dt>
            <dd class="truncate font-mono" title={view.collector.claudeHome}>
              {view.collector.claudeHome}
            </dd>
          </dl>
          <ul class="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] font-light">
            {#each WATCHERS as watcher (watcher.key)}
              <li class="flex items-center gap-2" title={watcher.env}>
                <span
                  class={`h-1.5 w-1.5 ${view.watchers[watcher.key] ? 'bg-emerald-400' : 'bg-white/30'}`}
                  aria-hidden="true"
                ></span>
                {watcher.label}
                <span class="text-white/55"
                  >{view.watchers[watcher.key] ? 'ligado' : 'desligado'}</span
                >
              </li>
            {/each}
          </ul>
          <p class="text-[12px] font-light text-white/65">
            Endereço, porta e observadores vêm do <code class="font-mono">.env</code> (PORT, HOST, WATCH_*).
            Mude lá e reinicie o painel.
          </p>
        </Tile>
      {/if}
    </div>

    <button
      type="button"
      class="flex-1 cursor-default bg-black/40"
      aria-label="Fechar configurações"
      tabindex="-1"
      onclick={() => onclose?.()}
    ></button>
  </div>
{/if}
