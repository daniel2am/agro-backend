import { createHmac } from 'crypto';
import { assinaturaValida, chaveTelefone, extrairMensagens, telefoneBonito } from './whatsapp.webhook';
import { CloudApiCliente } from './whatsapp.cliente';
import { AnthropicInterpretador, FERRAMENTA_INTERPRETAR, OpenAiTranscritor, montarSistema } from './whatsapp.ia';

const assinar = (corpo: string, segredo: string) => `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`;

describe('assinaturaValida', () => {
  const corpo = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  it('aceita a assinatura correta (bytes brutos)', () => {
    expect(assinaturaValida(Buffer.from(corpo), assinar(corpo, 'segredo'), 'segredo')).toBe(true);
    expect(assinaturaValida(corpo, assinar(corpo, 'segredo'), 'segredo')).toBe(true);
  });
  it('recusa segredo errado, corpo adulterado, cabeçalho ausente ou malformado', () => {
    expect(assinaturaValida(corpo, assinar(corpo, 'outro'), 'segredo')).toBe(false);
    expect(assinaturaValida(corpo + ' ', assinar(corpo, 'segredo'), 'segredo')).toBe(false);
    expect(assinaturaValida(corpo, undefined, 'segredo')).toBe(false);
    expect(assinaturaValida(corpo, 'sha256=zzz', 'segredo')).toBe(false);
    expect(assinaturaValida(corpo, 'abc', 'segredo')).toBe(false);
    expect(assinaturaValida(undefined, assinar(corpo, 'segredo'), 'segredo')).toBe(false);
  });
  it('sem segredo configurado nada passa (nunca "aberto por padrão")', () => {
    expect(assinaturaValida(corpo, assinar(corpo, ''), '')).toBe(false);
    expect(assinaturaValida(corpo, assinar(corpo, 'x'), undefined)).toBe(false);
  });
});

describe('extrairMensagens', () => {
  const envolver = (mensagens: any[], extra: any = {}) => ({
    object: 'whatsapp_business_account',
    entry: [{ id: '1', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '1555', phone_number_id: 'PN1' }, messages: mensagens, ...extra } }] }],
  });

  it('texto (formato da documentação da Meta)', () => {
    const r = extrairMensagens(envolver([{ from: '5567999998888', id: 'wamid.1', timestamp: '1749416383', type: 'text', text: { body: 'gastei 450 com ração' } }]));
    expect(r).toEqual([{ id: 'wamid.1', de: '5567999998888', numeroComercialId: 'PN1', tipo: 'texto', texto: 'gastei 450 com ração', tempo: 1749416383 }]);
  });
  it('áudio, botão e outros tipos', () => {
    const r = extrairMensagens(
      envolver([
        { from: '55', id: 'a', timestamp: '1', type: 'audio', audio: { id: 'MID', mime_type: 'audio/ogg; codecs=opus', voice: true } },
        { from: '55', id: 'b', timestamp: '2', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'c:123', title: 'Confirmar' } } },
        { from: '55', id: 'c', timestamp: '3', type: 'image', image: { id: 'x' } },
        { from: '55', id: 'd', timestamp: '4', type: 'interactive', interactive: { type: 'nfm_reply' } },
      ]),
    );
    expect(r.map((m) => m.tipo)).toEqual(['audio', 'botao', 'outro', 'outro']);
    expect(r[0]).toMatchObject({ audioId: 'MID', audioMime: 'audio/ogg; codecs=opus' });
    expect(r[1]).toMatchObject({ botaoId: 'c:123' });
  });
  it('notificações de status e payloads estranhos são ignorados sem quebrar', () => {
    expect(extrairMensagens({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { statuses: [{ id: 'x', status: 'delivered' }] } }] }] })).toEqual([]);
    expect(extrairMensagens({ object: 'page' })).toEqual([]);
    expect(extrairMensagens(null)).toEqual([]);
    expect(extrairMensagens({ object: 'whatsapp_business_account', entry: 'x' })).toEqual([]);
    expect(extrairMensagens(envolver([{ id: 1, from: 2 }, null, 'x']))).toEqual([]);
  });
  it('remove tudo que não é dígito do número', () => {
    expect(extrairMensagens(envolver([{ from: '+55 67 99999-8888', id: 'w', timestamp: '1', type: 'text', text: { body: 'x' } }]))[0]!.de).toBe('5567999998888');
  });
});

describe('chaveTelefone / telefoneBonito', () => {
  it('o mesmo celular, com ou sem o 9, gera a mesma chave', () => {
    expect(chaveTelefone('5567999998888')).toBe(chaveTelefone('556799998888'));
    expect(chaveTelefone('+55 (67) 99999-8888')).toBe('556799998888');
  });
  it('outros números ficam como estão; fixo não é mexido', () => {
    expect(chaveTelefone('556733334444')).toBe('556733334444');
    expect(chaveTelefone('14155550100')).toBe('14155550100');
  });
  it('formata para exibição', () => {
    expect(telefoneBonito('5567999998888')).toBe('(67) 99999-8888');
    expect(telefoneBonito('556733334444')).toBe('(67) 3333-4444'); // fixo: não ganha o 9
    expect(telefoneBonito('556799998888')).toBe('(67) 99999-8888'); // celular sem o 9: forma atual
  });
});

