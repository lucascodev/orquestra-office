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

- Um coletor pequeno (Node, sem dependências) roda no Docker em `http://127.0.0.1:8420`.
- O Claude Code manda cada evento para ele pelos hooks configurados no `~/.claude/settings.json` (vale para todos os projetos). A atividade vai pelo `curl` do sistema, em segundo plano, sem atrasar as ferramentas. Pedidos de permissão, perguntas e o fim do turno passam por `hooks/office-decision.mjs`, que assina o pedido e só aceita uma resposta assinada pelo coletor.
- O Codex manda um aviso no fim de cada turno pelo `notify` do `~/.codex/config.toml`. O Codex só avisa o fim do turno, então aparece com menos detalhe que o Claude Code.
- Hooks, coletor e executor se reconhecem por um segredo que o instalador cria em `~/.orquestra-office/secret`. Cada navegador que abre o escritório precisa estar pareado (veja [Parear navegadores e aparelhos](#parear-navegadores-e-aparelhos)).
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
- O executor escuta em `127.0.0.1:8421` e só atende quem traz um token dele. A página pareada consegue o token sozinha: pede um desafio ao executor, o coletor assina o desafio com o segredo e o executor troca a assinatura por um token de 12 horas. Um processo qualquer da máquina, sem o segredo, não abre sessão nem manda mensagem. Variáveis: `OFFICE_RUNNER_PORT`, `OFFICE_ORIGINS`, `CLAUDE_BIN`, `OFFICE_RUNNER_MODEL` e `OFFICE_SECRET_FILE` (padrão `~/.orquestra-office/secret`).
- As sessões abertas por ele são encerradas quando o executor para.

### Aprovar, recusar e responder

Quando o Claude Code vai pedir uma permissão ou fazer uma pergunta, o hook segura o pedido no coletor e ele aparece no escritório. Você decide lá e a resposta volta para a sessão.

- O pedido só é segurado se houver uma página pareada do escritório aberta. Sem ela, ele vai direto para o terminal, como sempre.
- Quem decide é só a página pareada. Se a resposta do coletor não vier assinada com o segredo desta máquina (coletor antigo, coletor parado e outro programa na porta 8420), o pedido vai para o terminal. Uma aprovação vinda do escritório nunca reescreve o comando, nunca grava regra de permissão e nunca muda o modo de permissão da sessão.
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

**Aparelhos pareados** (`devices.json`, no mesmo volume): o nome do navegador, o endereço por onde foi aberto, as datas e o hash SHA-256 do cookie, nunca o cookie. Um aparelho sem uso por 30 dias sai da lista.

**Só na memória do coletor**, para o histórico e para você decidir com contexto: o texto dos seus pedidos, os comandos completos, a última resposta do agente em cada turno, os pedidos de permissão pendentes, as mensagens na fila e os códigos de pareamento ainda não usados. Nada disso vai para o disco, e tudo se perde quando o container reinicia. O histórico guarda no máximo 200 registros por sessão.

**Na sua pasta pessoal** (`~/.orquestra-office`, criada pelo instalador e legível só pelo seu usuário): `secret`, a chave que hooks, coletor e executor compartilham, e `activity.header`, o cabeçalho com o token de atividade que o `curl` lê. O token fica num arquivo, e não na linha de comando, porque no macOS e no Linux qualquer usuário vê a linha de comando dos processos.

Por padrão, o coletor só aceita conexões da sua máquina (`127.0.0.1`). Todo `/api/*` exige um navegador pareado, e as ações de controle recusam pedidos vindos de outro site aberto no navegador ou sem a origem da própria página.

### Parear navegadores e aparelhos

Cada navegador recebe um cookie de 90 dias, renovado sempre que a página carrega, também nesta máquina. Sem ele, a página mostra "Este navegador não está pareado".

- **Neste computador:** rode `node hooks/open-office.mjs` na pasta do escritório. Ele pede ao coletor um desafio de uso único, que vale 30 segundos, e depois um código, com um pedido assinado pelo segredo que leva esse desafio; um pedido copiado no caminho não serve de novo. Em seguida, abre o escritório já pareado no navegador padrão, em `http://127.0.0.1:8420`. Para outro navegador, copie o endereço que o comando mostra; ele vale uma vez, por 2 minutos.
- **Use `127.0.0.1`, não `localhost`.** O cookie vale só para o endereço em que foi recebido. No Windows, `localhost` resolve primeiro para `::1`, onde outro processo pode estar escutando e receberia o código de pareamento e o cookie. Por isso o comando abre o endereço exato em que o coletor escuta.
- **Em outro aparelho:** num navegador já pareado, clique em **Aparelhos** e depois em **Parear aparelho**. Leia o QR com o outro aparelho ou abra o link nele, também uma vez e por 2 minutos.
- **Revogar:** em **Aparelhos**, "Revogar" desconecta o aparelho na hora; "Sair deste" desconecta o navegador atual.
- **Girar o segredo** (`node hooks/install-claude-hooks.mjs --rotate-secret`) é o botão de pânico: invalida todos os aparelhos, os tokens do executor e qualquer hook com o segredo antigo. No Docker, rode `docker compose restart office` depois, porque o arquivo montado não muda dentro do container.

### Abrir na rede local

Para usar o escritório no celular, publique a porta também no IP da máquina na rede local. O arquivo `.env` desta pasta guarda esse IP em `OFFICE_LAN_IP`, e o `compose.lan.yaml` acrescenta a porta e libera esse endereço no coletor:

```powershell
docker compose -f compose.yaml -f compose.lan.yaml up -d --build
```

Para usar no celular, pareie o aparelho pelo QR (**Aparelhos**, **Parear aparelho**, num navegador já pareado). O link do QR já aponta para `http://<OFFICE_LAN_IP>:8420`. Para voltar ao modo só local, rode `docker compose up -d` sem o segundo arquivo.

- Um aparelho da rede que não foi pareado não vê nada: todo `/api/*` responde `401`, também para quem manda `Host: localhost`. As rotas dos hooks exigem o token ou a assinatura.
- Pareado, o aparelho tem controle total: vê as sessões, aprova permissões e manda mensagens. Revogue em **Aparelhos** um aparelho perdido.
- O modo rede é HTTP: quem escuta o tráfego da rede consegue copiar o cookie de um aparelho pareado. Só ligue em rede em que você confia.
- Só páginas pareadas contam como espectador; uma página qualquer aberta na rede não segura pedidos de permissão longe do terminal.
- Se o IP da máquina mudar, atualize `OFFICE_LAN_IP` no `.env` e suba de novo.
- O executor continua só em `127.0.0.1`. "Abrir sessão…", terminal ao vivo, interromper e encerrar não funcionam pelo celular.

## Instalar

Com o Node 22 ou mais novo e o `curl` do sistema (o Windows 10 1803 ou mais novo já traz `C:\Windows\System32\curl.exe`; no macOS, `/usr/bin/curl`), no PowerShell, nesta pasta:

```powershell
node hooks/install-claude-hooks.mjs
node hooks/install-codex-notify.mjs
docker compose up -d --build
node hooks/open-office.mjs
```

Os instaladores vêm primeiro porque criam o segredo em `~/.orquestra-office/secret`, que o `compose.yaml` monta no container. O último comando abre o escritório já pareado no navegador padrão. As sessões do Claude Code e do Codex abertas **depois** da instalação aparecem sozinhas.

Depois de atualizar esta pasta, rode de novo os dois instaladores e `docker compose up -d --build`.

### Atualizar de uma versão com hooks `http`

Os hooks antigos do tipo `http` deixam de valer: o coletor novo responde a eles sem efeito, e a página avisa "Há hooks de uma versão antiga neste computador". O aviso some 10 minutos depois do último pedido de um hook antigo. Para migrar:

1. Rode `node hooks/install-claude-hooks.mjs` uma vez para cada pasta de configuração do Claude Code que você usa (com `CLAUDE_CONFIG_DIR` apontando para ela) e `node hooks/install-codex-notify.mjs`. O instalador troca as entradas `http` pelas novas, cria o segredo e avisa que migrou.
2. Reconstrua o coletor com `docker compose up -d --build`. Ele lê o segredo de `~/.orquestra-office/secret`; se o arquivo não existir, rode o instalador antes.
3. Rode `node hooks/open-office.mjs` para parear o navegador. Pareie o celular pelo QR em **Aparelhos**.
4. Reinicie o executor, se você usa: `node runner/src/main.js`.

As sessões já abertas continuam com os hooks antigos até serem fechadas.

Os dois scripts só mexem no que o escritório gravou. Os comandos exatos ficam anotados em `orquestra-office.json`, na mesma pasta da configuração, e um hook seu que apenas se pareça com o do escritório fica onde está. Eles podem rodar de novo sem duplicar nada e, quando não há nada a mudar, não gravam nem fazem backup. O do Codex não sobrescreve um `notify` que você já tenha: ele avisa e não muda nada.

- **Backup.** Antes de gravar, cada script copia o arquivo para `settings.json.bak-<data>` ou `config.toml.bak-<data>` e guarda só os três backups mais recentes. A cópia é inteira: se o `env` do seu `settings.json` tiver tokens ou senhas, o backup também terá. No macOS e no Linux o backup fica legível só pelo seu usuário; no Windows ele herda as permissões da pasta.
- **Gravação.** O arquivo é trocado de uma vez, e um `settings.json` que seja symlink continua symlink. Se o Claude Code salvar o arquivo enquanto o script roda, nada é gravado e o script pede para rodar de novo.
- **Endereço.** Os hooks falam com `http://127.0.0.1:8420`. Para usar outra porta, defina `OFFICE_URL` antes de instalar, com um endereço desta máquina (`127.0.0.1` ou `[::1]`) e sem caminho. Um `localhost` vira `127.0.0.1`, porque no Windows ele resolve primeiro para `::1`, onde outro processo poderia estar escutando. Isso vale também para o `--office-url` que uma instalação anterior gravou; o `curl` da atividade só muda quando você reinstala. Endereço de outra máquina só com `--allow-remote-office` e `https://`, porque os hooks mandam para lá os comandos e as respostas das ferramentas. O endereço fica gravado em todos os comandos (no `curl` da atividade e no `--office-url` de `office-session-start.mjs`, `office-statusline.mjs` e `office-decision.mjs`), e o caminho do segredo, no de `office-decision.mjs`. Nenhum deles lê `OFFICE_URL` durante a sessão, porque o `.claude/settings.json` de um projeto pode definir variáveis de ambiente e mandar o token para outro lugar. Um comando gravado por uma versão anterior, sem `--office-url`, usa o padrão até você reinstalar.
- **Pasta.** O caminho desta pasta e o do segredo vão dentro do comando gravado, então o instalador recusa um caminho com caracteres que o shell interpreta, como `$`, crase, aspas ou `;`.
- **Segredo.** O instalador cria `~/.orquestra-office/secret` quando falta e nunca o sobrescreve; `--rotate-secret` troca a chave (veja [Parear navegadores e aparelhos](#parear-navegadores-e-aparelhos)). Rodado num terminal, o instalador do Claude Code termina abrindo o escritório já pareado, se o coletor responder.

## Desinstalar

```powershell
node hooks/install-claude-hooks.mjs --remove
node hooks/install-codex-notify.mjs --remove
docker compose down
```

O `--remove` tira só o que o escritório gravou. Em `orquestra-office.json`, a anotação do Codex é apagada e a do Claude fica vazia, para que uma instalação seguinte não confunda um script ou um `curl` seu com os do escritório, como se fossem de uma instalação antiga. Se o arquivo de configuração não existir, ele não cria nada. O segredo fica onde está; para apagá-lo, remova a pasta `~/.orquestra-office` (no PowerShell, `Remove-Item -Recurse "$HOME\.orquestra-office"`; no macOS, `rm -r ~/.orquestra-office`).

Se o container estiver parado, a atividade se perde sem aviso, as decisões voltam para o terminal e o Claude Code continua normalmente.

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

Os testes de `hooks/test` rodam os instaladores com `CLAUDE_CONFIG_DIR` e `CODEX_HOME` numa pasta temporária, com `HOME` e `USERPROFILE` numa pasta descartável (o segredo de teste fica lá), e os hooks contra um escritório falso em `127.0.0.1` que assina as respostas, então não mexem na sua configuração. A montagem do `settings.json` e do `config.toml` fica em `hooks/lib`, separada da leitura e da gravação dos arquivos. Os três hooks gravados no `settings.json` (`office-session-start.mjs`, `office-statusline.mjs` e `office-decision.mjs`) não mudam de nome nem de lugar, porque as sessões abertas apontam para eles.

O protocolo assinado tem duas cópias, `collector/src/shared/auth/signed-message.js` e `hooks/lib/signed-message.mjs`, porque a pasta `hooks/` precisa continuar copiável sozinha. Os testes das duas usam os mesmos vetores fixos, e uma mudança em só uma delas quebra o teste.

A página não tem etapa de build: as bibliotecas ficam copiadas em `web/vendor`, com a licença de cada uma ao lado.

| Biblioteca | Versão | Para quê |
|---|---|---|
| three.js | r187 | a sala em 3D |
| marked | 18.1.3 | markdown das respostas no terminal |
| DOMPurify | 3.4.17 | limpar o HTML gerado do markdown antes de mostrar |
| highlight.js | 11.12.0 (build ES do `@highlightjs/cdn-assets`) | cores de sintaxe |
| uqr | 0.1.3 (`dist/index.mjs`) | QR para parear outro aparelho; a página desenha o SVG a partir da matriz |

Para atualizar uma delas, baixe o pacote do npm, confira o hash `integrity` do registro e substitua o arquivo em `web/vendor`. O DOMPurify e o uqr vão com a extensão `.js`, porque o servidor do coletor não serve `.mjs`.

### Landing

A landing fica em `site/`, com a página em português em `site/index.html` e a em inglês em `site/en/index.html`. O `site/assemble.mjs` monta o site publicado: a landing na raiz e o escritório em `demo/`, que abre em modo demo dentro da página.

As páginas apontam para o repositório `Lucascodev/orquestra-office` e para o endereço `https://lucascodev.github.io/orquestra-office/`. Num fork, troque esses dois nas duas páginas. Se sobrar o marcador `OWNER` numa página, a montagem para com erro e o deploy não acontece.

Para ver o site montado antes de publicar:

```powershell
node --test site/test/*.test.mjs
node site/assemble.mjs _site
python -m http.server 8000 -d _site
```

A montagem só substitui uma pasta que não existe, que está vazia ou que ela mesma montou antes (com o arquivo `.site-assembly`), então ela não apaga uma pasta sua por engano.

Para publicar, em Settings, Pages, escolha a fonte "GitHub Actions". O workflow `Pages` roda os testes, monta o site e publica a cada push na `main`, e também pode ser disparado à mão.
