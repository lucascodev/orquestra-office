# Changelog

All notable changes to this project are documented in this file, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> **Português.** O changelog fica só em inglês, que é o padrão para quem acompanha as versões. Os termos seguem o [glossário](docs/glossary.md).

## [Unreleased]

## [0.1.0] - 2026-11-19

First public version.

### Added

- **Live office.** A Node collector with no dependencies, running in Docker on `127.0.0.1:8420`, that receives Claude Code events through hooks and Codex events through `notify`. Each session gets a character, and each subagent sits next to whoever started it.
- **Sede (HQ).** The office became a single-storey open-plan building in 3D pixel art, with a 6-desk island per project in the colors of its theme, and common areas shared by everyone: meeting room, pantry, game room, lounge, reception and yard. The Sede is the office's only page.
- **Camera and navigation in the Sede.** Interactive isometric camera, minimap, follow an agent with the camera, and search with `Ctrl K` (`Cmd K` on a Mac) for agents, rooms and actions.
- **Sede interface.** Alert for whoever needs you, agent drawer with status, live terminal or history and message box, island sheet with who sits there, the day's numbers, the theme and "New session in this folder" (Nova sessão nesta pasta), queued message counts and labels that stay readable when zoomed out.
- **Sede on phones.** Below 720 px, the map fills the screen and the panels move to a bottom sheet with tabs.
- **Life in the office.** Characters that type, read, raise a hand and leave through the door depending on what the agent is doing, with a free-time routine, a temperament of their own, thought bubbles, gestures and delegation and hand-off conversations. They walk along a corridor graph without going through furniture.
- **Decisions from the browser.** Approve or deny permission requests, answer the agent's questions and send messages that arrive at the end of the turn.
- **Runner** on `127.0.0.1:8421`, outside Docker, that opens Claude Code sessions from the office, with a live terminal, Interrupt (Interromper) and End session (Encerrar sessão).
- **Usage, tokens and cost.** An office status line that passes the 5-hour and weekly usage windows, tokens and the day's cost on to the collector.
- **LAN mode** with `compose.lan.yaml`, to open the office on a phone on the same network.
- **Device pairing.** Every browser must be paired to see or decide anything. `node hooks/open-office.mjs` opens the office, already paired, in the default browser, and the Devices (Aparelhos) button in the Sede lists devices, pairs another one with a single-use QR code or link, and revokes a device or the current browser (Sign out this one, "Sair deste"). Without pairing, the Sede shows "This browser is not paired" (Este navegador não está pareado) with the command to run.
- **Old hooks warning** in the Sede while an `http` hook from an earlier version keeps sending events, and a warning when the secret is missing.
- **Demo mode** with `?modo=demo`, with sample agents and no API requests.
- **Landing page** in Portuguese and English, with the live demo inside the page and a static preview of the Sede on narrow screens, published to GitHub Pages by the `Pages` workflow.
- **CI** with the five test suites (landing page, page, collector, runner and hooks) on every pull request and push to `main`, actions pinned by hash, and Dependabot for them.
- MIT license.
- ADR 0001, layered architecture, and ADR 0002, authentication between hooks, collector and panel.
- Community files: contributing guide, code of conduct, security policy, issue and pull request templates, `CODEOWNERS` and `.editorconfig`.
- Glossary of product terms in English and Portuguese (`docs/glossary.md`).
- Usage guide in English and Portuguese (`docs/guide.md` and `docs/guia.md`), with the details that left the README: life in the office, the agent sheet's terminal, approving and answering, messages, the runner, usage and cost, and how the installers change your configuration.

### Changed

- **Layered architecture** in the collector, the runner, the page and the hooks: domain without I/O, use cases, separate Claude Code and Codex adapters, composition at the edge, and a layer test per package that reads the imports.
- The collector and the runner publish structured fields (`actionId`, `subject`) instead of ready-made sentences, and the page builds the sentences from them.
- The hook installers separate building `settings.json` and `config.toml` from reading and writing the files, and record what they wrote in `orquestra-office.json`.
- The landing page opens the install section on the Docker tab. `npx` shows as "coming soon" until the package is published.
- **`command` hooks instead of `http` hooks.** Activity goes through the system `curl`, in the background and without a shell, and permission requests, questions and the end of a turn go through `hooks/office-decision.mjs`. Reinstalling is required: the installer replaces the old `http` entries and says it migrated. See "Updating from the `http` hooks" in the [README](README.md#updating-from-the-http-hooks).
- **Install.** The installers run before `docker compose up`, because they create the secret in `~/.orquestra-office/secret` that `compose.yaml` mounts into the container, and `node hooks/open-office.mjs` completes the install.
- The office address is written into each hook's command, and `localhost` becomes `127.0.0.1`.
- **Documentation in English first.** The README, the contributing guide, the code of conduct and the security policy are in English, with the Portuguese version next to each one (`README.pt-BR.md`, `CONTRIBUTING.pt-BR.md`, `CODE_OF_CONDUCT.pt-BR.md`, `SECURITY.pt-BR.md`). The README gained badges, screenshots and an animation of the Sede in demo mode, and a diagram of how the parts connect.

### Removed

- The cloud team tab, which required the container to mount the project root, `.env` included.
- The per-project room page: the Sede became the only page, and `?vista=sede` is still accepted but no longer needed.
- Hooks of type `http`. The collector answers them without effect and shows the old hooks warning.

### Security

- **Hooks.** The installers write atomically, keep a `settings.json` that is a symlink, only touch what the office wrote, refuse a `settings.json` that is not an object and a folder with characters the shell interprets, and keep only the three latest backups, without overwriting the previous one.
- **Office address.** `OFFICE_URL` only accepts an address on this machine. A remote address requires `--allow-remote-office` and `https://`, and a refused value turns the hook off instead of falling back to the default. No hook reads `OFFICE_URL` during the session, because a project's `.claude/settings.json` can set it.
- **SessionStart** does not run a `git.exe` planted in the open repository.
- **Collector.** It refuses reads and actions from another site or another local port, prevents other pages from framing the office, uses `Referrer-Policy: same-origin`, answers `413` and stops reading a body over the limit, limits viewers and drops those who do not read the stream, trims long `cwd` values and ids, and does not crash on prototype keys or malformed URLs.
- **Runner.** It does not crash on malformed URLs.
- **Phase S of ADR 0002.** Whoever answers on port 8420 while the collector is stopped, another user on the machine or a remote `OFFICE_URL` can no longer decide permissions: `office-decision.mjs` signs the request with HMAC-SHA256, only accepts a signed reply bound to the nonce, and never returns `updatedPermissions`, `additionalContext` or `interrupt`. Every `/api/*` route requires a paired device, on `127.0.0.1` too, and an unpaired device on the network gets `401`. The agent can no longer approve its own requests with an allowed `curl`. The runner requires a token obtained with a challenge signed by the collector. `--rotate-secret` revokes devices, tokens and hooks at once.
- **Landing page.** Its own content security policy on the pages and on the demo inside the iframe, and the build refuses to publish a page with the `OWNER` placeholder or to delete a folder it did not build.

[Unreleased]: https://github.com/lucascodev/orquestra-office/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lucascodev/orquestra-office/releases/tag/v0.1.0
