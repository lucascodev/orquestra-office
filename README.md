# Escritórios dos agentes

Um escritório em pixel art para cada projeto em que você abre o Claude Code ou o Codex. Cada sessão senta numa mesa, os subagentes sentam ao lado dela, e o boneco mostra o que está acontecendo: digitando, lendo, pedindo sua permissão, esperando você, em pausa ou bloqueado.

## O que dá para fazer

| No escritório | Claude Code | Codex |
|---|---|---|
| Personagem e sala por projeto | sim | sim |
| Atividade ao vivo | sim | só o fim de cada turno |
| Aprovar ou recusar um pedido de permissão | sim | não |
| Responder perguntas do agente | sim | não |
| Mandar mensagens | sim: na hora nas sessões abertas pelo escritório, no fim do turno nas demais | não |
| Terminal ao vivo, interromper e encerrar | sim, nas sessões abertas pelo escritório | não |
| Histórico da sessão | sim, somente leitura | não |
| Uso de 5 h e semanal | sim | não |
| Tokens e custo do dia | sim | não |

Clique num personagem, ou no nome dele na lista "Quem está aqui", para abrir a ficha. É nela que ficam os botões de aprovar e recusar, as opções de resposta, a caixa de mensagem e o histórico.

Para alargar o painel lateral, passe o mouse na borda esquerda dele e arraste. A largura fica guardada no navegador; duplo clique na borda volta ao padrão, e com o foco na borda as setas também mudam a largura.

### Terminal da ficha

- Cada linha leva o horário e um ícone colorido pelo tipo de ferramenta: leitura, edição, comando, web, delegação, lista de tarefas.
- As respostas do agente aparecem formatadas como markdown, com listas, negrito, links e blocos de código com cores de sintaxe.
- Uma edição aparece como diff, com as linhas removidas em vermelho e as adicionadas em verde. Um arquivo escrito aparece com as cores da linguagem dele, e um comando aparece com o `$` na frente. Detalhes com mais de 12 linhas vêm recolhidos.
- Comandos e blocos de código têm o botão "copiar".
- Se você rolar para cima para ler, o terminal não puxa você de volta: aparece "↓ novas linhas" quando chega coisa nova.
- O botão de expandir, no canto do terminal, abre o terminal por cima da página; Esc ou o mesmo botão fecha.

## Como funciona

- Um coletor pequeno (Node, sem dependências) roda no Docker em `http://localhost:8420`.
- O Claude Code manda cada evento para ele pelos hooks do tipo `http`, configurados no `~/.claude/settings.json` (vale para todos os projetos).
- O Codex manda um aviso no fim de cada turno pelo `notify` do `~/.codex/config.toml`. O Codex só avisa o fim do turno, então aparece com menos detalhe que o Claude Code.
- O projeto é a pasta onde a sessão começou. Cada projeto novo ganha um escritório próprio em pixel art visto de cima, com um dos 7 temas (Laboratório, Café, Biblioteca, Garagem, Estação espacial, Jardim, Fliperama). Dá para trocar o modelo na própria página.
- O escritório tem ilhas de baias de até 6 lugares (as sessões e seus subagentes sentam juntos, e os lugares livres ficam à vista), sala de reunião, lounge, copa e arquivo. Cada pessoa leva uma etiqueta com o nome, o título e a cor do status.
- A interface segue o Orquestra Design System: os mesmos tokens de cor, tipografia, espaço e raio (`web/styles/tokens.css`), status sempre com glifo e texto, e o painel de terminal do app.
- Uma sessão aberta num worktree entra no escritório do repositório principal, e os papéis definidos em `.claude/agents` do projeto ganham mesa com o nome mesmo quando ninguém está no papel. Só os nomes dos arquivos são lidos.

### Vida no escritório

O boneco reage ao que o agente está fazendo e se move pela sala.

| O agente está | O boneco |
|---|---|
| editando um arquivo | digita |
| lendo ou procurando no código | lê um papel, com a cabeça indo de um lado ao outro |
| rodando um comando | recosta e acompanha, com o balão de terminal |
| pesquisando na web | olha em volta, com o balão de globo |
| começando a pensar no seu pedido | mão no queixo, com os três pontos |
| delegando a um subagente | aponta para o colega |
| organizando a lista de tarefas | escreve, com o balão de lista |
| com uma ferramenta que falhou | balança a cabeça |
| pedindo permissão ou com uma pergunta | levanta a mão, com o balão de exclamação ou interrogação |
| bloqueado por erro | mão no rosto |
| acabou de terminar o turno | recosta na cadeira por alguns segundos, com o balão de visto |
| em pausa ou esperando sua resposta | levanta e vai tomar café na copa, depois segue a rotina de tempo livre |
| livre | vai para o sofá do lounge, depois segue a rotina de tempo livre |
| encerrado | sai pela porta |

