# ADR 0001: Arquitetura em camadas por pacote

- Status: proposta, aguardando aprovação do usuário
- Data: 2026-11-18
- Detalhes e plano de execução: `docs/arquitetura/plano-de-refatoracao.md`

## Contexto

O projeto tem quatro partes em JavaScript sem dependências e sem build: `collector/` (servidor Node no Docker), `runner/` (processo local que abre sessões do Claude Code), `web/` (módulos ES servidos direto, com three.js vendorizado) e `hooks/` (scripts instalados no Claude Code e no Codex).

A auditoria encontrou poucas violações, mas todas no ponto onde a regra de dependência importa:

- o runner importa um arquivo interno do collector;
- o domínio do collector importa um adapter;
- a camada HTTP cria as próprias dependências e guarda os casos de uso;
- no web, regras puras moram numa pasta chamada `view/`, junto com o HTML, e o renderer 3D toma decisões de movimento sem teste.

Não há ferramenta que verifique camadas, e o projeto não é um repositório git.

Três evoluções já aprovadas dependem dessa organização: o escritório em formato de campus, que precisa preservar os 7 temas; a instalação por `npx`; e a landing page no GitHub Pages.

## Decisão

1. Cada pacote se organiza por contexto. Dentro do contexto ficam as camadas, só quando há mais de uma: `domain` (regra pura), `application` (casos de uso, no collector), `infra` (I/O) e a borda (`http/` no collector e no runner; `app/`, `view/` e `three/` no web). A composição fica na borda: `composition.js` no collector e no runner, e `app/main.js` no web.
2. As dependências apontam para dentro. Testes de arquitetura feitos com `node:test`, sem dependência npm, leem os imports de cada pacote e falham quando uma regra é quebrada. Os mesmos testes conferem que todo import relativo existe, já que não há build para pegar caminho quebrado.
3. O código compartilhado entre o collector e o runner fica em `collector/src/shared/`. Essa pasta não importa nada fora dela, e o runner só pode importar de lá. Assim a imagem Docker continua copiando apenas `collector/src`.
4. Portas existem só onde há troca real:
   - backend do web (ao vivo e demonstração);
   - processo do Claude Code no runner;
   - verificação de pasta no runner.

   Store, persistência, histórico, relógio e gerador de id não ganham interface.
5. As convenções atuais continuam valendo: fábricas `createX`, kebab-case, sem sufixo de camada no nome do arquivo, sem TypeScript, sem build e sem dependências. A pasta `view/` do web mantém o nome e passa a guardar só HTML, formatação e ícones.
6. Ficam fixos estes caminhos:
   - `collector/src/main.js`;
   - `runner/src/main.js`;
   - `web/index.html` carregando `scripts/app/main.js`;
   - `hooks/office-session-start.mjs` e `hooks/office-statusline.mjs`, gravados no `settings.json` do usuário.
7. A composição de cada pacote recebe a configuração como objeto, sem ler `process.env` e sem depender do diretório atual. Por padrão, o coletor escuta só em `127.0.0.1`; o `0.0.0.0` passa a ser definido apenas no `Dockerfile`. Com isso, a CLI de `npx` pode reaproveitar a composição.
8. A refatoração prepara o campus sem implementá-lo. Ela separa:
   - as ilhas de mesas das zonas comuns da sala;
   - o catálogo de pontos da escolha de quem vai para onde;
   - a rota, que passa a ser injetada no plano de movimento.

   A sala 3D também passa a ser montada numa origem com o próprio tema. O catálogo dos 7 temas não muda: no campus, cada sala de projeto mantém o tema dela e as áreas comuns e externas usam um tema de campus próprio.

## Alternativas consideradas

- **Manter a estrutura e corrigir só os pontos críticos.** É mais barato agora, mas deixa a regra sem verificação e o web sem lugar claro para regra pura. Também obrigaria o campus a reescrever a sala em vez de compô-la.
- **Layout completo `src/modules/<x>/{domain, application, infra, presentation}` em todos os pacotes.** Seria cerimônia demais para cerca de 30 arquivos por pacote, porque alonga os imports sem melhorar a testabilidade.
- **Pacote `shared/` na raiz do repositório.** Exigiria levar o contexto do build Docker para a raiz, criar `.dockerignore` e mudar o `compose.yaml`, o que contraria a restrição de a imagem copiar só `collector/src`.
- **Duplicar no runner o resumo de ferramentas, com um teste de igualdade.** Torna os pacotes independentes, mas mantém duas cópias de um contrato que o web interpreta. Fica guardada para o caso de o runner ser distribuído sem o collector.
- **dependency-cruiser ou eslint-plugin-boundaries.** Exigem dependências npm, o que o projeto evita de propósito.
- **Separar cada tema em paleta e planta de mobília para o campus.** O campus usa as duas partes juntas na sala do projeto, então a divisão não traria ganho.

## Consequências

Positivas:

- As regras de negócio do collector, do runner e do comportamento dos bonecos passam a ser testadas sem HTTP, sem processo e sem navegador.
- Uma seta para fora ou um import quebrado vira teste vermelho.
- O contrato entre os pacotes fica explícito e coberto por testes de contrato: resumo de ferramenta, ids de tema, quem recebe mensagem e corpo da decisão.
- Campus, CLI e landing entram como extensões, sem reescrita.

Negativas:

- Muitos arquivos mudam de lugar num projeto sem git. Por isso o plano começa criando um ponto de volta e anda em passos pequenos, com testes entre eles.
- O runner continua dependendo de o collector estar ao lado, tanto no repositório quanto no pacote npm.
- Os testes do web importam módulos do collector para verificar os contratos. Isso acopla as duas suítes de propósito.
- O código que só roda no navegador (`app/` e `three/`) continua verificado à mão, com um roteiro fixo a cada passo.