const resp = (status: number, corpo: unknown, bin?: Buffer) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo, arrayBuffer: async () => (bin ?? Buffer.alloc(0)).buffer.slice((bin ?? Buffer.alloc(0)).byteOffset, (bin ?? Buffer.alloc(0)).byteOffset + (bin ?? Buffer.alloc(0)).byteLength) }) as any;

describe('CloudApiCliente', () => {
  const env = { WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_ID: '123' } as any;

  it('sem credenciais não configurado e não envia', async () => {
    const http = jest.fn();
    const c = new CloudApiCliente({} as any, http as any);
    expect(c.configurado()).toBe(false);
    expect(await c.enviarTexto('55', 'oi')).toBe(false);
    expect(http).not.toHaveBeenCalled();
  });
  it('envia texto no formato da Cloud API', async () => {
    const http = jest.fn().mockResolvedValue(resp(200, {}));
    expect(await new CloudApiCliente(env, http as any).enviarTexto('5567999998888', 'Olá')).toBe(true);
    const [url, opt] = http.mock.calls[0]!;
    expect(url).toBe('https://graph.facebook.com/v21.0/123/messages');
    expect(opt.headers.authorization).toBe('Bearer tok');
    expect(JSON.parse(opt.body)).toEqual({ messaging_product: 'whatsapp', recipient_type: 'individual', to: '5567999998888', type: 'text', text: { body: 'Olá' } });
  });
  it('botões: no máximo 3, título cortado em 20 e corpo em 1000', async () => {
    const http = jest.fn().mockResolvedValue(resp(200, {}));
    await new CloudApiCliente(env, http as any).enviarBotoes('55', 'x'.repeat(2000), [
      { id: 'a', titulo: 'Confirmar este registro agora mesmo' }, { id: 'b', titulo: 'Cancelar' }, { id: 'c', titulo: 'c' }, { id: 'd', titulo: 'd' },
    ]);
    const corpo = JSON.parse(http.mock.calls[0]![1].body);
    expect(corpo.type).toBe('interactive');
    expect(corpo.interactive.body.text.length).toBeLessThanOrEqual(1000);
    expect(corpo.interactive.action.buttons).toHaveLength(3);
    expect(corpo.interactive.action.buttons[0].reply.title.length).toBeLessThanOrEqual(20);
    expect(corpo.interactive.action.buttons[0]).toEqual({ type: 'reply', reply: { id: 'a', title: expect.any(String) } });
  });
  it('rejeição da Meta ou erro de rede viram false, nunca exceção', async () => {
    expect(await new CloudApiCliente(env, jest.fn().mockResolvedValue(resp(400, {})) as any).enviarTexto('55', 'x')).toBe(false);
    expect(await new CloudApiCliente(env, jest.fn().mockRejectedValue(new Error('rede')) as any).enviarTexto('55', 'x')).toBe(false);
  });
  it('baixa mídia em duas etapas (metadados → arquivo) e respeita o limite', async () => {
    const bin = Buffer.from('audio-bytes');
    const http = jest.fn().mockResolvedValueOnce(resp(200, { url: 'https://lookaside.fbsbx.com/x', mime_type: 'audio/ogg' })).mockResolvedValueOnce(resp(200, {}, bin));
    const m = await new CloudApiCliente(env, http as any).baixarMidia('MID123');
    expect(m!.dados.toString()).toBe('audio-bytes');
    expect(m!.mime).toBe('audio/ogg');
    expect(http.mock.calls[0]![0]).toBe('https://graph.facebook.com/v21.0/MID123');
    expect(http.mock.calls[1]![1].headers.authorization).toBe('Bearer tok');
  });
  it('mídia: id suspeito, url não-https ou falha → null', async () => {
    const http = jest.fn();
    expect(await new CloudApiCliente(env, http as any).baixarMidia('../etc/passwd')).toBeNull();
    expect(http).not.toHaveBeenCalled();
    const h2 = jest.fn().mockResolvedValueOnce(resp(200, { url: 'http://inseguro/x' }));
    expect(await new CloudApiCliente(env, h2 as any).baixarMidia('ok1')).toBeNull();
    const h3 = jest.fn().mockResolvedValueOnce(resp(404, {}));
    expect(await new CloudApiCliente(env, h3 as any).baixarMidia('ok1')).toBeNull();
  });
  it('versão da API configurável', async () => {
    const http = jest.fn().mockResolvedValue(resp(200, {}));
    await new CloudApiCliente({ ...env, WHATSAPP_API_VERSION: 'v23.0' }, http as any).enviarTexto('55', 'x');
    expect(http.mock.calls[0]![0]).toContain('/v23.0/');
  });
});