**Quem trabalha fica sentado.** Só o tempo livre tira alguém da cadeira. Se chega trabalho para quem está longe da mesa, a pessoa volta apressada. Se as mesas mudam de lugar (um subagente entra ou sai), quem estava sentado já aparece na mesa nova, sem levantar.

Quem está em pausa, esperando sua resposta ou livre não fica parado. Depois de recostar um pouco na mesa, cada um troca de atividade a cada 30 a 55 segundos, num ritmo e numa ordem próprios e sem dois ocuparem o mesmo lugar:

- tomar café na copa ou água no bebedouro;
- olhar pela janela;
- procurar um livro na estante ou uma pasta no arquivo;
- tirar cópias na copiadora;
- escrever no quadro da sala de reunião ou sentar à mesa de reunião;
- regar as plantas;
- cochilar no sofá do lounge;
- alongar na própria mesa, quando todos os lugares estão ocupados.

As atividades disponíveis dependem do que o tema tem na sala: um tema sem estante não tem a atividade da estante. Quem precisa de você ou está bloqueado continua na mesa.

Cada pessoa tem um temperamento próprio, fixo pelo agente: quanto tempo fica sentada depois de terminar, de quanto em quanto tempo troca de atividade, a velocidade do passo, o ritmo da digitação e do piscar. Por isso ninguém se move em sincronia com o colega ao lado. Além disso:

- **Pensamentos.** De vez em quando aparece um balão de pensamento sobre a etiqueta, ligado ao que a pessoa faz: o arquivo que edita, o comando que roda, o colega a quem delegou, ou o café e a janela no tempo livre. Ficam visíveis no máximo três por vez, sempre os mais recentes.
- **Gestos na mesa.** Quem trabalha sentado para um instante de tempos em tempos: olha para o lado, alonga o pescoço, coça a cabeça, toma um gole de café, recosta com as mãos atrás da cabeça ou esfrega os olhos.
- **Piscar.** Todos piscam, menos quem cochila.

#### Conversas

Os bonecos conversam entre si, com balão de fala e falando um de cada vez, virados para quem está ouvindo:

- **Delegação.** Quando um subagente começa, o agente principal se vira para ele e passa a tarefa ("Bia, pode pegar essa pra mim?"), e o subagente responde. Os dois continuam sentados, porque estão trabalhando.
- **Entrega.** Quando o subagente termina, ele leva o resultado em mãos até a mesa do agente principal, avisa que está pronto, ouve o agradecimento e só então sai pela porta. Se o agente principal não estiver na mesa, o subagente vai direto embora.
- **Papo no tempo livre.** Quem está livre e para perto de outra pessoa (no café, no sofá, na janela) puxa conversa. O papo continua enquanto estiverem juntos, mudando de assunto de tempos em tempos.

Quem está conversando não mostra balão de pensamento.

Quem chega depois que a sala já está aberta entra pela porta e anda até a mesa. Todos caminham pelos corredores, sem atravessar as mesas. Com "reduzir movimento" ligado no sistema, ninguém anda: cada um aparece direto no lugar.

### Abrir sessões pelo escritório

Hooks só observam uma sessão que você abriu no terminal. Para ter terminal ao vivo e mensagem na hora, o escritório precisa ser o dono da sessão. Isso é feito pelo executor, um processo pequeno (Node, sem dependências) que roda na sua máquina, fora do Docker:

```powershell
node runner/src/main.js
```

Com ele ligado, a página mostra "Abrir sessão…". Você informa a pasta do projeto e a primeira mensagem, e o executor abre o Claude Code nessa pasta em modo de fluxo. Na ficha do agente aparecem o terminal ao vivo (o texto chega enquanto o agente escreve), "Interromper" e "Encerrar sessão". As permissões dessas sessões chegam ao escritório como as de qualquer outra.

