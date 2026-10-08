// Cliente da WhatsApp Cloud API (Meta): enviar texto/botões e baixar mídia.
// Credenciais: WHATSAPP_TOKEN (token permanente do usuário do sistema) e
// WHATSAPP_PHONE_ID (id do número comercial). WHATSAPP_API_VERSION é opcional.

import { Logger } from '@nestjs/common';

export interface Botao {
  id: string;
  titulo: string;
}

export const WHATSAPP_CLIENTE = Symbol('WHATSAPP_CLIENTE');

export interface ClienteWhatsapp {
  configurado(): boolean;
  enviarTexto(para: string, texto: string): Promise<boolean>;
  enviarBotoes(para: string, texto: string, botoes: Botao[]): Promise<boolean>;
  baixarMidia(mediaId: string): Promise<{ dados: Buffer; mime: string } | null>;
}

const corta = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export class CloudApiCliente implements ClienteWhatsapp {
  private readonly logger = new Logger('WhatsappCliente');

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly http: typeof fetch = (...a) => fetch(...a),
  ) {}

  configurado() {
    return !!(this.env.WHATSAPP_TOKEN && this.env.WHATSAPP_PHONE_ID);
  }

  private get base() {
    return `https://graph.facebook.com/${this.env.WHATSAPP_API_VERSION || 'v21.0'}`;
  }

  private cabecalhos() {
    return { authorization: `Bearer ${this.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' };
  }

  private async enviar(corpo: Record<string, unknown>): Promise<boolean> {
    if (!this.configurado()) {
      this.logger.warn('WhatsApp não configurado: resposta não enviada.');
      return false;
    }
    try {
      const r = await this.http(`${this.base}/${this.env.WHATSAPP_PHONE_ID}/messages`, {
        method: 'POST',
        headers: this.cabecalhos(),
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...corpo }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) this.logger.warn(`Envio recusado pela Meta (${r.status}).`);
      return r.ok;
    } catch (e) {
      this.logger.warn(`Falha ao enviar pelo WhatsApp: ${(e as Error).message}`);
      return false;
    }
  }

  enviarTexto(para: string, texto: string) {
    return this.enviar({ to: para, type: 'text', text: { body: corta(texto, 4000) } });
  }

  /** Até 3 botões de resposta; título com no máximo 20 caracteres, corpo com no máximo 1024. */
  enviarBotoes(para: string, texto: string, botoes: Botao[]) {
    return this.enviar({
      to: para,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: corta(texto, 1000) },
        action: { buttons: botoes.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: corta(b.titulo, 20) } })) },
      },
    });
  }

  async baixarMidia(mediaId: string): Promise<{ dados: Buffer; mime: string } | null> {
    if (!this.configurado() || !/^[\w-]+$/.test(mediaId)) return null;
    try {
      const meta = await this.http(`${this.base}/${mediaId}`, { headers: { authorization: `Bearer ${this.env.WHATSAPP_TOKEN}` }, signal: AbortSignal.timeout(15_000) });
      if (!meta.ok) return null;
      const info: any = await meta.json();
      if (typeof info?.url !== 'string' || !info.url.startsWith('https://')) return null;
      const arq = await this.http(info.url, { headers: { authorization: `Bearer ${this.env.WHATSAPP_TOKEN}` }, signal: AbortSignal.timeout(30_000) });
      if (!arq.ok) return null;
      const dados = Buffer.from(await arq.arrayBuffer());
      if (dados.length === 0 || dados.length > 16 * 1024 * 1024) return null; // limite do WhatsApp para áudio
      return { dados, mime: String(info.mime_type ?? 'audio/ogg') };
    } catch (e) {
      this.logger.warn(`Falha ao baixar mídia: ${(e as Error).message}`);
      return null;
    }
  }
}
