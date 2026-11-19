**English** | [Português (Brasil)](CONTRIBUTING.pt-BR.md)

# Contributing

Thanks for your interest in Orquestra Office. This guide covers how to run the project, how to test it, and what a change needs before it can be merged.

## Before you start

- For a large change (a new feature, a change to the contract between the collector, the hooks and the page, a new layer), open an issue first and describe the idea. That way nobody spends time on something that does not fit the project.
- Small fixes, missing tests and typos can go straight to a pull request.
- Security issues do not go in public issues: follow [SECURITY.md](SECURITY.md).
- By taking part, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Languages

The project is bilingual, with English as the main language on GitHub.

| What | Language |
|---|---|
| `README`, `CONTRIBUTING`, `CODE_OF_CONDUCT` | English in the main file and Brazilian Portuguese in the `.pt-BR.md` file next to it, linked to each other at the top |
| Issue and pull request templates | English, with a note that Portuguese is welcome too |
| Issues, pull requests and reviews | English or Portuguese, whichever you prefer |
| Landing page (`site/`) | Portuguese and English, with the same structure |
| ADRs (`docs/adr/`) and `docs/arquitetura/` | Portuguese only: they are internal decision records and are not translated |
| Office user interface text | Portuguese |
| Code, identifiers, comments and log messages | English |
| Commit messages | Portuguese |

Product terms have a fixed name in each language in the [glossary](docs/glossary.md). Use those names when writing in either language.

Changed a file that exists in both languages? Change the other one in the same pull request. If you are not comfortable writing in one of them, say so in the description and the review will help with the translation.

## Requirements

| Tool | What for |
|---|---|
| Node 22 or newer | collector, runner, hooks, tests and building the landing page |
| Git | cloning and committing |
| Docker with Compose | optional: run the collector the way end users run it |
| Claude Code or Codex | optional: see real sessions in the office |
| Python 3 | optional: serve the built landing page |

The project has no npm dependencies. There is no `npm install` to run.

## Running locally

### The page only, with sample data

Start the collector directly with Node, without Docker:

```powershell
cd collector
npm start
```

Open `http://localhost:8420/?modo=demo`. In demo mode the page makes no API requests and shows sample agents. Without `?modo=demo`, the page uses the collector and falls back to the demo if it does not answer.

The collector listens on `127.0.0.1:8420`, serves the `web/` folder and keeps its state in `collector/data/`, which Git ignores. The `PORT`, `OFFICE_HOST`, `OFFICE_HOLD_SECONDS`, `OFFICE_ALLOWED_HOSTS`, `WEB_DIR` and `DATA_DIR` variables override these defaults.

The page has no build step: edit a file in `web/` and reload the browser.

### With real sessions

Follow the install section of the [README](README.md). The installers write to your Claude Code configuration (`settings.json`) and your Codex configuration (`config.toml`). To try it without touching your own configuration, point `CLAUDE_CONFIG_DIR` and `CODEX_HOME` at a temporary folder before installing and before opening the session:

```powershell
$env:CLAUDE_CONFIG_DIR = "$env:TEMP\orquestra-claude"
$env:CODEX_HOME = "$env:TEMP\orquestra-codex"
node hooks/install-claude-hooks.mjs
node hooks/install-codex-notify.mjs
```

```bash
export CLAUDE_CONFIG_DIR="${TMPDIR:-/tmp}/orquestra-claude"
export CODEX_HOME="${TMPDIR:-/tmp}/orquestra-codex"
node hooks/install-claude-hooks.mjs
node hooks/install-codex-notify.mjs
```

Open Claude Code or Codex in the same terminal, with the variables still set. Because the configuration folder is new, the session may ask you to log in again.

The runner, which opens sessions from the office, runs outside Docker and listens on `127.0.0.1:8421`:

```powershell
node runner/src/main.js
```

### Landing page

The landing page lives in `site/`, in Portuguese (`site/index.html`) and English (`site/en/index.html`). To see the built site, with the office under `demo/`:

```powershell
node site/assemble.mjs _site
python -m http.server 8000 -d _site
```

Changed one landing page? Change the other language in the same pull request. The `site/test/pages.test.mjs` test compares the structure of both.

### Screenshots

README images live in `docs/images/`. Always take them with `?modo=demo`, which only has fictional names and projects, and never from your live office. Before committing, optimize the PNG (a reduced palette when there is no visible loss) and check that no screenshot shows a path, user name or project of yours.

## Tests

There are five packages, each with its own suite. Run the suite of the package you changed and, before opening the pull request, all of them:

```powershell
node --test site/test/*.test.mjs
node --test web/test/*.test.js
cd collector
npm test
cd ../runner
npm test
cd ..
node --test hooks/test/*.test.mjs
```

The commands are the same in PowerShell and bash. The CI workflow (`.github/workflows/ci.yml`) runs the five suites on Node 22 for every pull request and every push to `main`.

- `web/test` covers the behavior rules of the characters, the Sede (HQ), terminal formatting and the contract between the live backend and the demo backend, without a browser.
- `hooks/test` runs the installers with `CLAUDE_CONFIG_DIR` and `CODEX_HOME` in a temporary folder, and the hooks against a fake office on `127.0.0.1`. It does not touch your configuration.
- `collector/test` and `runner/test` start servers on free `127.0.0.1` ports.

## Code rules

### Layered architecture

The project follows Clean Architecture, with dependencies pointing inward: domain, then use cases, then adapters and infrastructure, with composition at the edge. The decision is recorded in [ADR 0001](docs/adr/0001-arquitetura-em-camadas.md) (in Portuguese).