- É o Claude Code em modo não interativo, não a tela do terminal: não há comandos de barra nem a interface do Claude Code, só a conversa.
- O executor escuta em `127.0.0.1:8421` e só aceita a página do escritório. Variáveis: `OFFICE_RUNNER_PORT`, `OFFICE_ORIGINS`, `CLAUDE_BIN` e `OFFICE_RUNNER_MODEL`.
- As sessões abertas por ele são encerradas quando o executor para.

### Aprovar, recusar e responder

Quando o Claude Code vai pedir uma permissão ou fazer uma pergunta, o hook segura o pedido no coletor e ele aparece no escritório. Você decide lá e a resposta volta para a sessão.

- O pedido só é segurado se houver uma página do escritório aberta. Sem página aberta, ele vai direto para o terminal, como sempre.
- O coletor segura o pedido por até 120 segundos (variável `OFFICE_HOLD_SECONDS` do container). Sem resposta nesse prazo, ou se você clicar em "Decidir no terminal", o pedido volta para o terminal.
- Enquanto o pedido está segurado, o terminal mostra "Esperando você no escritório".
- Ao recusar, você pode escrever o motivo. O agente lê esse motivo.

### Mandar mensagens

Nas sessões abertas pelo escritório, a mensagem chega na hora. Nas sessões que você abriu no terminal, a mensagem escrita na ficha fica numa fila e chega ao agente quando ele termina o turno atual: em vez de parar, ele lê a mensagem e continua. Uma sessão que já está parada esperando você no terminal só recebe a mensagem no fim do próximo turno, porque os hooks não conseguem acordar uma sessão parada.

### Uso, tokens e custo

O Claude Code só entrega esses números para a linha de status do terminal. O instalador configura a linha de status do escritório (`hooks/office-statusline.mjs`), que repassa os números ao coletor e mostra no terminal o modelo, o uso das janelas de 5 h e semanal e o custo da sessão.

- As janelas de 5 h e semanal aparecem no topo da página. Elas só existem para assinantes do claude.ai e depois da primeira resposta da sessão.
- "Tokens hoje" e "custo hoje" são por projeto e contam o que foi gasto com o escritório ligado. O custo é a estimativa do próprio Claude Code, a preço de tabela.
- Se você já tem uma linha de status sua, o instalador não mexe nela e avisa. Sem a linha de status do escritório, esses números ficam vazios.

## O que fica guardado

**No disco** (volume `office-data`), só o necessário para desenhar o escritório: pasta do projeto, id da sessão, nome do subagente, nome da ferramenta, nome do arquivo (sem o caminho), o primeiro termo do comando (por exemplo `cargo`, nunca os argumentos) e os totais de tokens e custo.

**Só na memória do coletor**, para o histórico e para você decidir com contexto: o texto dos seus pedidos, os comandos completos, a última resposta do agente em cada turno, os pedidos de permissão pendentes e as mensagens na fila. Nada disso vai para o disco, e tudo se perde quando o container reinicia. O histórico guarda no máximo 200 registros por sessão.

Por padrão, o coletor só aceita conexões da sua máquina (`127.0.0.1`), e as ações de controle recusam pedidos vindos de outro site aberto no navegador.

### Abrir na rede local

Para usar o escritório no celular, publique a porta também no IP da máquina na rede local. O arquivo `.env` desta pasta guarda esse IP em `OFFICE_LAN_IP`, e o `compose.lan.yaml` acrescenta a porta e libera esse endereço no coletor:

```powershell
docker compose -f compose.yaml -f compose.lan.yaml up -d --build
```

No celular, na mesma rede, abra `http://<OFFICE_LAN_IP>:8420`. Para voltar ao modo só local, rode `docker compose up -d` sem o segundo arquivo.

- O escritório não tem senha. Qualquer aparelho na mesma rede consegue ver as sessões, aprovar permissões e mandar mensagens aos agentes. Só ligue em rede em que você confia.
- Em HTTP pela rede, o navegador não diz de qual página veio cada pedido, então o coletor recusa a leitura que chega com o `Origin` de outro endereço. Uma `<img>` apontada para o escritório não manda `Origin`: outra página aberta num aparelho da rede ainda consegue contar como espectador, e enquanto ela estiver aberta os pedidos de permissão esperam no escritório em vez de ir direto para o terminal. Ela não consegue ler nada.
- Se o IP da máquina mudar, atualize `OFFICE_LAN_IP` no `.env` e suba de novo.
- O executor continua só em `127.0.0.1`. "Abrir sessão…", terminal ao vivo, interromper e encerrar não funcionam pelo celular.

## Instalar

