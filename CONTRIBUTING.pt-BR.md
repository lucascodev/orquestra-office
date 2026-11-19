[English](CONTRIBUTING.md) | **Português (Brasil)**

# Como contribuir

Obrigado pelo interesse no Orquestra Office. Este guia mostra como rodar o projeto, como testar e o que uma mudança precisa ter para entrar.

## Antes de começar

- Para uma mudança grande (funcionalidade nova, mudança de contrato entre coletor, hooks e página, nova camada), abra uma issue antes e descreva a ideia. Assim ninguém perde trabalho com algo que não cabe no projeto.
- Correção pequena, teste que falta ou texto errado podem ir direto num pull request.
- Falha de segurança não vai em issue pública: siga a [política de segurança](SECURITY.pt-BR.md).
- Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.pt-BR.md).

## Idiomas

O projeto é bilíngue, com o inglês como idioma principal no GitHub.

| O quê | Idioma |
|---|---|
| `README`, `CONTRIBUTING`, `CODE_OF_CONDUCT` | inglês no arquivo principal e português no `.pt-BR.md` ao lado, com links entre os dois no topo |
| Modelos de issue e de pull request | inglês, com o aviso de que português também vale |
| Issues, pull requests e revisões | inglês ou português, como você preferir |
| Landing (`site/`) | português e inglês, com a mesma estrutura |
| ADRs (`docs/adr/`) e `docs/arquitetura/` | só português: são documentos internos de decisão e não ganham tradução |
| Texto da interface do escritório | português |
| Código, nomes, comentários e mensagens de log | inglês |
| Mensagens de commit | português |

Os termos do produto têm um nome fixo em cada língua no [glossário](docs/glossary.md). Use os nomes de lá ao escrever em qualquer uma das duas.

Mudou um arquivo que tem as duas versões? Mude a outra no mesmo pull request. Se você não escreve bem numa das línguas, diga isso na descrição e a revisão ajuda com a tradução.

## Requisitos

| Ferramenta | Para quê |
|---|---|
| Node 22 ou mais novo | coletor, executor, hooks, testes e montagem da landing |
| Git | clonar e fazer commits |
| Docker com Compose | opcional: rodar o coletor como o usuário final roda |
| Claude Code ou Codex | opcional: ver sessões reais no escritório |
| Python 3 | opcional: servir a landing montada |

O projeto não tem dependências npm. Não existe `npm install` a rodar.

## Rodar localmente

### Só a página, com dados de exemplo

Suba o coletor direto pelo Node, sem Docker:

```powershell
cd collector
npm start
```

Abra `http://localhost:8420/?modo=demo`. No modo demo a página não faz nenhuma requisição à API e mostra agentes de exemplo. Sem `?modo=demo`, a página usa o coletor e, se ele não responder, cai para a demo.

O coletor escuta em `127.0.0.1:8420`, serve a pasta `web/` e guarda o estado em `collector/data/`, que o Git ignora. As variáveis `PORT`, `OFFICE_HOST`, `OFFICE_HOLD_SECONDS`, `OFFICE_ALLOWED_HOSTS`, `WEB_DIR` e `DATA_DIR` mudam esses padrões.

A página não tem etapa de build: edite um arquivo em `web/` e recarregue o navegador.

### Com sessões reais

