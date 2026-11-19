const MIN = 60_000;

const item = (id, text, status, activeText) => ({ id: String(id), text, status, activeText });

export function notifyChecklist(now) {
  return {
    updatedAt: now - MIN / 2,
    items: [
      item(1, "Ler como o instalador trata o notify de outro programa", "completed", "Lendo o instalador"),
      item(2, "Criar codex-chain.mjs com montagem e leitura do comando", "completed", "Criando codex-chain.mjs"),
      item(3, "Encadear no applyNotify e no instalador", "completed", "Encadeando no applyNotify"),
      item(4, "Escrever office-codex-notify.mjs", "completed", "Escrevendo office-codex-notify.mjs"),
      item(5, "Rodar a suíte de hooks", "in_progress", "Rodando os testes de hooks…"),
      item(6, "Atualizar o guia em inglês e em português", "pending", "Atualizando o guia"),
      item(7, "Commit e push", "pending", "Fazendo o commit"),
    ],
  };
}

export function checkoutChecklist(now) {
  return {
    updatedAt: now - 4 * MIN,
    items: [
      item(1, "Reproduzir o erro do frete no carrinho", "completed", "Reproduzindo o erro"),
      item(2, "Corrigir o arredondamento do frete", "completed", "Corrigindo o arredondamento"),
      item(3, "Aplicar as migrações do banco", "in_progress", "Aplicando as migrações"),
      item(4, "Rodar os testes do checkout", "pending", "Rodando os testes"),
      item(5, "Abrir o pull request", "pending", "Abrindo o pull request"),
    ],
  };
}

export function physicsChecklist(now) {
  return {
    updatedAt: now - 2 * MIN,
    items: [
      item(1, "Escrever os testes de colisão", "completed", "Escrevendo os testes de colisão"),
      item(2, "Fazer os testes de pulo passarem", "in_progress", "Corrigindo o pulo"),
      item(3, "Medir o quadro com 200 plataformas", "pending", "Medindo o quadro"),
    ],
  };
}
