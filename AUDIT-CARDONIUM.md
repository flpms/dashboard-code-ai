# Auditoria do Cardonium

> **Não publique este arquivo.** Ele descreve vulnerabilidades exploráveis e
> ainda não corrigidas de um sistema em produção, com caminhos e parâmetros. Se
> este repositório algum dia virar público, remova este arquivo e a seção
> "Inherited, and fixed here" de `ISSUES.md` antes.

**Data:** 2 de setembro de 2026
**Escopo:** `cardonium-api` e `cardonium-app`, na cópia local em `/Users/filipe/cardonium`
**Método:** leitura das camadas, `npm outdated`, `npm audit --omit=dev`, análise de
`routes.json`, e reprodução executável das falhas marcadas como **confirmado**.

Este relatório existe porque o template
[`node-svelte-clean-template`](README.md) foi derivado deste sistema. A
arquitetura veio quase inteira — e é boa. O que segue é o resto: o que foi
corrigido no template, e o que continua aberto no cardonium.

---

## Resumo

| Severidade | Achados |
| --- | --- |
| 🔴 Crítico | 2 |
| 🟠 Alto | 4 |
| 🟡 Médio | 7 |
| ⚪ Baixo | 4 |

**Leia primeiro o achado C-1.** Sete endpoints sob `/tenant/:tenantId/` estão
publicados sem autenticação nenhuma. Não é uma questão de estilo nem de dívida
técnica — é dado de cliente acessível com um `curl`.

---

## 🔴 C-1 — Sete rotas multi-tenant sem autenticação

**Confirmado.** `cardonium-api/app/v1/routes.json`

`app/lib/route-processor.js:22` só adiciona o middleware de token quando a linha
da rota traz `auth: true`. Estas sete trazem `false`:

| Rota | Método e caminho |
| --- | --- |
| `getInstruments` | `GET /tenant/:tenantId/instruments` |
| `getInstrument` | `GET /tenant/:tenantId/instruments/:id` |
| `getTestsProtocols` | `GET /tenant/:tenantId/tests-protocols` |
| `getTestsProtocol` | `GET /tenant/:tenantId/tests-protocols/:id` |
| `getValidUser` | `GET /tenant/:tenantId/users/:userId/valid` |
| `getUserInvite` | `GET /tenant/:tenantId/user-invites/:inviteId` |
| `acceptUserInvite` | `PATCH /tenant/:tenantId/user-invites/:inviteId/accept` |

Não há autenticação global antes do router — `app/index.js` monta apenas
`helmet`, `cors`, `express.json` e `morgan`. Com o `tenantId` (que aparece na URL
do app publicado e no `.env.example` versionado), o inventário de instrumentos e
os protocolos de ensaio de um tenant são legíveis por qualquer pessoa na
internet:

```
curl https://<api>/v1/tenant/<tenantId>/instruments?page=1&itemsPerPage=100
```

As duas rotas de convite provavelmente são intencionais — quem aceita um convite
ainda não tem conta, e o `inviteId` funciona como segredo. Se for esse o caso,
vale registrar a decisão em comentário na própria linha, porque hoje elas são
indistinguíveis das outras cinco.

`instruments` e `tests-protocols` quase certamente não são intencionais.

**O que fazer, hoje:** trocar `auth` para `true` nas cinco, adicionar `roles`, e
verificar se o app quebra em algum lugar (ele já manda `Authorization` nas
chamadas de instrumentos — veja `src/lib/services/instruments.js:31`).

**No template:** nenhuma rota nasce sem `auth`, e o `architecture-review` traz um
`grep` que lista rotas `:tenantId` sem proteção.

---

## 🔴 C-2 — Escalação horizontal: papel é verificado, tenant não

**Confirmado.** `cardonium-api/app/v1/authorization/permission.middleware.js`

O middleware de permissão carrega o usuário pelo e-mail e compara `user.role`
com a lista da rota. Ele nunca compara `user.tenantId` com o `:tenantId` da URL.

De 58 rotas com `:tenantId`, **um único caso de uso** faz essa comparação —
`app/v1/use-cases/users.js:35`, via `callerTenantId`. Os outros 57 confiam no que
a URL disser.

Consequência: um `admin` do tenant A lê, escreve e apaga dados do tenant B
trocando o id na URL. O papel confere, a query é escopada para o tenant que a URL
pediu, e a resposta é um 200 limpo. Nada no log indica anomalia.

Quatro rotas pioram o quadro por exigirem token mas nenhum papel
(`roles: false`), o que faz `req.user` sequer ser preenchido:

- `POST /tenant/:tenantId/instruments`
- `PATCH /tenant/:tenantId/instruments/:id`
- `DELETE /tenant/:tenantId/instruments/:id`
- `POST /tenant/:tenantId/documents`

