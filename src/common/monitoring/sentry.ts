import * as Sentry from '@sentry/node';

let ativo = false;

/** Liga o Sentry só quando SENTRY_DSN existe; sem ele, tudo aqui vira no-op. */
export function iniciarSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    release: process.env.RENDER_GIT_COMMIT,
    tracesSampleRate: 0, // só erros; sem custo de performance
    sendDefaultPii: false, // nada de IP, cookies ou corpo das requisições
  });
  ativo = true;
}

export function registrarErro(erro: unknown, contexto?: Record<string, string>) {
  if (!ativo) return;
  Sentry.withScope((scope) => {
    if (contexto) scope.setContext('requisicao', contexto);
    Sentry.captureException(erro);
  });
}
