import { Logger } from '@nestjs/common';
import { CloudApiCliente } from './whatsapp.cliente';

const ENV = { WHATSAPP_TOKEN: 'token-secreto-123', WHATSAPP_PHONE_ID: '999' } as NodeJS.ProcessEnv;

describe('CloudApiCliente: envio recusado', () => {
  let aviso: jest.SpyInstance;
  beforeEach(() => {
    aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => aviso.mockRestore());

  it('registra o código de erro da Meta, sem token nem texto da mensagem', async () => {
    const http = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 190, error_subcode: 463, type: 'OAuthException', message: 'token-secreto-123 expirou' } }),
    });
    const ok = await new CloudApiCliente(ENV, http as unknown as typeof fetch).enviarTexto('5567999990000', 'segredo da conversa');
    expect(ok).toBe(false);
    const linha = String(aviso.mock.calls[0]?.[0]);
    expect(linha).toContain('400');
    expect(linha).toContain('190/463');
    expect(linha).toContain('OAuthException');
    expect(linha).not.toContain('token-secreto-123');
    expect(linha).not.toContain('segredo da conversa');
  });

  it('continua registrando o status quando o corpo não é JSON', async () => {
    const http = jest.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('x'); } });
    expect(await new CloudApiCliente(ENV, http as unknown as typeof fetch).enviarTexto('5567999990000', 'oi')).toBe(false);
    expect(String(aviso.mock.calls[0]?.[0])).toContain('502');
  });
});