Qualquer usuário autenticado de qualquer tenant cria, altera e apaga instrumentos
e envia documentos em qualquer outro tenant. Como `req.user` é `undefined` nessas
rotas, os campos `updatedBy` gravados no histórico vêm vazios — a auditoria
também não registra quem fez.

Uma suíte de testes que usa um tenant só nunca vê nada disso. É por isso que a
falha sobreviveu a 95 arquivos de teste.

**No template:** `tenant-scope.middleware.js` roda em toda rota com
`tenant: true`, publica o id já conferido em `req.tenantId`, e um teste de
integração prova a recusa cross-tenant
([ADR 0003](docs/adr/0003-tenant-isolation-in-middleware.md)).

---

## 🟠 A-1 — O tratador de erros nunca roda

**Confirmado por execução.** `cardonium-api/app/error-handler.middleware.js:16`

```javascript
expressInstance.use((err, req, res) => { /* ... */ });
```

O Express identifica middleware de erro pela **aridade**: precisa de quatro
parâmetros. Com três, é middleware comum, e middleware comum é pulado quando há
um erro em trânsito.

Reproduzido contra o módulo real:

```
/nope  -> 404 | body: "<!DOCTYPE html><html lang="en">…"
/boom  -> 500 | body: "<!DOCTYPE html><html lang="en">…"
custom error-handler log calls: []
```

Três efeitos, todos em produção hoje:

1. **Nenhum erro não tratado é logado.** O `logger.error` daquele bloco nunca
   executa. O que aparece no console vem do `finalhandler` do Express, fora do
   Winston, fora do arquivo de log.
2. **As respostas de erro são HTML.** O app faz `response.json()` — recebe uma
   página HTML e estoura um erro de parse, o que transforma "500 da API" em
   "tela branca sem explicação".
3. Fora de produção o corpo carrega a mensagem da exceção. Confirmado:
   `NODE_ENV=development` vaza, `NODE_ENV=production` não. Em produção o dado não
   escapa, mas também não é registrado em lugar nenhum.

**Correção:** acrescentar `next` à assinatura. Um caractere.

**No template:** mesma estrutura, quatro parâmetros, com um comentário explicando
por que o `next` aparentemente inútil não pode sair.

---

## 🟠 A-2 — 25 vulnerabilidades conhecidas em dependências de produção

`npm audit --omit=dev` no `cardonium-api`: **1 crítica, 3 altas, 15 moderadas,
6 baixas**.

| Pacote | Instalado | Atual | Situação |
| --- | --- | --- | --- |
| `@aws-sdk/client-s3` | 3.654.0 | 3.1124.0 | 470 versões atrás; cadeia `@smithy` com advisories |
| `undici` | 6.19.8 | 8.10.1 | 6 advisories abertos (desync de resposta, injeção de CRLF, envenenamento de fila keep-alive) |
| `express` | 4.21.2 | 5.2.1 | `body-parser`/`qs` vulneráveis a DoS |
| `helmet` | 7.1.0 | 8.3.0 | duas majors atrás |
| `joi` | 17.13.3 | 18.2.6 | |
| `winston` | 3.14.2 | 3.19.0 | |

O `undici` é o que mais preocupa: é o cliente HTTP usado na integração com o
Omie, e três dos seis advisories tratam de contaminação entre respostas em
conexões reaproveitadas.

**Ordem sugerida:** `npm audit fix` primeiro (resolve a maioria sem major),
depois `undici` e `helmet`, depois `express 5` — que é a única migração com
quebras reais (path matching e o retorno de `res.send`).

No frontend, `npm outdated` lista 44 pacotes atrás; Svelte 4→5, Tailwind 3→4 e
Vite 5→8 são as três majors que carregam o resto.

---

## 🟠 A-3 — MongoDB publicado em todas as interfaces, com senha padrão no compose

`cardonium-api/docker-compose.yml:10,13`

```yaml
ports:
  - '27018:27017'          # sem prefixo 127.0.0.1 → 0.0.0.0
environment:
  MONGO_INITDB_ROOT_PASSWORD: passRoot   # default literal
```

`27018:27017` publica a porta em todas as interfaces do host. Se o servidor tem
IP público e não há firewall na frente, o banco está exposto. A senha literal
`passRoot` só é usada quando `.env` não traz a variável — que é exatamente a
situação de qualquer ambiente montado às pressas.

**Correção:** `'127.0.0.1:27018:27017'` e remover o default literal, deixando o
compose falhar se a variável não vier.

**No template:** a porta já vem presa a `127.0.0.1`, com o motivo escrito no
arquivo.

---

## 🟠 A-4 — Deploy constrói na máquina de produção, a partir de um `git pull`

