
## Problema

A função `requestReview` em `src/lib/tasks.functions.ts` hoje só envia email se existirem os secrets `EMAIL_SEND_URL` e `EMAIL_API_KEY`. Eles não foram configurados, então o envio cai no ramo "logging" e marca como `failed` em `email_logs`. Por isso "não funcionou".

## Solução escolhida

Usar o **connector Gmail** do Lovable. Você autoriza sua conta Gmail uma vez (login Google, sem API key), e os emails saem do seu endereço para `manoela.correa@worldpackers.com`. Quando tiver DNS disponível, migramos pra Lovable Emails (domínio próprio, branded).

## Passo a passo

### 1. Conectar Gmail (você faz, 30 segundos)
Vou abrir o fluxo de conexão do Gmail. Você clica em "Conectar", faz login no Google, autoriza os escopos `gmail.send` + `gmail.compose`. Pronto — a credencial fica guardada como secret do projeto automaticamente.

### 2. Reescrever o envio (eu faço)
Em `src/lib/tasks.functions.ts`, substituo o bloco que chama `EMAIL_SEND_URL`/`EMAIL_API_KEY` por uma chamada ao gateway do Lovable:

- Endpoint: `https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send`
- Headers: `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${GOOGLE_MAIL_API_KEY}`
- Body: `{ raw: base64url(RFC2822) }` montado a partir do `to` (REVIEW_RECIPIENT), `subject` e `html` que já existem hoje
- Mantém: dedup de 10 min, log em `email_logs` com `status: sent|failed`, atualização de `tasks.review_status = 'requested'`

Nada muda na UI (botão "Enviar" no modal continua igual) nem no schema.

### 3. Testar
Abro uma tarefa com "Precisa de revisão" + revisor preenchido, clico em "Enviar", confirmo que:
- `email_logs` recebe um row `sent`
- O email chega na caixa de `manoela.correa@worldpackers.com`

## Detalhes técnicos

- O Gmail connector envia do SEU endereço (o que conectar). Para um app interno de 3 pessoas isso é OK — fica claro que a notificação veio "do sistema FP&A via [seu email]".
- Limite do Gmail: 500 envios/dia, mais que suficiente.
- `LOVABLE_API_KEY` já está provisionado no projeto.
- Quando migrar pra Lovable Emails depois: troco só o bloco de envio, o resto (templates, logs, dedup) fica igual.

## O que NÃO vai mudar

- Schema do banco
- Componentes da UI
- `REVIEW_RECIPIENT` (continua fixo em `manoela.correa@worldpackers.com`)
- Lógica de dedup e `email_logs`
