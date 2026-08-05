# TRM, Delegação e DoD nas tarefas

Adiciona à interface de tarefas os frameworks de maturidade (TRM), estilo de liderança, nível de delegação, checklist de Definition of Done e um bloco pós-task para aprendizado — além de uma visão por pessoa com esses indicadores.

## 1. Novos campos na tarefa

No modal de tarefa, uma nova seção **Desenvolvimento** (acima de Governança):

- **TRM** — botões `D1 D2 D3 D4` com legenda (iniciante / aprendiz / capaz / autônomo).
- **Estilo de liderança** — botões `S1 S2 S3 S4`. Ao escolher o TRM, o estilo é sugerido automaticamente (D1→S1 … D4→S4) e fica marcado como "sugerido"; se o usuário clicar em outro, passa a manual e não é mais sobrescrito.
- **Delegation Level** — botões `1…7` com hint: 1–2 gestor decide · 3–4 compartilhado · 5–7 liderado decide.
- **Definition of Done** — checklist editável: adicionar critério, marcar/desmarcar, remover, reordenar não necessário. Botão "Sugerir critérios" preenche com base no tipo de impacto/recorrência da tarefa (e, para tarefas recorrentes, reaproveita o DoD da última ocorrência concluída com o mesmo título).
- Progresso do DoD aparece como `3/5` no card da tarefa.

## 2. Pós-task (aparece quando status = Feito)

Bloco **Pós-task**, exigido para salvar como Feito:

- Retrabalho: Sim / Não
- Intervenção do gestor: Sim / Não
- Autonomia percebida: escala 1–5

Se algum estiver em branco ao mover para Feito, o app avisa e mantém o modal aberto.

## 3. Sugestões automáticas (nunca automáticas de fato)

Todas aparecem como faixas de aviso com texto do tipo "Sugestão — você decide", sem alterar nada sozinhas:

- 3+ tarefas concluídas seguidas da pessoa sem retrabalho e sem intervenção → sugerir subir o TRM.
- Taxa de retrabalho da pessoa acima de 30% nas últimas 10 concluídas → sugerir revisar o DoD ou reduzir o nível de delegação.
- Tarefa recorrente → sugerir o DoD da ocorrência anterior.

## 4. Visão por pessoa

Nova aba **Desenvolvimento** na sidebar, com seletor de pessoa e período:

- Distribuição de TRM (barras D1–D4)
- Média de delegação (com tendência ao longo do tempo)
- Taxa de retrabalho
- Taxa de intervenção do gestor
- Média de autonomia percebida
- Lista das concluídas recentes com TRM, delegação e flags

Os mesmos indicadores agregados do time entram como um bloco compacto no Overview.

## Detalhes técnicos

Migração no banco (tabela `tasks`):

- enums `task_trm` (`d1..d4`), `leadership_style` (`s1..s4`)
- colunas `trm`, `leadership_style`, `leadership_style_manual boolean default false`, `delegation_level int` (1–7 via trigger de validação), `dod jsonb default '[]'` (itens `{id, text, done}`), `rework boolean`, `manager_intervention boolean`, `perceived_autonomy int` (1–5)
- view `tasks_with_score` recriada incluindo os novos campos + `dod_total` / `dod_done`
- trigger de clone de recorrência atualizado para copiar TRM, estilo, delegação e DoD (itens desmarcados) e zerar os campos pós-task

Frontend:

- `src/components/ui/*` já cobre o necessário; grupos de botões implementados como um pequeno componente local `ToggleGroupField` (botões com estado ativo via tokens semânticos)
- `src/lib/development.ts` — mapa TRM→estilo, faixas de delegação, geração de DoD sugerido, cálculo de taxas
- `src/components/task-modal.tsx` — nova seção, pós-task condicional, validação
- `src/components/task-card.tsx` — badges TRM / `D{n}` de delegação / progresso DoD
- `src/routes/_authenticated/desenvolvimento.tsx` — dashboard por pessoa
- `src/routes/_authenticated/overview.tsx` — bloco agregado
- `src/components/app-shell.tsx` — item de menu