`.github/workflows/release.yml` (ambos os repositórios)

O fluxo hoje: `ssh` → `git fetch` → `git pull` → `scp .env` → `stop-containers.sh`
→ `docker compose up -d --build`.

Quatro problemas encadeados:

1. **Não existe artefato imutável.** O que roda em produção é o que o `docker
   build` produziu naquele servidor, naquele momento. Não é o que o CI testou.
2. **Rollback não existe.** Voltar uma versão significa `git checkout` de um sha
   antigo e reconstruir — no meio de um incidente.
3. **Os containers caem antes do build.** Se o build falha, o serviço fica fora
   do ar até alguém perceber. A janela é o tempo do build, não o do restart.
4. **O servidor precisa do código-fonte, do git e do toolchain de build.** Três
   superfícies a mais do que um servidor que só sabe puxar uma imagem.

O `web` tem um `rm -rf` do diretório publicado **antes** do `scp` do novo build:
o site responde 404 durante toda a transferência.

**No template:** o CI constrói e empurra para o GHCR com tag de commit; o servidor
faz `docker compose pull` e sobe. Rollback é apontar para outra tag. O web sobe
para `releases/<sha>/` e troca um symlink — sem janela.

---

## 🟡 M-1 — O `.env` do release é montado à mão, linha por linha

`release.yml` tem ~45 linhas de `echo NAME=$NAME >> ~/.env`. Foi assim que
`STORAGE_CLIENTS_BUCKET` ficou de fora — o próprio `env.validation.js` conta a
história no cabeçalho, e é um bom comentário.

O `scripts/check-env.js` foi acrescentado depois e resolve o sintoma: o release
falha nomeando a variável ausente. **Isso é bom e deve ficar.** Mas a escada
continua ali, e continua sendo o lugar onde alguém vai esquecer a próxima.

**No template:** `env.manifest.js` é a lista, `render-env.js` gera o arquivo a
partir dela, `check-env.js` confere. Acrescentar uma variável é uma linha no
manifest ([ADR 0004](docs/adr/0004-environment-manifest.md)).

---

## 🟡 M-2 — `npm install` no Dockerfile, com o lockfile ali do lado

`cardonium-api/Dockerfile:21`

```dockerfile
COPY package-lock.json /home
COPY package.json /home
RUN npm install --omit=dev
```

O lockfile é copiado e ignorado: `npm install` pode resolver versões
transitivas mais novas que as que o CI testou. `npm ci` é a forma de fazer valer
o lockfile.

A imagem também é de estágio único — carrega o cache do npm e reconstrói tudo a
cada alteração de código, porque `COPY ./app` vem antes do `RUN npm install`.

**No template:** build em dois estágios, `npm ci --omit=dev` com cache mount,
usuário não-root, `CMD` sem npm no meio (npm engole `SIGTERM`, e o container
morre no timeout do `docker stop` em vez de drenar).

---

## 🟡 M-3 — Verificações desligadas no CI

- `cardonium-app/.github/workflows/ci.yml:38` — `npm run check` (svelte-check)
  comentado.
- `.github/workflows/playwright.yml` — o arquivo inteiro está comentado.
- `cardonium-api/.github/workflows/test.yml` — o job de integração inteiro está
  comentado.
- O `test.yml` da API declara `matrix.node-version` mas **não tem o passo
  `actions/setup-node`**: as duas linhas da matriz rodam na mesma versão de Node
  que o runner trouxe. A matriz não testa nada.

O `svelte-check` provavelmente foi desligado porque acusava dezenas de erros — foi
o que aconteceu ao montar o template a partir daqui (78 erros na primeira
execução). Desligar é compreensível sob prazo; o custo é que as anotações de tipo
deixam de valer alguma coisa e param de ser escritas.

**No template:** `npm run check` é obrigatório e reporta 0 erros, com os tipos
escritos em JSDoc ([ADR 0005](docs/adr/0005-javascript-with-jsdoc-types.md)).

---

## 🟡 M-4 — CORS cai para `*` quando a variável está vazia

`cardonium-api/app/lib/cors.js:5`

```javascript
if (!raw || raw === '*') return null;   // null => Access-Control-Allow-Origin: *
```

Uma variável esquecida no deploy não quebra nada de forma visível — ela abre a
API para qualquer origem. O modo de falha aponta para o lado errado.

Como a API usa `Authorization: Bearer` e não cookies, o impacto é menor do que
seria com credenciais, mas ainda permite que qualquer site rode requisições
autenticadas com um token que ele consiga obter.

**No template:** a lista vazia recusa. `*` só vale se for escrito, e emite um
aviso no boot em produção.

---

## 🟡 M-5 — O frontend é single-tenant

