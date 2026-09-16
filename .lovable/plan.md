# Feedbacks e Evolução Profissional

Segundo eixo de acompanhamento, ao lado do TRM das tarefas: registrar feedbacks com nota por competência, guardar todo o histórico e mostrar a evolução ao longo do tempo — como evidência para 1:1, PDI e discussões de promoção. O sistema nunca conclui se alguém está pronto para promoção; ele só organiza os dados.

Visibilidade: só gestores (admins) veem, registram e editam feedbacks. Membros comuns não veem essa área.

## 1. Registrar feedback

Formulário curto (aparece num painel lateral, rápido de preencher):

- Data (padrão hoje)
- Liderado
- Avaliador (você, preenchido automaticamente)
- Notas por competência: escolhe uma ou várias competências e dá nota 1–5 em cada
- Comentário geral
- Evidências / exemplos
- Pontos positivos
- Pontos de desenvolvimento
- Próxima ação recomendada

Escala 1–5: 1 muito abaixo · 2 abaixo · 3 dentro do esperado · 4 acima · 5 destaque. A escala fica guardada como configuração, para poder mudar depois sem refazer nada.

Sem periodicidade obrigatória: registra quando houver algo relevante.

## 2. Nota rápida dentro de cada tarefa

No bloco pós-task da tarefa (junto de retrabalho / intervenção / autonomia), um campo único de avaliação da entrega:

- 1 muito abaixo do esperado · 2 abaixo · 3 dentro do esperado · 4 acima · 5 destaque
- opcional, um comentário curto de uma linha
- opcional, marcar a qual competência aquela entrega se refere (padrão: Qualidade das entregas)

Essas notas por tarefa entram no painel da pessoa como uma fonte separada, ao lado dos feedbacks formais:

- média das notas de entrega por mês, no mesmo gráfico de evolução (linha própria)
- aparecem na timeline ("12/03 — Fechamento mensal: acima do esperado")
- listadas na tela de preparação do 1:1 com o título da tarefa como evidência concreta
- nunca sobrescrevem nem substituem o feedback formal; ficam identificadas como "nota de entrega"

## 3. Competências

Cadastro inicial com as 12 categorias pedidas (qualidade das entregas, prazos, autonomia, proatividade, comunicação, trabalho em equipe, resolução de problemas, conhecimento técnico, organização, ownership, desenvolvimento contínuo, liderança). Uma tela em Admin permite adicionar, renomear, reordenar, ativar e desativar competências. Desativar nunca apaga notas antigas.

## 3. Histórico

Feedback é sempre um novo registro — nada é sobrescrito. Cada um guarda data, avaliador e conteúdo. A lista mostra do mais recente ao mais antigo, expansível para ver notas e comentários. Editar um feedback é possível (autor ou admin) e fica registrado como alterado; excluir só o autor/admin.

## 4. Evolução Profissional (no perfil da pessoa)

Nova aba dentro da página da pessoa, com filtro de período (3 / 6 / 12 meses / tudo):

- **Nota atual por competência** — última nota registrada, em cards compactos com o indicador de tendência.
- **Médias por período** — 30 / 90 / 180 / 365 dias, lado a lado.
- **Evolução histórica** — gráfico de linha por mês, com seletor de competência ou média geral.
- **Radar de competências** — situação atual sobreposta ao período anterior.
- **Tendência** — ↑ Evoluindo · → Estável · ↓ Atenção. Só aparece com histórico suficiente; caso contrário, "Dados insuficientes para calcular tendência."

## 5. Visão consolidada com o TRM

Bloco no topo da aba juntando os dois eixos, sem misturá-los numa nota única:

- TRM atual predominante nas tarefas e sua evolução
- Média geral dos feedbacks e variação no período
- Competências com maior evolução
- Competências que precisam de desenvolvimento

## 6. Histórico de Evolução (timeline)

Linha do tempo única, em ordem cronológica, misturando:

- notas de feedback registradas (ex.: "18/03 — Autonomia: 4")
- mudanças de TRM nas tarefas da pessoa
- mudanças de nível de delegação
- entregas concluídas relevantes (com impacto registrado)

