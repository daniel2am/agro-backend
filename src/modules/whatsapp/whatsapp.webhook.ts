// Webhook do WhatsApp Cloud API (Meta): verificação da assinatura e leitura do payload.
// Puro. Documentação: o corpo é assinado com HMAC-SHA256 do payload bruto usando o
// "app secret", enviado em X-Hub-Signature-256 como "sha256=<hex>".

import { createHmac, timingSafeEqual } from 'crypto';

export function assinaturaValida(corpoBruto: Buffer | string | undefined, cabecalho: string | undefined, segredo: string | undefined): boolean {
  if (!corpoBruto || !cabecalho || !segredo) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(cabecalho.trim());
  if (!m) return false;
  const esperado = createHmac('sha256', segredo).update(corpoBruto).digest();
  const recebido = Buffer.from(m[1]!, 'hex');
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export interface MensagemEntrada {
  /** id único da Meta (wamid...): usado para não processar a mesma mensagem duas vezes. */
  id: string;
  /** número de quem enviou, como a Meta entrega (só dígitos). */
  de: string;
  /** id do número comercial que recebeu. */
  numeroComercialId: string | null;
  tipo: 'texto' | 'audio' | 'botao' | 'outro';
  texto?: string;
  audioId?: string;
  audioMime?: string;
  botaoId?: string;
  /** segundos desde 1970 */
  tempo: number;
}

/** Extrai as mensagens recebidas. Notificações de status (entregue/lida) e formatos desconhecidos são ignorados. */
export function extrairMensagens(payload: any): MensagemEntrada[] {
  const out: MensagemEntrada[] = [];
  if (payload?.object !== 'whatsapp_business_account') return out;
  for (const entrada of Array.isArray(payload.entry) ? payload.entry : []) {
    for (const mudanca of Array.isArray(entrada?.changes) ? entrada.changes : []) {
      const valor = mudanca?.value;
      const numeroComercialId = typeof valor?.metadata?.phone_number_id === 'string' ? valor.metadata.phone_number_id : null;
      for (const m of Array.isArray(valor?.messages) ? valor.messages : []) {
        if (typeof m?.id !== 'string' || typeof m?.from !== 'string') continue;
        const base = { id: m.id, de: m.from.replace(/\D/g, ''), numeroComercialId, tempo: Number(m.timestamp) || 0 };
        if (m.type === 'text' && typeof m.text?.body === 'string') {
          out.push({ ...base, tipo: 'texto', texto: m.text.body });
        } else if (m.type === 'audio' && typeof m.audio?.id === 'string') {
          out.push({ ...base, tipo: 'audio', audioId: m.audio.id, audioMime: String(m.audio.mime_type ?? 'audio/ogg') });
        } else if (m.type === 'interactive') {
          const id = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id;
          if (typeof id === 'string') out.push({ ...base, tipo: 'botao', botaoId: id });
          else out.push({ ...base, tipo: 'outro' });
        } else {
          out.push({ ...base, tipo: 'outro' });
        }
      }
    }
  }
  return out;
}

/**
 * Chave de comparação de telefone. Celulares brasileiros chegam ora com o 9 (55DD9XXXXXXXX,
 * 13 dígitos) ora sem (55DDXXXXXXXX, 12): a chave sempre usa a forma sem o 9, para o
 * mesmo número casar nas duas.
 */
export function chaveTelefone(numero: string): string {
  const d = String(numero ?? '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length === 13 && d[4] === '9') return d.slice(0, 4) + d.slice(5);
  return d;
}

/** "5567999998888" → "(67) 99999-8888" para mostrar ao produtor. */
export function telefoneBonito(numero: string): string {
  let d = String(numero).replace(/\D/g, '').replace(/^55/, '');
  // celular entregue sem o 9 (10 dígitos, começando em 6–9 depois do DDD): mostra na forma atual
  if (d.length === 10 && /^[6-9]/.test(d.slice(2))) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return numero;
}
