# Deploy (Render)

## Comandos no dashboard do Render

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start:prod`

O `start:prod` roda `npx prisma migrate deploy` **antes** de subir o app, então
qualquer migration pendente (ex.: os campos de baixa automática do Financeiro:
`Animal.status`, `Financeiro.animalId/lavouraId/areaVendidaHa`) é aplicada
automaticamente no banco a cada deploy. `migrate deploy` é idempotente — só
aplica o que ainda não foi aplicado.

## Variáveis de ambiente obrigatórias

- `DATABASE_URL` — string de conexão do Postgres (Render)
- `JWT_SECRET` — segredo forte e aleatório (não reutilizar o antigo)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — envio de e-mail
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — login Google
- `GOOGLE_CALLBACK_URL` — **obrigatória** para o login Google; deve ser
  exatamente `https://<seu-backend>/auth/google/redirect` e estar cadastrada
  como URI de redirecionamento autorizada no Google Cloud Console
- `APPLE_BUNDLE_ID` — login Apple (default no código: `com.agrototal.app`)
- `APP_SCHEME` — scheme do app mobile para o retorno do OAuth (default: `agrototal`)

## Planos e cobrança

- `TRIAL_DIAS` — dias de teste gratuito do plano Pro para novos cadastros (padrão `14`; `0` desliga).
- `ADMIN_API_KEY` — **opcional**. Se definida, habilita `PATCH /admin/plano` (cabeçalho `x-admin-key`)
  para liberar/trocar o plano de um usuário enquanto a cobrança é manual. Sem ela, a rota responde 404.
  Use um valor longo e aleatório e guarde-o fora do repositório. Exemplo de uso:

  ```bash
  curl -X PATCH https://<seu-backend>/admin/plano \
    -H "x-admin-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
    -d '{"email":"cliente@exemplo.com","plano":"intermediario","ateEm":"2027-01-31T23:59:59Z"}'
  ```

  Planos: `basico`, `intermediario`, `avancado`. Sem `ateEm` o plano não vence. Plano vencido volta
  ao básico (nada é apagado; só não é possível criar além dos limites).

## Aplicar a migration manualmente (opcional)

Se preferir aplicar fora do deploy, de uma máquina com acesso ao banco:

```bash
npx prisma migrate deploy
```

## Monitoramento

- `SENTRY_DSN` — **opcional**. Com ele, todo erro de servidor (5xx) vai para o Sentry (sem corpo das
  requisições, IP ou cookies). Crie um projeto "Node.js" em sentry.io e copie o DSN. Sem a variável,
  os erros continuam no log do Render.
- Uptime: aponte um monitor (UptimeRobot, Better Stack — planos gratuitos servem) para
  `GET /health/db`. Responde 200 se a API e o banco estão no ar e 503 se o banco falhar.
  (`GET /health` não toca o banco; é o que o Render usa.)

## Páginas legais e exclusão de conta

- `GET /privacidade` e `GET /termos` são as URLs públicas para as lojas (App Store / Google Play).
  O texto é uma base e **precisa de revisão jurídica**. Defina `LEGAL_RAZAO_SOCIAL`, `LEGAL_CNPJ` e
  `LEGAL_EMAIL_CONTATO` para aparecerem como responsável/contato.
- `DELETE /usuarios/me` (corpo `{ "senha": "..." }`; contas Google/Apple dispensam a senha) apaga a
  conta. Fazendas em que a pessoa era a única são apagadas; em fazendas com equipe, o integrante mais
  antigo (gestor antes de colaborador) vira administrador e herda os registros criados por ela.
