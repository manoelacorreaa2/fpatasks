# Melhorias no board: rotina, coluna Feito por mês e tarefas do gestor

## 1. Tarefas suas não pedem TRM/delegação

Quando a tarefa é atribuída a você (ou a qualquer admin), a seção **Desenvolvimento** deixa de pedir maturidade, estilo de liderança e nível de delegação, e o bloco **Pós-task** deixa de ser obrigatório para marcar como Feito. Esses campos só fazem sentido quando você delega para alguém.

O que continua na sua tarefa: descrição, recorrência, impacto, prazo, revisão e o **Definition of Done** (útil para qualquer tarefa).

Se um dia você quiser preencher mesmo assim, há um link discreto "mostrar campos de delegação".

## 2. Nova coluna "Rotina" para tarefas recorrentes

O board passa a ter 4 colunas:

```text
Rotina  |  To Do  |  Fazendo  |  Feito (mês)
```

- Toda tarefa com recorrência diária/semanal/mensal aparece em **Rotina**, não polui o To Do.
- Cada card de Rotina mostra a periodicidade, o próximo prazo e um botão **Concluir**.
- Ao clicar em Concluir: a ocorrência atual vira Feito (entra no Feito do mês e no Histórico) e a próxima ocorrência já nasce em Rotina com o prazo somado (o clone automático que já existe no banco).
- No card de Rotina o único ajuste rápido é o **nível de delegação** (1–7), clicável direto no card — a ideia é subir com o tempo. Nada de TRM ou pós-task aqui: são tarefas rápidas e repetidas.
- Arrastar uma tarefa recorrente para To Do/Fazendo continua possível (quando a ocorrência exige mais etapas).

## 3. Coluna Feito filtrada por mês

A coluna Feito ganha um seletor de mês no cabeçalho, começando no mês atual ("Agosto 2026"), com os meses anteriores que têm entregas e a opção "Todos". O total em USD do cabeçalho acompanha o filtro, e um link "ver histórico completo" leva ao /historico.

## 4. Outras melhorias sugeridas (escolha o que entra)

Ordenadas por relação valor/esforço:

1. **Recorrentes que atrasaram** — badge vermelho em Rotina quando a ocorrência da semana/mês passou do prazo sem ser concluída, e contador "atrasadas" no topo.
2. **Rotina como % da capacidade** — soma das horas estimadas das recorrentes por semana vs. horas úteis, para ver quanto do time está preso em rotina e quanto sobra para projeto/impacto.
3. **Templates de tarefa** — salvar uma tarefa como modelo (DoD, horas, impacto, recorrência) e criar novas em um clique; ideal para reports.
4. **Tendência de delegação por pessoa** — gráfico simples no Desenvolvimento mostrando o nível médio de delegação subindo mês a mês (evidência de autonomia crescente).
5. **Resumo semanal por email** — segunda-feira, um email com o que foi entregue, o impacto do mês e o que está atrasado (usa o Gmail já conectado).
6. **Meta de impacto mensal** — definir alvo em USD por pessoa/time e mostrar o quanto já foi entregue no mês.

Me diga quais desses (1–6) você quer nesta rodada; posso fazer os três primeiros pontos do plano agora e os extras em seguida.

## Detalhes técnicos

- Banco: nenhuma mudança de schema necessária. A coluna Rotina é derivada de `recurrence <> 'one_off'` e o clone já existe via trigger `tasks_clone_on_recurrence_done`.
- `src/routes/_authenticated/tasks.$userId.tsx`: 4ª coluna, buckets derivados (rotina = recorrente com status ≠ done; done filtrado por mês de `completed_at`), seletor de mês, drop de tarefa recorrente para todo/doing mantido.
- `src/components/task-card.tsx`: variante `routine` com periodicidade, próximo prazo, botão Concluir e stepper de delegação inline.
- `src/components/task-modal.tsx`: props para esconder TRM/estilo/delegação e não exigir pós-task quando `assignee_id` é admin/você; toggle "mostrar campos de delegação".
- Lista de admins vem de `user_roles` (nova query leve com `has_role`/select por role) para decidir se a tarefa é "de gestor".