describe('AnthropicInterpretador', () => {
  const env = { ANTHROPIC_API_KEY: 'k' } as any;
  it('sem chave: indisponível', async () => {
    const http = jest.fn();
    const i = new AnthropicInterpretador({} as any, http as any);
    expect(i.disponivel()).toBe(false);
    expect(await i.interpretar('x', '2026-10-08')).toBeNull();
    expect(http).not.toHaveBeenCalled();
  });
  it('chama a Messages API forçando a ferramenta e devolve o input', async () => {
    const http = jest.fn().mockResolvedValue(resp(200, { content: [{ type: 'tool_use', name: 'interpretar', input: { tipo: 'receita', valor: 33600, descricao: 'bezerros' } }] }));
    const r = await new AnthropicInterpretador(env, http as any).interpretar('vendi uns doze bezerros a 2800', '2026-10-08');
    expect(r).toEqual({ tipo: 'receita', valor: 33600, descricao: 'bezerros' });
    const [url, opt] = http.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opt.headers['x-api-key']).toBe('k');
    expect(opt.headers['anthropic-version']).toBe('2023-06-01');
    const corpo = JSON.parse(opt.body);
    expect(corpo.tool_choice).toEqual({ type: 'tool', name: 'interpretar' });
    expect(corpo.tools[0].name).toBe('interpretar');
    expect(corpo.system).toContain('2026-10-08');
    expect(corpo.model).toBe('claude-haiku-4-5-20251001');
  });
  it('"nenhum", erro HTTP, rede ou resposta sem ferramenta → null', async () => {
    const nenhum = jest.fn().mockResolvedValue(resp(200, { content: [{ type: 'tool_use', name: 'interpretar', input: { tipo: 'nenhum' } }] }));
    expect(await new AnthropicInterpretador(env, nenhum as any).interpretar('oi', '2026-10-08')).toBeNull();
    expect(await new AnthropicInterpretador(env, jest.fn().mockResolvedValue(resp(500, {})) as any).interpretar('x', 'h')).toBeNull();
    expect(await new AnthropicInterpretador(env, jest.fn().mockRejectedValue(new Error('x')) as any).interpretar('x', 'h')).toBeNull();
    expect(await new AnthropicInterpretador(env, jest.fn().mockResolvedValue(resp(200, { content: [{ type: 'text', text: 'oi' }] })) as any).interpretar('x', 'h')).toBeNull();
  });
  it('o texto enviado é limitado (custo e abuso)', async () => {
    const http = jest.fn().mockResolvedValue(resp(200, { content: [] }));
    await new AnthropicInterpretador(env, http as any).interpretar('a'.repeat(5000), 'h');
    expect(JSON.parse(http.mock.calls[0]![1].body).messages[0].content.length).toBe(600);
  });
  it('a ferramenta lista as categorias oficiais', () => {
    expect(JSON.stringify(FERRAMENTA_INTERPRETAR)).toContain('venda_gado');
    expect(montarSistema('2026-10-08')).toContain('não invente');
  });
});

describe('OpenAiTranscritor', () => {
  const env = { OPENAI_API_KEY: 'k' } as any;
  it('sem chave: indisponível', async () => {
    expect(await new OpenAiTranscritor({} as any, jest.fn() as any).transcrever(Buffer.from('x'), 'audio/ogg')).toBeNull();
  });
  it('envia multipart em português e devolve o texto', async () => {
    const http = jest.fn().mockResolvedValue(resp(200, { text: ' gastei quatrocentos reais com ração ' }));
    const t = await new OpenAiTranscritor(env, http as any).transcrever(Buffer.from('ogg'), 'audio/ogg; codecs=opus');
    expect(t).toBe('gastei quatrocentos reais com ração');
    const [url, opt] = http.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(opt.headers.authorization).toBe('Bearer k');
    expect(opt.body.get('language')).toBe('pt');
    expect(opt.body.get('model')).toBe('whisper-1');
    expect((opt.body.get('file') as File).name).toBe('audio.ogg');
  });
  it('erro HTTP, rede ou texto vazio → null', async () => {
    expect(await new OpenAiTranscritor(env, jest.fn().mockResolvedValue(resp(401, {})) as any).transcrever(Buffer.from('x'), 'audio/ogg')).toBeNull();
    expect(await new OpenAiTranscritor(env, jest.fn().mockRejectedValue(new Error('x')) as any).transcrever(Buffer.from('x'), 'audio/ogg')).toBeNull();
    expect(await new OpenAiTranscritor(env, jest.fn().mockResolvedValue(resp(200, { text: '  ' })) as any).transcrever(Buffer.from('x'), 'audio/ogg')).toBeNull();
  });
});
