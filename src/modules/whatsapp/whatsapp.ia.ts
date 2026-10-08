// IA opcional do WhatsApp:
//  - Interpretador: entende frases livres ("vendi uns doze bezerros a 2800 cada pro seu João")
//    quando o interpretador determinístico não consegue. Anthropic (ANTHROPIC_API_KEY).
//  - Transcritor: converte áudio em texto. OpenAI (OPENAI_API_KEY).
// Ambos são opcionais: sem chave, o WhatsApp continua funcionando por texto padronizado.
// O que a IA devolve NUNCA é gravado direto: passa por validarComando e pela confirmação do produtor.

import { Logger } from '@nestjs/common';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../financeiro/categorias';

export const INTERPRETADOR = Symbol('INTERPRETADOR');
export const TRANSCRITOR = Symbol('TRANSCRITOR');

export interface Interpretador {
  disponivel(): boolean;
  /** Devolve o objeto bruto proposto pela IA (a validação é de quem chama) ou null. */
  interpretar(texto: string, hoje: string): Promise<unknown | null>;
}

export interface Transcritor {
  disponivel(): boolean;
  transcrever(dados: Buffer, mime: string): Promise<string | null>;
}

const MODELO_PADRAO = 'claude-haiku-4-5-20251001';

export const FERRAMENTA_INTERPRETAR = {
  name: 'interpretar',
  description: 'Registra o que o produtor rural quer lançar no AgroTotal. Use tipo "nenhum" se a mensagem não for um registro.',
  input_schema: {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['despesa', 'receita', 'chuva', 'pesagem', 'nenhum'] },
      valor: { type: 'number', description: 'Valor TOTAL em reais (se vier quantidade × preço unitário, multiplique).' },
      descricao: { type: 'string', description: 'Descrição curta do lançamento, em português.' },
      categoria: { type: 'string', description: `Despesa: ${CATEGORIAS_DESPESA.join(', ')}. Receita: ${CATEGORIAS_RECEITA.join(', ')}.` },
      data: { type: 'string', description: 'AAAA-MM-DD. Omita se for hoje.' },
      mm: { type: 'number', description: 'Chuva em milímetros.' },
      brinco: { type: 'string', description: 'Número do brinco do animal.' },
      pesoKg: { type: 'number', description: 'Peso em quilos.' },
    },
    required: ['tipo'],
  },
};

export function montarSistema(hoje: string): string {
  return [
    'Você interpreta mensagens curtas de produtores rurais brasileiros para o app AgroTotal.',
    `Hoje é ${hoje}. "Ontem" e "anteontem" são relativos a essa data.`,
    'Chame a ferramenta "interpretar" exatamente uma vez.',
    'Regras: valores em reais; se houver quantidade e preço unitário, informe o TOTAL; não invente dados que não estão na mensagem;',
    'se faltar o valor, o brinco ou os milímetros, use tipo "nenhum"; ignore pedidos que não sejam registros.',
  ].join('\n');
}

export class AnthropicInterpretador implements Interpretador {
  private readonly logger = new Logger('Interpretador');

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly http: typeof fetch = (...a) => fetch(...a),
  ) {}

  disponivel() {
    return !!this.env.ANTHROPIC_API_KEY;
  }

  async interpretar(texto: string, hoje: string): Promise<unknown | null> {
    if (!this.disponivel()) return null;
    try {
      const r = await this.http('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': this.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.env.WHATSAPP_LLM_MODEL || MODELO_PADRAO,
          max_tokens: 300,
          system: montarSistema(hoje),
          tools: [FERRAMENTA_INTERPRETAR],
          tool_choice: { type: 'tool', name: 'interpretar' },
          messages: [{ role: 'user', content: texto.slice(0, 600) }],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) {
        this.logger.warn(`Interpretação recusada (${r.status}).`);
        return null;
      }
      const j: any = await r.json();
      const uso = Array.isArray(j?.content) ? j.content.find((c: any) => c?.type === 'tool_use' && c?.name === 'interpretar') : null;
      const entrada = uso?.input;
      return entrada && entrada.tipo !== 'nenhum' ? entrada : null;
    } catch (e) {
      this.logger.warn(`Falha na interpretação: ${(e as Error).message}`);
      return null;
    }
  }
}

export class OpenAiTranscritor implements Transcritor {
  private readonly logger = new Logger('Transcritor');

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly http: typeof fetch = (...a) => fetch(...a),
  ) {}

  disponivel() {
    return !!this.env.OPENAI_API_KEY;
  }

  async transcrever(dados: Buffer, mime: string): Promise<string | null> {
    if (!this.disponivel()) return null;
    try {
      const form = new FormData();
      const ext = /mpeg|mp3/.test(mime) ? 'mp3' : /mp4|m4a|aac/.test(mime) ? 'm4a' : 'ogg';
      form.append('file', new Blob([dados], { type: mime.split(';')[0] }), `audio.${ext}`);
      form.append('model', this.env.WHATSAPP_STT_MODEL || 'whisper-1');
      form.append('language', 'pt');
      form.append('prompt', 'Registro de fazenda: ração, vacina, bezerros, arroba, brinco, chuva em milímetros, reais.');
      const r = await this.http('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.env.OPENAI_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(45_000),
      });
      if (!r.ok) {
        this.logger.warn(`Transcrição recusada (${r.status}).`);
        return null;
      }
      const j: any = await r.json();
      const texto = typeof j?.text === 'string' ? j.text.trim() : '';
      return texto || null;
    } catch (e) {
      this.logger.warn(`Falha na transcrição: ${(e as Error).message}`);
      return null;
    }
  }
}
