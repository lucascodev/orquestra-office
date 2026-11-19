<!-- You can write in English or Portuguese (pode escrever em português). Fill in each section and delete what does not apply. -->

## Summary

<!-- What changes and why, in a few sentences. -->

Related issue: <!-- Closes #123, or "none" -->

## How to test

<!-- Steps for the reviewer to see the change working. For the page, say whether ?modo=demo is enough. -->

1.

## Screenshots

<!-- Only for visual changes. Use fictional data or ?modo=demo. -->

## Checklist

Tests for the packages you touched, run locally and passing:

- [ ] `node --test site/test/*.test.mjs` (landing page)
- [ ] `node --test web/test/*.test.js` (office page)
- [ ] `npm test` in `collector/` (collector)
- [ ] `npm test` in `runner/` (runner)
- [ ] `node --test hooks/test/*.test.mjs` (hooks)

Project rules:

- [ ] Test written before the code, and seen failing without the change.
- [ ] Layer tests still pass without being loosened (`architecture.test.js` and `hook-imports.test.mjs`).
- [ ] No new npm dependency and no build step for the page.
- [ ] README (both languages), `docs/` or an ADR updated, if the change affects usage, installation, stored data or architecture.
- [ ] Files that exist in English and Portuguese (README, CONTRIBUTING, landing page) changed in both languages, if they changed.
- [ ] Commits follow Conventional Commits, without `Co-Authored-By` and without a tool-generated signature.
- [ ] No personal data or secrets in code, fixtures, logs or screenshots: paths with a user name, email, tokens, real `settings.json` or `config.toml` content, real session text.
