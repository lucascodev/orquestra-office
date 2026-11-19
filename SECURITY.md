**English** | [Português (Brasil)](SECURITY.pt-BR.md)

# Security policy

Orquestra Office runs on your machine and handles sensitive things: it writes to your Claude Code and Codex configuration, receives commands and tool output, and decides permission requests on behalf of its user. This document says what is supported, how to report a vulnerability and what counts as one.

## Supported versions

| Version | Supported |
|---|---|
| `main` | yes |
| any other branch, fork or old copy | no |

The project has no released version yet. A fix lands on `main`, and users update their folder and run the install commands from the [README](README.md#install) again.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting:

1. Open the **Security** tab of the [lucascodev/orquestra-office](https://github.com/lucascodev/orquestra-office) repository.
2. Click **Report a vulnerability** ([direct link](https://github.com/lucascodev/orquestra-office/security/advisories/new)).
3. Fill in the report. Only you and the maintainer can see it.

Do not open a public issue, pull request or comment about a vulnerability that has not been fixed yet. The project has no email channel.

It helps a lot to include:

- the affected component (hooks, collector, runner, page) and the `main` commit you tested;
- operating system, Node version and whether the collector runs in Docker or directly with Node;
- steps to reproduce, ideally with a minimal command or script;
- the impact: what the attacker needs (another page in the browser, a device on the network, another user on the machine) and what they can do.

Do not send real secrets, the contents of your `settings.json` or session text in the report. Fictional data is enough to reproduce.

### What to expect

The project is maintained by one person, so there is no guaranteed deadline. The goal is to acknowledge the report within 7 days and to agree with you, in the report itself, on the fix and the disclosure date. When the fix lands on `main`, a security advisory is published in the repository, crediting the reporter if you wish.

## Scope

These count as security vulnerabilities, among others:

- **Hooks and installers** (`hooks/`). The installers write to Claude Code's `settings.json` and Codex's `config.toml`, back them up and record what they wrote in `orquestra-office.json`. Examples: the installer deleting or changing a hook that is not the office's, writing a command the shell interprets, exposing the backup (which may hold tokens from `env`) to another user, or a written hook running something planted in the open repository.
- **Collector** (port 8420). It receives hook events, keeps the state and serves the page and the API. Examples: another page open in the browser reading or changing the state, data that should stay in memory reaching the disk, a request body crashing the process, or the collector being reachable outside `127.0.0.1` without LAN mode turned on.
- **Permission decisions.** The collector holds permission requests, agent questions and messages delivered at the end of a turn. Examples: approving a request without being the office's user, rewriting the command the agent asked for, saving a permission rule or changing Claude Code's permission mode, or injecting text labeled as a user message.
- **Pairing and hook authentication**, as designed in [ADR 0002](docs/adr/0002-autenticacao-hooks-e-painel.md) (in Portuguese): HMAC signatures between hooks and collector, the paired-device cookie on `/api/*`, single-use pairing codes and secret rotation. Flaws in the design count too.
- **Runner** (`127.0.0.1:8421`). It opens Claude Code sessions in streaming mode. Examples: a process or page that is not the office opening a session, sending a message, interrupting or ending a session.
- **Use of the libraries copied into `web/vendor`** in a way that opens a vulnerability, for example HTML from an agent reply reaching the page without going through DOMPurify.

## Threat model

A summary of section 1.4 of [ADR 0002](docs/adr/0002-autenticacao-hooks-e-painel.md). The principle: **the office must not give anyone, not even the agent itself, a power that Claude Code has not already given.**

In the model:

1. another page open in the browser;
2. another device on the local network;
3. another user of the system, or one of their processes, including one holding port 8420 while the collector is stopped;
4. the network path to a remote `OFFICE_URL`;
5. the agent itself using an already allowed command (for example `curl`) to gain a power Claude Code did not give it, such as approving its own requests.

### Status on `main`

Phase S of ADR 0002 is on `main`.

- **Secret.** The installer creates `~/.orquestra-office/secret`, readable only by its owner on macOS and Linux, and never overwrites it without `--rotate-secret`. The collector reads the same file, mounted as a Compose `secret` in Docker. Rotating the secret invalidates paired devices, runner tokens and hooks holding the old key.
- **Hooks.** No office hook is of type `http`. Activity goes through the system `curl`, without a shell, with a bearer token read from a file that is only valid on the activity routes. Permission requests, questions and the end of a turn go through `hooks/office-decision.mjs`, which signs the request with HMAC-SHA256 and only accepts a reply signed with the same key and bound to the request's nonce. Without that reply, the request goes to the terminal. The script never returns `updatedPermissions`, `additionalContext` or `interrupt`, and only returns `updatedInput` for `AskUserQuestion`, built from the questions it received itself.
- **Old hooks.** A request without a token or signature gets `200 {}`, records, holds and delivers nothing, and turns on the old-hooks warning in the page. A wrong token or signature gets `401`.
- **Panel.** Every `/api/*` route requires the cookie of a paired device (`HttpOnly`, `SameSite=Strict`, `Path=/api`), on `127.0.0.1` too. The first browser is paired by `node hooks/open-office.mjs`, which asks for a single-use challenge (30 seconds) and a single-use code (2 minutes) with signed requests. Other devices are paired with a single-use QR code or link, generated on a device that is already paired. The disk only keeps the cookie's hash, and only a paired page counts as a viewer and holds requests.
- **Runner.** Every request except `/health` requires a 12-hour token, which the page gets by exchanging a single-use challenge signed by the collector.
- **Collector.** It listens only on `127.0.0.1` by default, and `compose.yaml` publishes the port only on that address. It checks `Host` against DNS rebinding, refuses reads and actions from another site (`Sec-Fetch-Site` and `Origin`) and actions without `Origin`, prevents other pages from framing the office (`frame-ancestors`), and limits the body size and the number of viewers.
- **Address.** Hooks only accept an address on this machine, and `localhost` becomes `127.0.0.1`. The address is written into each hook's command; none of them reads `OFFICE_URL` during the session. A remote address requires `--allow-remote-office` and `https://`.
- **Installers.** They write atomically, only touch what the office wrote and refuse a folder with characters the shell interprets.

Known limits, recorded in ADR 0002:

- The collector only remembers nonces while it is running. Someone who captured a signed `Stop`, permission or question request, by holding the port while the collector was stopped, can replay it later: it empties that session's message queue or creates a fake pending request, without deciding anything in any session. Pairing bootstrap does not have this problem, because it requires a single-use challenge.
- In LAN mode, which is plain HTTP, anyone sniffing the network can copy the cookie of a paired device.
- Cookies do not separate ports: another server on `127.0.0.1` receives the cookie on `/api`. That is local code, out of scope below.

Reports about these limits help when they bring a path the ADR does not describe.

## Out of scope

- Code running as the same system user that reads or edits files on purpose. It can already edit `~/.claude/settings.json` and grant itself any permission, and the office has no way to prevent that.
- Someone sniffing local network traffic in LAN mode, which is plain HTTP. The README says to turn LAN mode on only in a trusted network.
- Risks the README and the [guide](docs/guide.md) already document as the user's choice: LAN mode on an untrusted network, `--allow-remote-office` pointing to a server you do not control, and the `settings.json` backup holding the same tokens as the original.
- Vulnerabilities in Claude Code, Codex or the `web/vendor` libraries themselves. Report them to the upstream project; if the way the office uses a library opens the vulnerability, it is in scope.
- The sample data of demo mode and the landing page, which is fictional and public.
- Denial of service that requires local access and only brings down the office itself, without affecting the Claude Code session. Hooks already carry on when the collector does not answer.
- Automated tool reports without a demonstrated impact on this project.
