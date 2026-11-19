const MIN = 60_000;
const PLAN_TOOL = "ExitPlanMode";

const NOTIFY_PLAN = `# Encadear o notify do Codex

O config.toml já tem o notify do app do Codex, e o Codex só aceita um. Em vez de desistir, o escritório roda um script que avisa o escritório e depois entrega o mesmo turno ao comando antigo, sem shell.

## Passos

1. Criar \`hooks/lib/codex-chain.mjs\`: monta o comando encadeado e lê de volta o anterior
2. \`applyNotify\` encadeia um notify de uma linha só; \`--remove\` devolve o comando antigo
3. Criar \`hooks/office-codex-notify.mjs\`: avisa o escritório e roda o anterior ao mesmo tempo
4. Testes de cada parte, vistos falhar sem o código
5. Guia em inglês e em português e changelog

## Riscos

Uma atualização do app do Codex pode regravar o notify dele. Basta rodar o instalador de novo.`;

const NOTIFY_PLAN_FIRST = `# Encadear o notify do Codex

Trocar o notify do Codex pelo do escritório e avisar o usuário no instalador.

## Passos

1. Gravar o notify do escritório no config.toml
2. Avisar quando já havia outro`;

const LANDING_PLAN = `# Página de preços do site institucional

A página de preços some do menu desde a troca de tema. O plano refaz a página com os três planos e liga o menu de novo.

## Passos

1. Ler \`src/pages/precos.astro\` e o menu em \`src/components/Menu.astro\`
2. Criar a tabela de planos com os dados de \`content/planos.json\`
3. Religar o item **Preços** no menu, em português e em inglês
4. Testes de componente para a tabela e para o menu
5. Conferir no celular, abaixo de 720px

| Plano | Preço | Para quem |
| --- | --- | --- |
| Básico | R$ 29 | quem está começando |
| Equipe | R$ 89 | times pequenos |
| Empresa | sob consulta | quem precisa de contrato |

## Fora do escopo

Mudar o tema ou o checkout. Referência do desenho: [guia de marca](https://example.com/marca).`;

const LANDING_PLAN_REVISED = `${LANDING_PLAN}

## Pedido seu na versão anterior

- [x] guardar os preços num só arquivo
- [ ] revisar o texto com o time de vendas`;

const PLAN_TEXTS = {
  "claude:a1": [NOTIFY_PLAN_FIRST, NOTIFY_PLAN],
  "claude:e2": [LANDING_PLAN, LANDING_PLAN_REVISED],
};

// Plans past the last written version repeat the last one, so the demo can keep asking.
function planText(agentKey, version) {
  const texts = PLAN_TEXTS[agentKey] ?? [];
  return texts[Math.min(version, texts.length) - 1] ?? null;
}

export function approvedPlan(now) {
  return { version: 2, state: "approved", proposedAt: now - 30 * MIN, decidedAt: now - 28 * MIN, length: NOTIFY_PLAN.length };
}

export function proposedPlan(agentKey, version, now) {
  return { version, state: "proposed", proposedAt: now, decidedAt: null, length: planText(agentKey, version)?.length ?? 0 };
}

export function planRequest(agentKey, now) {
  const text = planText(agentKey, 1);
  return {
    id: "demo-plan", kind: "permission", agentKey, toolName: PLAN_TOOL, summaryId: "use-tool", subject: PLAN_TOOL, detail: "",
    plan: text, planLength: text.length, isPlanTruncated: false, createdAt: now, expiresAt: now + 5 * MIN,
  };
}

export const isDemoPlanRequest = (request) => request.toolName === PLAN_TOOL;

// The agent asks again with a new version, the one the request carries; the previous one, never approved, was revised.
export function proposeAgain(agent, request, now) {
  const version = (agent.plan?.version ?? 0) + 1;
  agent.plan = proposedPlan(agent.key, version, now);
  const text = planText(agent.key, version);
  return { ...request, plan: text, planLength: text.length };
}

// As with the collector, only approving changes the plan: one sent back stays proposed until the agent sends the next version.
export function approvePlan(agent, now) {
  if (agent.plan) agent.plan = { ...agent.plan, state: "approved", decidedAt: now };
}

// What GET /api/agents/plan answers in the demo, for the agent as the page holds it: its key and the version the stream gave.
export function demoPlanDocument(agent) {
  const text = agent?.plan ? planText(agent.key, agent.plan.version) : null;
  if (!text) return { plan: null };
  const { version, state, proposedAt, decidedAt } = agent.plan;
  return { text, version, state, proposedAt, decidedAt };
}
