
# Plano — FP&A Performance Tool

## 1. Arquitetura

**Stack:** TanStack Start + Lovable Cloud (Postgres + Auth + RLS) + Lovable Emails.

**Camadas:**
- **Frontend:** React + Tailwind + shadcn, drag-and-drop com `@dnd-kit`, gráficos com `recharts`.
- **Estado:** TanStack Query + Supabase Realtime para o kanban.
- **Backend:** `createServerFn` para escritas sensíveis (envio de email, convite de membros, snapshot). Leituras simples direto via client Supabase + RLS.
- **Auth:** Email/senha. Manoela é admin única (convida os demais). Roles via tabela `user_roles` + função `has_role` (security definer).
- **Emails:** Lovable Emails com domínio próprio. Destinatário fixo `manoela.correa@worldpackers.com` (constante `REVIEW_RECIPIENT` — facilmente trocada depois para `reviewer.email`).

**Mapa de rotas:**
```
src/routes/
  __root.tsx
  index.tsx                               redirect → /overview ou /auth
  auth.tsx                                login
  _authenticated/
    route.tsx                             gate (managed)
    overview.tsx                          KPIs, rankings, tendências
    tasks.$userId.tsx                     kanban + tabela da pessoa
    tasks.$userId.$taskId.tsx             detalhe (modal/drawer)
    admin.members.tsx                     [admin] convidar/listar membros
```

## 2. Modelagem de Dados

### `profiles`
id (=auth.users.id), full_name, email, avatar_url, is_active, created_at.
Trigger `on_auth_user_created` cria profile automaticamente.

### `user_roles`
id, user_id FK, role enum `app_role` (`admin`, `member`), unique(user_id, role).

### `tasks`
| campo | tipo |
|---|---|
| id | uuid PK |
| assignee_id, created_by | uuid FK → profiles |
| title, description | text |
| status | enum (`todo`,`doing`,`done`) |
| urgency | enum (`low`,`medium`,`high`,`critical`) |
| deadline | date |
| position | int (ordem no kanban) |
| impacts_margin | bool |
| estimated_hours | numeric |
| expected_output | text |
| impact_type | enum (`revenue`,`cost_reduction`,`margin_pct`) |
| estimated_impact_usd, actual_impact_usd | numeric |
| confidence | int 1–5 |
| needs_review | bool |
| reviewer_id | uuid FK |
| review_status | enum (`pending`,`requested`,`approved`,`changes_requested`) |
| is_blocked | bool, blocked_reason text |
| completed_at, created_at, updated_at | timestamptz |

### `email_logs`
id, task_id, sent_to, sent_by, template, status (`sent`/`failed`), error_message, created_at. Usado para dedup e reenvio manual.

### `kpi_snapshots` *(novo — melhoria aprovada)*
| campo | tipo |
|---|---|
| id | uuid |
| snapshot_date | date unique |
| scope | enum (`team`, `user`) |
| user_id | uuid FK nullable (preenchido se scope=user) |
| total_tasks, todo_count, doing_count, done_count, overdue_count | int |
| margin_impact_pct | numeric |
| estimated_impact_usd, actual_impact_usd, gap_usd | numeric |
| accuracy_pct | numeric |
| created_at | timestamptz |

→ Cron semanal (segunda 08:00 UTC) via `pg_cron` chama server route `/api/public/snapshots/run` (protegido por HMAC com `SNAPSHOT_SECRET`) que calcula e insere 1 linha team + N linhas user. Overview ganha gráfico de tendência (recharts) consumindo `kpi_snapshots`.

### RLS
- `profiles`: SELECT authenticated; UPDATE próprio.
- `tasks`: CRUD authenticated; admin tudo.
- `user_roles`: SELECT próprio; mutações via server fn admin.
- `email_logs`, `kpi_snapshots`: SELECT authenticated; INSERT só service role.

## 3. Lógica Principal

### 3.1 Score (RICE adaptado)
```
reach        = impacts_margin ? 2 : 1
impact_norm  = clamp(estimated_impact_usd / 50000, 0.25, 3)
confidence_n = confidence / 5
effort       = max(estimated_hours, 0.5)
urgency_mult  = {low:1, medium:1.3, high:1.7, critical:2.2}[urgency]
deadline_mult = 1 + max(0, (7 - dias_até_deadline)/7) * 0.5

score = (reach * impact_norm * confidence_n / effort) * urgency_mult * deadline_mult
```
Implementado em view `tasks_with_score` (depende de `now()`). Centralizado em `src/lib/scoring.ts` (espelho TS para preview ao vivo no form). Críticas = top 20% score + urgency ∈ {high, critical}.