`PUBLIC_TENANT_ID` aparece em 18 arquivos de `cardonium-app/src`. A API é
multi-tenant; o app é compilado para um tenant só, e trocar de cliente significa
outro build e outro deploy.

O `tenantId` também não vem da sessão do usuário — vem de uma constante de build.
Isso significa que o app não *pode* mostrar dados do tenant do usuário logado se
os dois divergirem.

**No template:** o tenant vem da sessão (`session.tenantId`) e é parâmetro em toda
chamada de serviço.

---

## 🟡 M-6 — Autenticação legada ainda embarcada

`check-token.middleware.js:52` aceita um token estático (`btoa(APP_SECRET)`), e
`permission.middleware.js:19` confia no header `x-user-email` quando esse caminho
foi usado. Está atrás de `LEGACY_AUTH_ENABLED` e o código é cuidadoso — o header
só é aceito quando a autenticação foi de fato legada, com um comentário
explicando. Bom trabalho.

Ainda assim: enquanto a flag existir, um `APP_SECRET` vazado dá acesso como
qualquer e-mail que o atacante escolher. A flag precisa de data de remoção, não
de manutenção.

---

## 🟡 M-7 — Dois repositórios, convenções duplicadas

`cardonium-api` e `cardonium-app` são repositórios separados, com workflows
parecidos mas divergentes, dois `commit-guardian.agent.md` diferentes, e
documentação de arquitetura em `docs/` de um lado e `doc/arch/` do outro.

As regras de estilo do app (`doc/arch/03-code-style.md`) são boas e **são
seguidas** — mas não existe equivalente na API, que segue as mesmas regras por
tradição oral.

O `03-code-style.md` também está defasado em um ponto concreto: descreve
`Authorization: Bearer ${btoa(PUBLIC_API_TOKEN)}` como o padrão de header, o que
o código já não faz (hoje é JWT via `getStoredToken()`). Documento que descreve o
passado é pior que documento nenhum.

---

## ⚪ Baixo

- **B-1** — `node-version: 'latest'` no release do app: o runtime de produção muda
  sozinho quando o GitHub promove uma versão.
- **B-2** — Passos de depuração no release do app (`check locations`, `pwd`).
- **B-3** — `mongo-volume/` é bind mount dentro da árvore de código; os dados do
  banco ficam misturados ao fonte e dependem do `.gitignore` para não vazarem.
- **B-4** — A raiz do workspace tem seis arquivos de apresentação
  (`ANALISE_EXECUTIVA_STAKEHOLDERS.md`, `INFOGRAFICO_NUMEROS.txt`, …). Não fazem
  mal, mas enterram o README.

---

## O que está certo e foi copiado inteiro

Vale registrar, porque a lista acima é longa e desequilibrada:

- **A disciplina de camadas é real, não aspiracional.** Um único `else` em toda a
  pasta `app/` da API. Zero `fetch` fora de `services/` no app. Isso é raro.
- **Injeção de dependência manual via `StartupConfig`** — tudo recebe seus
  colaboradores, e é por isso que 95 arquivos de teste rodam sem banco.
- **`routes.json` como dado.** Toda a superfície da API, com autenticação e
  papéis, em um arquivo legível de cima a baixo.
- **`env.validation.js` + `check-env.js`.** A ideia certa, com o comentário que
  explica de qual incidente ela nasceu. O manifest do template é essa ideia
  levada até o fim.
- **Serializers, soft delete, coleção de histórico.** Os três juntos são o que
  permite responder "quem mudou isso e quando".
- **O token de impressão só vale para GET** (`check-token.middleware.js:31`).
  Defesa em profundidade que ninguém pediu e que alguém escreveu mesmo assim.
- **Comentários que explicam o porquê**, não o quê. O de
  `env.validation.js` conta um incidente inteiro em doze linhas. Esse é o padrão
  de comentário que o template tenta manter.

---

## Plano sugerido

| Quando | O quê |
| --- | --- |
| **Hoje** | C-1: `auth: true` nas cinco rotas públicas de instrumentos e protocolos. A-1: acrescentar `next` ao tratador de erros. A-3: prender a porta do Mongo em `127.0.0.1`. |
| **Esta semana** | C-2: portar `tenant-scope.middleware.js` do template e marcar as 58 rotas. A-2: `npm audit fix`, depois `undici` e `helmet`. |
| **Este mês** | A-4: migrar o deploy para imagem no GHCR. M-1: adotar o manifest. M-2: `npm ci` e build em dois estágios. M-3: religar `svelte-check` e o job de integração, e corrigir a matriz sem `setup-node`. |
| **Próximo trimestre** | M-5: tenant vindo da sessão. M-6: remover a autenticação legada. Majors do frontend (Svelte 5, Tailwind 4, Vite 8) — o template serve de referência de destino. |
