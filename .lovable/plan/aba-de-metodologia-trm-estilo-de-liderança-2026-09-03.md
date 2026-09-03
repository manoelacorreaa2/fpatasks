# Aba de Metodologia (TRM + estilo de liderança)

Nova aba **Metodologia** na sidebar, explicando o modelo D1–D4 / S1–S4, mais uma nota fixa dentro do modal de tarefa.

## 1. Nova página `/metodologia`

Conteúdo estático, em português, com foco em leitura rápida:

- **Tabela do modelo** (D1–D4), colunas: Nível · Competência · Comprometimento · Estilo · O que você faz

```text
D1 iniciante  baixa    alto      S1 dirigir   muita instrução, pouca conversa de motivação
D2 aprendiz   alguma   baixo     S2 treinar   muita instrução E muito apoio
D3 capaz      alta     variável  S3 apoiar    pouca instrução, muito apoio
D4 autônomo   alta     alto      S4 delegar   recebe o resultado
```

- **Cards D1–D4** (abaixo da tabela) com o estilo correspondente destacado, para quem prefere ler por nível.
- **Bloco "Por que o estilo muda de pessoa para pessoa na mesma task"**, com o texto:
  > O nível é da combinação pessoa+task, não da pessoa. Se eu explico mais para alguém, é porque aquela task é nova para essa pessoa — não é desconfiança nem preferência. Quando o nível sobe, eu explico menos, e isso é o objetivo.
- **Faixas de delegação** (1–2 gestor decide · 3–4 compartilhado · 5–7 liderado decide) e uma linha curta sobre o Definition of Done e o bloco pós-task, para amarrar o modelo ao que aparece na tarefa.

## 2. Nota dentro da tarefa

Na seção **Desenvolvimento** do modal, abaixo dos botões de TRM/estilo, uma linha discreta com o mesmo texto acima (versão curta) e link "ver metodologia" que abre `/metodologia` em nova aba.

## 3. Acesso

Item **Metodologia** na sidebar (ícone de livro), visível para todo mundo. Também um link "entender o modelo" no topo da página Desenvolvimento.

## Detalhes técnicos

- `src/routes/_authenticated/metodologia.tsx` — página nova com `head()` próprio (título/descrição únicos); conteúdo estático usando `Card` e tokens semânticos, sem cores hardcoded.
- `src/lib/development.ts` — acrescentar uma constante `TRM_MATRIX` (nível, competência, comprometimento, estilo, ação) reutilizada pela página e pelos tooltips existentes; `TRM_OPTIONS`/`STYLE_OPTIONS` passam a derivar dela ou a receber os mesmos textos.
- `src/components/app-shell.tsx` — novo item de navegação.
- `src/components/task-modal.tsx` — nota + link na seção Desenvolvimento.
- `src/routes/_authenticated/desenvolvimento.tsx` — link para a metodologia.
- Sem mudanças no banco.
