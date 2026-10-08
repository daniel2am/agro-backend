import * as Sentry from '@sentry/node';

let ativo = false;

/**
 * Limpa o que costuma vir junto ao copiar o DSN do painel (espaços, aspas, vírgula, "dsn:") e
 * diz se o formato é o de um DSN (https://<chave>@<host>/<projeto>). Nunca devolve o segredo:
 * só o host e o motivo, para o log do servidor.
 */
export function analisarDsn(bruto: string | undefined): { dsn: string; valido: boolean; host?: string; motivo?: string } {
  const dsn = (bruto ?? '').trim().replace(/^dsn\s*:\s*/i, '').replace(/^["'`]+|["'`,;\s]+$/g, '');
  if (!dsn) return { dsn, valido: false, motivo: 'SENTRY_DSN vazio' };
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return { dsn, valido: false, motivo: 'não é uma URL' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { dsn, valido: false, motivo: 'precisa começar com https://' };
  if (!url.username) return { dsn, valido: false, motivo: 'falta a chave antes do "@" (formato https://chave@host/projeto)' };
  if (!/^\/\d+$/.test(url.pathname)) return { dsn, valido: false, motivo: 'falta o número do projeto no fim da URL' };
  return { dsn, valido: true, host: url.host };
}

/** Liga o Sentry só quando SENTRY_DSN existe; sem ele, tudo aqui vira no-op. */
export function iniciarSentry() {
  const bruto = process.env.SENTRY_DSN;
  if (!bruto) {
    console.log('[Sentry] desligado: SENTRY_DSN não definido');
    return;
  }
  const analise = analisarDsn(bruto);
  if (!analise.valido) {
    console.warn(`[Sentry] desligado: SENTRY_DSN inválido (${analise.motivo})`);
    return;
  }
  const dsn = analise.dsn;
  console.log(`[Sentry] ligado, enviando para ${analise.host}`);
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