- The domain does no I/O: no network, disk, DOM, `three.js` or direct clock access. Decision rules go into the domain and get tests that need no browser and no server.
- The presentation layer (views, `three/`, HTTP routes) only translates and displays. Business rules do not live there.
- One file, one responsibility. Contracts, data and logic live in separate files.
- Layer rules are enforced by tests that read each file's imports: `collector/test/architecture.test.js`, `runner/test/architecture.test.js` and `web/test/architecture.test.js`. In `hooks/`, `hooks/test/hook-imports.test.mjs` makes sure the hooks written to `settings.json` only import `node:` modules and `./lib/`. If your change breaks one of these tests, change the code, not the test. Changing the rule requires a new ADR in `docs/adr/`.
- The page's live backend and demo backend expose the same methods (`web/test/backends.test.js`). A new method goes into both.
- `hooks/office-session-start.mjs` and `hooks/office-statusline.mjs` keep their names and locations, because sessions that are already open point to them.

### Test first

Write the test before the code and watch it fail for the right reason. Then make it pass. For a bug fix, the test reproduces the bug. The test name states the behavior, not the function: "a newcomer does not take the only seat from whoever already had it", not "tests chooseSpot".

### No npm dependencies

- The collector, the runner and the hooks use only Node 22 `node:` modules.
- Browser libraries are copied into `web/vendor`, with their license next to them. To update one, follow the development section of the README: download the package from npm, check the registry `integrity` hash and replace the file.
- A new library in `web/vendor` needs an issue first, with the reason and the license.

### No build step for the page

The page in `web/` is HTML, CSS and ES modules served as they are. No bundler, transpiler or preprocessor. The collector's server does not serve `.mjs`, so page code uses `.js`.

### Style

- Follow the table in [Languages](#languages): code in English, interface text and commits in Portuguese.
- Names that say what the thing is. Booleans start with `is`, `has` or `should`.
- Named constants instead of loose numbers and strings.
- No comments that repeat the code. Comment only the why: a decision, a limit, a pitfall.
- No dead code, unused imports or code commented out "for later". `web/test/architecture.test.js` flags unused imports in the page.
- Two-space indentation, UTF-8 and LF line endings, as set in `.editorconfig`.

## Personal data and secrets

This repository is public, and everything that enters the history stays there. In code, tests, fixtures, logs, screenshots and issue or pull request descriptions:

- no real paths with your user name (`C:\Users\<your name>\...`, `/Users/<your name>/...`);
- no email, real name, IP address from your network, machine name or private project name;
- no token, key, password or the `env` block of your `settings.json`;
- no content copied from a real `settings.json`, `config.toml` or backup;
- no real session text: prompts, agent replies, commands with their arguments.

Use fictional data that still covers the case. The tests already do this, for example `C:\Users\ana\My Projects\escritorio_v2\hooks` to cover a folder with a space and an underscore, and `/home/me/src/orquestra-office/hooks` on Linux.

If you committed something like this by mistake, do not try to fix it with another commit: say so in the pull request so the history can be rewritten before the merge.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), written in Portuguese to match the history.

```text
<type>(<scope>): <what changes, from the user's point of view>

<optional body: why the change was made and what it prevents>
```

| Type | When |
|---|---|
| `feat` | new behavior |
| `fix` | behavior fix |
| `refactor` | changes structure without changing behavior |
| `perf` | performance improvement |
| `test` | tests only |
| `docs` | documentation only |
| `ci` | GitHub Actions workflows |
| `chore` | maintenance that does not change the product |

Scopes in use: `web`, `collector`, `runner`, `hooks`, `site`, `adr` and `arquitetura`. A change that spans several packages can go without a scope.

Examples from the history:

```text
feat(web): busca Ctrl K de agentes, salas e ações na Sede
fix(hooks): instaladores gravam a configuração de forma atômica
fix(collector): responde 413 e para de ler um corpo acima do limite
refactor(runner): leva o protocolo do Claude para o adapter claude/
perf(web): Sede com 60 agentes em pouco mais de cem chamadas de desenho
test(hooks): exemplo de pasta com espaço sem caminho pessoal
docs(adr): autenticação entre hooks, coletor e painel
ci: testes em pull request e push na main, com Dependabot das actions
```

- The subject starts with a lowercase letter, uses the present tense, has no trailing period and describes the effect, not the file.
- The body explains the why, in short paragraphs.
- One commit per logical change: each one tells a story on its own and can be reverted on its own.
- No `Co-Authored-By` trailer and no tool-generated signature.

Don't write Portuguese? Send the pull request with commits in English and say so in the description: whoever merges it will adjust the messages.

## Pull requests

1. Fork the repository and create a branch from `main`, with the type in its name: `feat/busca-na-sede`, `fix/backup-do-instalador`, `docs/guia-de-instalacao`.
2. Make the change test first and run the five suites.
3. Update the README (in both languages) or the documentation in `docs/` when the change affects how the system is used, installed or what it stores.
4. An architecture decision (a new layer, a new contract, a new dependency) becomes a short ADR in `docs/adr/`, in Portuguese, with the next free number.
5. Open the pull request against `main` and fill in the template: summary, how to test and the checklist.
6. One topic per pull request. Two independent changes go in two pull requests.
7. Wait for CI to pass. The review may ask for changes; reply in the comments and push new commits to the same branch.

## License

By contributing, you agree that your contribution is published under the project's [MIT license](LICENSE).
