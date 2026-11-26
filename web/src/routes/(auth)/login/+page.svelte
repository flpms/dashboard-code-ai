<script>
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { PUBLIC_APP_NAME } from '$env/static/public';
  import Button from '$lib/components/ui/button.svelte';
  import InputField from '$lib/components/ui/input-field.svelte';
  import { signInSchema, validate } from '$schemas/index.js';
  import { ApiClient } from '$services/api-client.js';
  import { AuthService } from '$services/auth.service.js';
  import { session } from '$store/session.svelte.js';

  const auth = AuthService(ApiClient({ getToken: () => null }));

  let email = $state('');
  let password = $state('');
  /** @type {Record<string, string>} */
  let errors = $state({});
  let failure = $state('');
  let submitting = $state(false);

  /** @param {SubmitEvent} event */
  const submit = async event => {
    event.preventDefault();

    const result = validate(signInSchema, { email, password });

    if (!result.success) {
      errors = result.errors;
      return;
    }

    submitting = true;
    errors = {};
    failure = '';

    try {
      const { token, user } = await auth.signIn(result.data);
      session.start({ token, user });
      goto(resolve('/items'), { replaceState: true });
    } catch (error) {
      failure = error instanceof Error ? error.message : 'Erro inesperado.';
    } finally {
      submitting = false;
    }
  };
</script>

<div class="flex min-h-full items-center justify-center px-4 py-16">
  <form
    class="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-slate-200 bg-white p-8"
    onsubmit={submit}
    novalidate
  >
    <div class="mb-2">
      <h1 class="text-lg font-semibold text-slate-900">{PUBLIC_APP_NAME}</h1>
      <p class="text-sm text-slate-500">Entre para continuar.</p>
    </div>

    <InputField
      id="email"
      label="E-mail"
      type="email"
      autocomplete="username"
      bind:value={email}
      error={errors.email}
    />

    <InputField
      id="password"
      label="Senha"
      type="password"
      autocomplete="current-password"
      bind:value={password}
      error={errors.password}
    />

    {#if failure}
      <p role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{failure}</p>
    {/if}

    <Button type="submit" loading={submitting} class="mt-2 w-full">Entrar</Button>
  </form>
</div>
