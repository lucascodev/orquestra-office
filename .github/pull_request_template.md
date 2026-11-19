<!-- English is fine. Fill in each section; delete what does not apply. -->

## Resumo

<!-- O que muda e por quê, em poucas frases. -->

Issue relacionada: <!-- Closes #123, ou "nenhuma" -->

## Como testar

<!-- Passos para quem revisa ver a mudança funcionando. Para a página, diga se vale o ?modo=demo. -->

1.

## Capturas

<!-- Só para mudança visual. Use dados fictícios ou o ?modo=demo. -->

## Checklist

Testes dos pacotes tocados, rodados localmente e verdes:

- [ ] `node --test site/test/*.test.mjs` (landing)
- [ ] `node --test web/test/*.test.js` (página)
- [ ] `npm test` em `collector/` (coletor)
- [ ] `npm test` em `runner/` (executor)
- [ ] `node --test hooks/test/*.test.mjs` (hooks)

Regras do projeto:

- [ ] Teste escrito antes do código, e visto falhar sem a mudança.
- [ ] Os testes de camada continuam verdes sem terem sido afrouxados (`architecture.test.js` e `hook-imports.test.mjs`).
- [ ] Nenhuma dependência npm nova e nenhuma etapa de build na página.
- [ ] README, `docs/` ou um ADR atualizados, se a mudança altera uso, instalação, dados guardados ou arquitetura.
- [ ] A landing mudou nas duas línguas, se mudou.
- [ ] Commits em Conventional Commits, em português, sem `Co-Authored-By` e sem assinatura gerada por ferramenta.
- [ ] Nenhum dado pessoal ou segredo em código, fixtures, logs ou capturas: caminho com nome de usuário, e-mail, token, conteúdo real de `settings.json` ou `config.toml`, texto real de sessões.
