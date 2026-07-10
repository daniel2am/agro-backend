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

## Aplicar a migration manualmente (opcional)

Se preferir aplicar fora do deploy, de uma máquina com acesso ao banco:

```bash
npx prisma migrate deploy
```