## 7. Evolução de Carreira (nova página)

Página própria, com seletor de pessoa e de período (3 / 6 / 12 meses / todo o histórico), consolidando numa visão executiva:

- evolução do TRM e da delegação
- histórico de feedbacks e evolução por competência
- principais entregas do período
- comparativo últimos 6 x 12 meses
- pontos fortes recorrentes e pontos de desenvolvimento recorrentes (extraídos dos campos preenchidos, sem inventar nada)
- evidências registradas
- **Nível atual x expectativa do cargo** — quando cargo/nível estiver cadastrado

Nenhuma classificação automática de "pronto" / "não pronto".

## 8. Cargos e expectativas

Cadastro simples em Admin: cargo, nível e nota esperada por competência (ex.: Analista Pleno — Autonomia 4, Comunicação 4, Técnico 4, Ownership 4). Cada pessoa pode ser associada a um cargo. A comparação é descritiva: mostra atual, esperado e a diferença.

## Como a evolução é calculada

- Nota atual de uma competência = última nota registrada dentro do período.
- Média do período = média simples de todas as notas daquela competência no intervalo.
- Gráfico mensal = média das notas por mês; meses sem registro ficam sem ponto (linha não é inventada).
- Tendência = média do período atual x média do período anterior de mesmo tamanho. Exige pelo menos 2 registros em cada lado e diferença mínima de 0,3 ponto para dizer ↑ ou ↓; abaixo disso é → Estável; sem os registros mínimos, "dados insuficientes".

## Riscos de inconsistência (e o tratamento)

- Poucos registros distorcem médias → todo indicador mostra a quantidade de registros que o sustenta, e tendência é bloqueada sem base mínima.
- Competências avaliadas em frequências diferentes → cada competência tem sua própria linha e sua própria contagem; nunca comparadas como se tivessem a mesma base.
- Competência desativada → notas antigas continuam no histórico e nos gráficos, marcadas como inativa.
- Registro retroativo com data antiga → permitido, mas a data do feedback é a que manda nos gráficos, não a data em que foi digitado.
- Radar com competências sem nota → dimensão aparece vazia, não como zero.

## Detalhes técnicos

Banco (novas tabelas, todas com RLS restrita a admins; `service_role` liberado):

- `competencies` — `name`, `slug`, `sort_order`, `is_active`
- `feedbacks` — `subject_id`, `author_id`, `feedback_date`, `comment`, `evidence`, `strengths`, `development_points`, `next_action`
- `feedback_scores` — `feedback_id`, `competency_id`, `score` (1–5 via trigger de validação)
- `rating_scales` — escala configurável (rótulos por valor); seed 1–5
- `job_levels` — `title`, `level`, `is_active`
- `job_level_expectations` — `job_level_id`, `competency_id`, `expected_score`
- `profiles` ganha `job_level_id` (nullable)
- seeds literais das 12 competências e da escala 1–5 na própria migração

Leitura/escrita via `createServerFn` em `src/lib/feedbacks.functions.ts` com `requireSupabaseAuth`, checando papel admin através de `has_role` antes de qualquer retorno; nada de client direto nessas tabelas.

Frontend:

- `src/lib/feedbacks.ts` — médias, séries mensais, tendência, agregação do radar, extração de pontos recorrentes
- `src/components/feedback-form.tsx` — painel de registro
- `src/components/feedback-history.tsx` — lista + expandir
- `src/components/competency-radar.tsx`, `src/components/trend-badge.tsx`
- `src/routes/_authenticated/pessoa.$userId.tsx` — perfil com aba Evolução Profissional (consolidado TRM + feedbacks, cards, gráficos, timeline)
- `src/routes/_authenticated/carreira.tsx` — página Evolução de Carreira com filtros
- `src/routes/_authenticated/admin.competencias.tsx` e `admin.cargos.tsx`
- `src/components/app-shell.tsx` — itens de menu (visíveis só para admin)
- gráficos com `recharts` (linha + radar), tokens de cor semânticos já existentes
