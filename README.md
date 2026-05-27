# Astro + Notion Blog com Contato e Newsletter (Supabase + Resend)

Este projeto usa **Astro** com **Notion como CMS**, além de um fluxo completo de:

- Formulário de contato
- Captação de e-mails para newsletter
- Double opt-in (confirmação por e-mail)
- Descadastro (unsubscribe)
- Persistência no Supabase
- Envio de e-mails com Resend
- Domínio na Registro.br com DNS/e-mail via Cloudflare

## Visão geral da arquitetura

1. Frontend (`/contato` e `/newsletter`) envia dados para rotas API internas.
2. Rotas API em `src/pages/api/*` validam payload, aplicam anti-spam e rate-limit.
3. Dados são salvos no Supabase (`contact_messages`, `newsletter_subscribers`).
4. Resend envia e-mails transacionais (contato e confirmação de newsletter).
5. Cloudflare Email Routing recebe/encaminha inbox do domínio (ex.: `contato@seudominio.com`).

## Requisitos

- Node.js `>=22.12.0`
- Conta no Notion
- Conta no Supabase
- Conta no Resend
- Domínio próprio (Registro.br)
- Conta Cloudflare (DNS + Email Routing)

## Setup local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar `.env`

Copie o exemplo:

```bash
cp .env.example .env
```

Preencha as variáveis:

```env
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=contato@seudominio.com
CONTACT_INBOX_EMAIL=contato@seudominio.com
SITE_URL=https://seudominio.com
```

Observações:

- `SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` são **server-side only**.
- `SITE_URL` deve ser a URL canônica do site em produção.
- `CONTACT_INBOX_EMAIL` pode ser igual ao `RESEND_FROM_EMAIL`.

### 3. Configurar banco no Supabase

Execute o SQL:

- Arquivo: `supabase/email_capture.sql`

Isso cria as tabelas:

- `newsletter_subscribers`
- `contact_messages`
- `email_events`

### 4. Rodar localmente

```bash
npm run dev
```

Acesse `http://localhost:4321`.

## Configuração do Notion (CMS)

### 1. Criar Integration

1. Acesse [Notion Integrations](https://www.notion.so/my-integrations)
2. Clique em **New integration**
3. Copie o token e use como `NOTION_TOKEN`

### 2. Criar Database

Crie um database com propriedades:

- `Title` (Title)
- `Slug` (Rich Text)
- `Excerpt` (Rich Text)
- `Status` (Select)
- `PublishedAt` (Date)
- `Tags` (Multi-select)

Status esperados: `Published` e `Draft`.

### 3. Conectar Integration ao Database

No database: `•••` -> **Connections** -> selecione a integration.

## Configuração de domínio e DNS (Registro.br + Cloudflare + Resend)

### 1. Registro.br -> Cloudflare

No Registro.br, troque os nameservers para os nameservers fornecidos pela Cloudflare.

### 2. Cloudflare DNS

Configure:

- Registros do site (A/CNAME conforme hospedagem)
- Email Routing (MX + records auxiliares recomendados pela Cloudflare)
- SPF/DKIM/DMARC conforme estratégia de envio

### 3. Resend

1. Adicione seu domínio em Resend.
2. Crie/verifique os registros DNS solicitados (SPF/DKIM).
3. Aguarde status de domínio como verificado.

## Fluxo de e-mail implementado

### Contato

- Endpoint: `POST /api/contact`
- Regras:
  - valida campos obrigatórios (`name`, `email`, `subject`, `message`)
  - honeypot (`hp_field`)
  - rate-limit por IP
- Ações:
  - salva em `contact_messages`
  - envia e-mail para `CONTACT_INBOX_EMAIL`

### Newsletter (double opt-in)

- Endpoint: `POST /api/newsletter/subscribe`
- Regras:
  - valida e-mail
  - consentimento obrigatório (`consent=true`)
  - honeypot + rate-limit
- Ações:
  - upsert em `newsletter_subscribers` com status `pending`
  - gera `confirm_token`
  - envia link de confirmação

### Confirmação

- Endpoint: `GET /api/newsletter/confirm?token=...`
- Ação:
  - muda status para `active`
  - grava `consent_at`

### Descadastro

- Endpoint: `GET /api/newsletter/unsubscribe?email=...`
- Ação:
  - marca status `unsubscribed`

## Estrutura de arquivos relevante

```txt
src/
  lib/
    env.ts
    rate-limit.ts
    resend.ts
    supabase.ts
    validation.ts
  pages/
    contato.astro
    newsletter.astro
    api/
      contact.ts
      newsletter/
        subscribe.ts
        confirm.ts
        unsubscribe.ts
supabase/
  email_capture.sql
```

## Build e deploy

### Importante: rotas API exigem runtime serverless

Como o projeto possui rotas `src/pages/api/*`, em produção você precisa de adapter serverless (ex.: Netlify/Vercel). Deploy puramente estático não executa essas rotas.

### Build

```bash
npm run build
npm run preview
```

## Testes manuais recomendados

### 1. Contato

1. Abrir `/contato`
2. Enviar formulário válido
3. Confirmar:
   - mensagem de sucesso no frontend
   - registro em `contact_messages`
   - e-mail recebido no inbox

### 2. Newsletter

1. Abrir `/newsletter`
2. Enviar e-mail com consentimento marcado
3. Confirmar:
   - retorno de sucesso
   - e-mail de confirmação recebido
4. Clicar no link de confirmação
5. Confirmar no Supabase:
   - `status = active`
   - `consent_at` preenchido

### 3. Unsubscribe

1. Acessar `GET /api/newsletter/unsubscribe?email=<email>`
2. Confirmar `status = unsubscribed`

## Segurança e conformidade

- Não expor segredos no client.
- Usar consentimento explícito para newsletter.
- Manter política de privacidade e termos atualizados.
- Recomenda-se adicionar CAPTCHA (Cloudflare Turnstile) em produção.
- Configurar webhooks da Resend para eventos de bounce/complaint em `email_events`.

## Troubleshooting

### Build falha com erro de permissão em AppData/telemetry

Em ambientes restritos, o Astro pode tentar escrever configuração de telemetry fora da pasta do projeto. Execute o build com permissões adequadas no ambiente de CI/host.

### E-mails não chegam

Verifique:

- Domínio verificado no Resend
- SPF/DKIM/DMARC corretos
- `RESEND_FROM_EMAIL` pertencente ao domínio validado
- logs de erro da rota API

### APIs retornam erro em produção

Verifique:

- adapter serverless configurado
- variáveis de ambiente no provedor
- acesso de rede do runtime para Supabase/Resend