Siga a seção de instalação do [README](README.pt-BR.md#instalar). Os instaladores gravam na sua configuração do Claude Code (`settings.json`) e do Codex (`config.toml`). Para experimentar sem mexer na sua configuração, aponte `CLAUDE_CONFIG_DIR` e `CODEX_HOME` para uma pasta temporária antes de instalar e de abrir a sessão:

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

Abra o Claude Code ou o Codex no mesmo terminal, com as variáveis ainda definidas. Como a pasta de configuração é nova, a sessão pode pedir login de novo.

O executor, que abre sessões pelo escritório, roda fora do Docker e escuta em `127.0.0.1:8421`:

```powershell
node runner/src/main.js
```

### Landing

A landing fica em `site/`, em português (`site/index.html`) e inglês (`site/en/index.html`). Para ver o site montado, com o escritório em `demo/`:

```powershell
node site/assemble.mjs _site
python -m http.server 8000 -d _site
```

Mudou uma página da landing? Mude a outra língua no mesmo pull request. O teste `site/test/pages.test.mjs` compara a estrutura das duas.

### Capturas de tela

As imagens do README ficam em `docs/images/`. Tire sempre com `?modo=demo`, que só tem nomes e projetos fictícios, e nunca do seu escritório ao vivo. Antes do commit, otimize o PNG (paleta reduzida quando não houver perda visível) e confira que nenhuma captura mostra caminho, nome de usuário ou projeto seu.

## Testes

São cinco pacotes, cada um com a própria suíte. Rode a do pacote que você mexeu e, antes do pull request, todas:

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

Os comandos são os mesmos no PowerShell e no bash. O workflow de CI (`.github/workflows/ci.yml`) roda as cinco suítes com Node 22 em todo pull request e em todo push na `main`.

- `web/test` cobre as regras de comportamento dos bonecos, a Sede, a formatação do terminal e o contrato entre o backend ao vivo e o de demonstração, sem navegador.
- `hooks/test` roda os instaladores com `CLAUDE_CONFIG_DIR` e `CODEX_HOME` numa pasta temporária e os hooks contra um escritório falso em `127.0.0.1`. Não mexe na sua configuração.
- `collector/test` e `runner/test` sobem servidores em portas livres de `127.0.0.1`.

## Regras do código

### Arquitetura em camadas

O projeto segue Clean Architecture, com a dependência apontando para dentro: domínio, depois casos de uso, depois adapters e infraestrutura, e a composição na borda. A decisão está no [ADR 0001](docs/adr/0001-arquitetura-em-camadas.md).

- O domínio não faz I/O: nada de rede, disco, DOM, `three.js` ou relógio direto. Regra de decisão vai para o domínio e ganha teste sem navegador e sem servidor.
- A camada de apresentação (views, `three/`, rotas HTTP) só traduz e mostra. Regra de negócio não fica nela.
- Um arquivo, uma responsabilidade. Contrato, dado e lógica ficam em arquivos separados.
- As regras de camada são verificadas por teste, lendo os imports de cada arquivo: `collector/test/architecture.test.js`, `runner/test/architecture.test.js` e `web/test/architecture.test.js`. Em `hooks/`, o `hooks/test/hook-imports.test.mjs` garante que os hooks gravados no `settings.json` só importam módulos `node:` e `./lib/`. Se a sua mudança quebra um desses testes, mude o código, não o teste. Mudar a regra pede um ADR novo em `docs/adr/`.
- O backend ao vivo e o de demonstração da página têm os mesmos métodos (`web/test/backends.test.js`). Método novo entra nos dois.
- `hooks/office-session-start.mjs` e `hooks/office-statusline.mjs` não mudam de nome nem de lugar, porque as sessões já abertas apontam para eles.

### Teste primeiro

Escreva o teste antes do código e veja ele falhar pelo motivo certo. Depois faça passar. Em correção de bug, o teste reproduz o bug. O nome do teste diz o comportamento, não a função: "recém-chegado não tira quem já estava na única vaga", e não "testa chooseSpot".

### Sem dependências npm

- Coletor, executor e hooks usam só módulos `node:` do Node 22.
- As bibliotecas do navegador ficam copiadas em `web/vendor`, com a licença ao lado. Para atualizar uma delas, siga a seção de desenvolvimento do README: baixe o pacote do npm, confira o hash `integrity` do registro e troque o arquivo.
- Biblioteca nova em `web/vendor` precisa de uma issue antes, com o motivo e a licença.

### Sem build na página

A página em `web/` é HTML, CSS e módulos ES servidos como estão. Nada de bundler, transpilador ou pré-processador. O servidor do coletor não serve `.mjs`, então o código da página usa `.js`.

### Estilo

- Siga a tabela da seção [Idiomas](#idiomas): código em inglês, interface e commits em português.
- Nomes que dizem o que a coisa é. Booleanos com `is`, `has` ou `should`.
- Constantes nomeadas no lugar de números e textos soltos.
- Sem comentário que repete o código. Comente só o porquê: uma decisão, um limite, uma armadilha.
- Sem código morto, import sem uso ou código comentado "para depois". O `web/test/architecture.test.js` acusa import sem uso na página.
- Indentação de 2 espaços, UTF-8 e fim de linha LF, como manda o `.editorconfig`.

## Dados pessoais e segredos

Este repositório é público, e tudo o que entra no histórico fica lá. Em código, testes, fixtures, logs, capturas de tela e descrições de issue ou pull request:

- nada de caminho real com o seu usuário (`C:\Users\<seu nome>\...`, `/Users/<seu nome>/...`);
- nada de e-mail, nome real, IP da sua rede, nome de máquina ou de projeto privado;
- nada de token, chave, senha ou o conteúdo do `env` do seu `settings.json`;
- nada de conteúdo copiado de um `settings.json`, `config.toml` ou backup real;
- nada de texto real de sessões: pedidos, respostas do agente, comandos com argumentos.

Use dados fictícios que continuem cobrindo o caso. Os testes já fazem assim, por exemplo `C:\Users\ana\My Projects\escritorio_v2\hooks` para cobrir pasta com espaço e sublinhado, e `/home/me/src/orquestra-office/hooks` no Linux.

Se você commitou algo assim por engano, não tente consertar com outro commit: avise no pull request para que o histórico seja reescrito antes do merge.

## Commits

Os commits seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/), em português.

```text
<tipo>(<escopo>): <o que muda, do ponto de vista de quem usa>

<corpo opcional: por que a mudança foi feita e o que ela evita>
```

| Tipo | Quando |
|---|---|
| `feat` | comportamento novo |
| `fix` | correção de comportamento |
| `refactor` | muda a estrutura sem mudar o comportamento |
| `perf` | melhora de desempenho |
| `test` | só testes |
| `docs` | só documentação |
| `ci` | workflows do GitHub Actions |
| `chore` | manutenção que não muda o produto |

Escopos usados: `web`, `collector`, `runner`, `hooks`, `site`, `adr` e `arquitetura`. Mudança que atravessa vários pacotes pode ficar sem escopo.

Exemplos do histórico:

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

- O assunto começa com letra minúscula, fica no presente, não termina com ponto e descreve o efeito, não o arquivo.
- O corpo explica o porquê, em parágrafos curtos.
- Um commit por parte lógica: cada um conta uma história sozinho e pode ser revertido em separado.
- Sem trailer `Co-Authored-By` e sem assinatura gerada por ferramenta.

Não escreve em português? Mande o pull request com commits em inglês e avise na descrição: quem faz o merge ajusta as mensagens.

## Pull requests

1. Faça um fork e crie uma branch a partir da `main`, com o tipo no nome: `feat/busca-na-sede`, `fix/backup-do-instalador`, `docs/guia-de-instalacao`.
2. Faça a mudança com teste primeiro e rode as cinco suítes.
3. Atualize o README (nas duas línguas) ou a documentação em `docs/` quando a mudança altera como o sistema é usado, instalado ou guardado.
4. Decisão de arquitetura (camada nova, contrato novo, dependência nova) vira um ADR curto em `docs/adr/`, em português, com o próximo número livre.
5. Abra o pull request contra a `main` e preencha o modelo: resumo, como testar e o checklist.
6. Um assunto por pull request. Duas mudanças independentes vão em dois.
7. Espere o CI ficar verde. A revisão pode pedir ajustes; responda nos comentários e faça novos commits na mesma branch.

## Licença

Ao contribuir, você concorda que a sua contribuição é publicada sob a [licença MIT](LICENSE) do projeto.
