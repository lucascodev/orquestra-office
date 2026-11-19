# Changelog

> **English.** All notable changes to this project are documented in this file, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project has no released version yet, so everything is listed under `[Unreleased]`. Entries are written in Portuguese.

Todas as mudanças relevantes do projeto ficam neste arquivo, no formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). O projeto ainda não tem versão publicada, então tudo está em `[Unreleased]`.

## [Unreleased]

### Adicionado

- **Escritório ao vivo.** Coletor em Node, sem dependências, que roda no Docker em `127.0.0.1:8420` e recebe os eventos do Claude Code pelos hooks e do Codex pelo `notify`. Cada sessão ganha um personagem, e cada subagente senta ao lado de quem o chamou.
- **Sede.** O escritório virou um prédio térreo aberto em pixel art 3D, com uma ilha de 6 lugares por projeto, nas cores do tema dele, e áreas comuns para todos: reunião, copa, sala de jogos, lounge, recepção e quintal. A Sede é a única página do escritório.
- **Câmera e navegação da Sede.** Câmera isométrica interativa, minimapa, seguir um agente e busca `Ctrl K` (`Cmd K` no Mac) de agentes, salas e ações.
- **Interface da Sede.** Alerta de quem precisa de você, gaveta do agente com status, terminal ao vivo ou histórico e caixa de mensagem, ficha da ilha com quem está nela, os números do dia, o tema e "Nova sessão nesta pasta", contagem de mensagens na fila e etiquetas legíveis no zoom distante.
- **Sede no celular.** Abaixo de 720 px, o mapa ocupa a tela e os painéis vão para uma folha de baixo com abas.
- **Vida no escritório.** Bonecos que digitam, leem, levantam a mão e saem pela porta conforme o que o agente faz, com rotina de tempo livre, temperamento próprio, pensamentos, gestos e conversas de delegação e entrega. Caminham por um grafo de corredores sem atravessar os móveis.
- **Decisões pelo navegador.** Aprovar ou recusar pedidos de permissão, responder perguntas do agente e mandar mensagens que chegam no fim do turno.
- **Executor** em `127.0.0.1:8421`, fora do Docker, que abre sessões do Claude Code pelo escritório, com terminal ao vivo, "Interromper" e "Encerrar sessão".
- **Uso, tokens e custo.** Linha de status do escritório que repassa ao coletor o uso das janelas de 5 h e semanal, os tokens e o custo do dia.
- **Modo LAN** com `compose.lan.yaml`, para abrir o escritório no celular na mesma rede.
- **Modo demo** com `?modo=demo`, com agentes de exemplo e nenhuma requisição à API.
- **Landing** em português e inglês, com a demo ao vivo dentro da página e uma prévia estática da Sede em telas estreitas, publicada no GitHub Pages pelo workflow `Pages`.
- **CI** com as cinco suítes de teste (landing, página, coletor, executor e hooks) em todo pull request e push na `main`, actions fixadas por hash e Dependabot para elas.
- Licença MIT.
- ADR 0001, arquitetura em camadas, e ADR 0002, autenticação entre hooks, coletor e painel.
- Arquivos de comunidade: guia de contribuição, código de conduta, política de segurança, modelos de issue e de pull request, `CODEOWNERS` e `.editorconfig`.

### Alterado

- **Arquitetura em camadas** no coletor, no executor, na página e nos hooks: domínio sem I/O, casos de uso, adapters do Claude Code e do Codex separados, composição na borda e um teste de camadas por pacote que lê os imports.
- O coletor e o executor passam a publicar campos estruturados (`actionId`, `subject`) no lugar de frases prontas, e a página monta as frases a partir deles.
- Os instaladores dos hooks passam a separar a montagem do `settings.json` e do `config.toml` da leitura e da gravação dos arquivos, e anotam o que gravaram em `orquestra-office.json`.
- A landing abre a instalação na aba do Docker. O `npx` aparece como "em breve" até o pacote ser publicado.

### Removido

- A aba do time na nuvem, que obrigava o container a montar a raiz do projeto, com o `.env`.
- A página da sala por projeto: a Sede passou a ser a única página, e `?vista=sede` continua aceito sem ser necessário.

### Segurança

- **Hooks.** Os instaladores gravam de forma atômica, preservam um `settings.json` que é symlink, mexem só no que o escritório gravou, recusam um `settings.json` que não é objeto e uma pasta com caractere que o shell interpreta, e guardam só os três backups mais recentes, sem sobrescrever o anterior.
- **Endereço do escritório.** `OFFICE_URL` só aceita um endereço desta máquina. Endereço remoto exige `--allow-remote-office` e `https://`, e um valor recusado desliga o hook em vez de cair no padrão.
- **SessionStart** não executa um `git.exe` plantado no repositório aberto.
- **Coletor.** Recusa leitura e ação vindas de outro site ou de outra porta local, impede que outra página enquadre o escritório, usa `Referrer-Policy: same-origin`, responde `413` e para de ler um corpo acima do limite, limita espectadores e derruba quem não lê o fluxo, corta `cwd` e ids longos, e não cai com chaves de protótipo nem com URL malformada.
- **Executor.** Não cai com URL malformada.
- **Landing.** Política de segurança de conteúdo própria nas páginas e na demo dentro do iframe, e a montagem recusa publicar uma página com o marcador `OWNER` ou apagar uma pasta que não montou.

[Unreleased]: https://github.com/lucascodev/orquestra-office/commits/main