### 3.2 Impacto estimado vs real
- Acurácia por tarefa: `1 - abs(real-est)/max(est,1)` clamp 0–1, só para `done` com ambos preenchidos.
- Acurácia por pessoa: média ponderada por `estimated_impact_usd`.
- Gap equipe: `sum(actual) - sum(estimated)`.

### 3.3 KPIs Overview
Totais, por status, atrasadas, % margem, impacto est/real, gap, ranking pessoas, ranking tarefas, lista de críticas, **tendência semanal (snapshots)**.

## 4. Automação

### 4.1 Convite de membros
Server fn `inviteMember({ email, fullName })`:
1. Valida caller é admin (`has_role`).
2. `supabaseAdmin.auth.admin.inviteUserByEmail(...)`.
3. Trigger cria profile + role `member`.
4. Página da pessoa aparece automaticamente em `/tasks/$userId`.

### 4.2 Email de revisão
Server fn `requestReview({ taskId, force? })` com `requireSupabaseAuth`:
1. Busca task; valida `needs_review=true` e `reviewer_id` preenchido (erro estruturado se não).
2. **Dedup:** se existe `email_logs(status=sent, created_at>now()-10min)` e não `force` → bloqueia (UI mostra "enviado há X min, reenviar?").
3. Envia via Lovable Emails para `REVIEW_RECIPIENT` (constante). Assunto: "Revisão de tarefa necessária". Corpo: título, descrição, responsável, deadline, link direto.
4. Insere `email_logs`.
5. Atualiza `tasks.review_status='requested'`.
6. Retorna `{ ok, logId }` → toast de confirmação.

Reenvio manual = mesmo endpoint com `force:true`.

### 4.3 Snapshot semanal *(novo)*
- `pg_cron` segunda 08:00 UTC → POST HMAC para `/api/public/snapshots/run`.
- Route valida assinatura, carrega `supabaseAdmin`, calcula KPIs (team + por usuário ativo), faz `upsert` em `kpi_snapshots` por `(snapshot_date, scope, user_id)`.
- Botão "Rodar snapshot agora" no `/admin/members` para testar (server fn admin-only).

## 5. Fluxos de Usuário
1. **Login** → Manoela (seedada como admin no primeiro signup com email worldpackers via migration).
2. **Criar tarefa:** modal com 4 seções; score em tempo real.
3. **Atualizar status:** drag-and-drop. Mover para `done` abre prompt de `actual_impact_usd`.
4. **Solicitar revisão:** switch + select revisor → botão → toast.
5. **Convidar membro:** `/admin/members` → email → convite.

## 6. UX / UI
- Cards arredondados, espaçamento generoso, tokens semânticos em `styles.css`.
- Overview: 4 KPI cards, 2 gráficos (impacto por pessoa, **tendência semanal**), 2 tabelas (críticas, ranking).
- Kanban: 3 colunas com counter + soma de impacto.
- Filtros globais sticky, busca (`ilike`), atalhos (`N`, `/`).

## 7. Riscos e Decisões
| # | Ponto | Decisão |
|---|---|---|
| 1 | Email fixo enquanto não há revisores reais com email | Constante `REVIEW_RECIPIENT`. Trocar depois por `reviewer.email`. |
| 2 | Pesos do score arbitrários | Centralizados em `scoring.ts` para ajuste fácil. |
| 3 | Confidence não pedido explicitamente | Adicionado (default 3). |
| 4 | Gabriel sem atividade | Membro ativo, selecionável como revisor. |
| 5 | Dedup de email | Janela 10min + `force`. |
| 6 | Delete tarefa | Hard-delete (admin). Histórico via `completed_at`. |
| 7 | Acurácia com estimado=0 | Excluída do cálculo. |
| 8 | Conflito realtime no drag | Optimistic update + reconciliação. |
| 9 | Snapshot retroativo | Não — começa a partir da ativação. |

## 8. Sugestões futuras
Comentários por tarefa, anexos, Slack webhook, templates de tarefa, time-tracking real, export PDF do overview.

## 9. Pré-requisitos
1. Habilitar Lovable Cloud.
2. Habilitar Lovable Emails + configurar domínio.
3. Gerar `SNAPSHOT_SECRET` (HMAC do cron).
4. Migration seed: promove o 1º signup com email `manoela.correa@worldpackers.com` a admin.

## 10. Ordem de Construção
1. Cloud + tabelas + RLS + roles + triggers + seed admin.
2. Auth + `_authenticated` gate + layout/nav.
3. Overview (KPIs base).
4. Página por pessoa + CRUD tarefas + kanban drag-and-drop.
5. Score + filtros + busca.
6. Lovable Emails + `requestReview` + UI + logs.
7. Admin convidar membros.
8. **Snapshots semanais** (tabela + cron + gráfico de tendência no overview).
9. Polish: cores, atalhos, gráficos extras.