No PowerShell, nesta pasta:

```powershell
docker compose up -d --build
node hooks/install-claude-hooks.mjs
node hooks/install-codex-notify.mjs
```

Abra http://localhost:8420. As sessões do Claude Code e do Codex abertas **depois** da instalação aparecem sozinhas.

Depois de atualizar esta pasta, rode de novo os três comandos: o primeiro reconstrói o coletor e os outros dois atualizam os hooks.

Os dois scripts só mexem no que o escritório gravou. As URLs e os comandos exatos ficam anotados em `orquestra-office.json`, na mesma pasta da configuração, e um hook seu que apenas se pareça com o do escritório fica onde está. Eles podem rodar de novo sem duplicar nada e, quando não há nada a mudar, não gravam nem fazem backup. O do Codex não sobrescreve um `notify` que você já tenha: ele avisa e não muda nada.

- **Backup.** Antes de gravar, cada script copia o arquivo para `settings.json.bak-<data>` ou `config.toml.bak-<data>` e guarda só os três backups mais recentes. A cópia é inteira: se o `env` do seu `settings.json` tiver tokens ou senhas, o backup também terá. No macOS e no Linux o backup fica legível só pelo seu usuário; no Windows ele herda as permissões da pasta.
- **Gravação.** O arquivo é trocado de uma vez, e um `settings.json` que seja symlink continua symlink. Se o Claude Code salvar o arquivo enquanto o script roda, nada é gravado e o script pede para rodar de novo.
- **Endereço.** Os hooks falam com `http://127.0.0.1:8420`. Para usar outra porta, defina `OFFICE_URL` antes de instalar, com um endereço desta máquina (`127.0.0.1`, `localhost` ou `[::1]`) e sem caminho. Endereço de outra máquina só com `--allow-remote-office` e `https://`, porque os hooks mandam para lá os comandos e as respostas das ferramentas e recebem de lá as decisões de permissão. Os dois scripts gravados (`office-session-start.mjs` e `office-statusline.mjs`) leem `OFFICE_URL` durante a sessão e só aceitam um endereço desta máquina; com outro valor, usam o padrão.
- **Pasta.** O caminho desta pasta vai dentro do comando gravado, então o instalador recusa um caminho com caracteres que o shell interpreta, como `$`, crase, aspas ou `;`.

## Desinstalar

```powershell
node hooks/install-claude-hooks.mjs --remove
node hooks/install-codex-notify.mjs --remove
docker compose down
```

O `--remove` tira só o que o escritório gravou e a anotação correspondente em `orquestra-office.json`. Se o arquivo de configuração não existir, ele não cria nada.

Se o container estiver parado, os hooks falham rápido e o Claude Code continua normalmente (`onFailure: "continue"`).

## Desenvolvimento

```powershell
cd collector
npm test
cd ../runner
npm test
cd ..
node --test web/test/*.test.js
node --test hooks/test/*.test.mjs
```

Os testes de `web/test` cobrem as regras de comportamento dos bonecos (onde cada um fica, a demora antes de levantar, os gestos, os pensamentos e as conversas) e a formatação do terminal, que não dependem do navegador.

Os testes de `hooks/test` rodam os instaladores com `CLAUDE_CONFIG_DIR` e `CODEX_HOME` numa pasta temporária e os dois hooks contra um escritório falso em `127.0.0.1`, então não mexem na sua configuração. A montagem do `settings.json` e do `config.toml` fica em `hooks/lib`, separada da leitura e da gravação dos arquivos. Os dois hooks gravados no `settings.json` (`office-session-start.mjs` e `office-statusline.mjs`) não mudam de nome nem de lugar, porque as sessões abertas apontam para eles.

A página não tem etapa de build: as bibliotecas ficam copiadas em `web/vendor`, com a licença de cada uma ao lado.

| Biblioteca | Versão | Para quê |
|---|---|---|
| three.js | r187 | a sala em 3D |
| marked | 18.1.3 | markdown das respostas no terminal |
| DOMPurify | 3.4.17 | limpar o HTML gerado do markdown antes de mostrar |
| highlight.js | 11.12.0 (build ES do `@highlightjs/cdn-assets`) | cores de sintaxe |

Para atualizar uma delas, baixe o pacote do npm, confira o hash `integrity` do registro e substitua o arquivo em `web/vendor`. O DOMPurify vai com a extensão `.js`, porque o servidor do coletor não serve `.mjs`.
