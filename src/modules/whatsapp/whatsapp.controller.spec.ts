import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

const assinar = (corpo: string, segredo: string) => `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`;

describe('WhatsappController (HTTP real, rawBody ligado como no main.ts)', () => {
  let app: INestApplication;
  let base: string;
  let servico: { processar: jest.Mock };

  const payload = {
    object: 'whatsapp_business_account',
    entry: [{ id: '1', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: 'PN' },
      messages: [{ from: '5567999998888', id: 'wamid.1', timestamp: '1', type: 'text', text: { body: 'gastei 450 com ração' } }],
    } }] }],
  };

  beforeAll(async () => {
    servico = { processar: jest.fn().mockResolvedValue(undefined) };
    const mod = await Test.createTestingModule({ controllers: [WhatsappController], providers: [{ provide: WhatsappService, useValue: servico }] }).compile();
    app = mod.createNestApplication({ rawBody: true, logger: false });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, transformOptions: { enableImplicitConversion: true } }));
    await app.listen(0); // servidor de verdade, uma vez só (evita reaproveitar conexões de servidores efêmeros)
    base = await app.getUrl();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    servico.processar.mockClear();
    process.env.WHATSAPP_APP_SECRET = 'segredo-do-app';
    process.env.WHATSAPP_VERIFY_TOKEN = 'token-de-verificacao';
  });

  describe('GET /whatsapp/webhook (handshake)', () => {
    const url = (q: Record<string, string>) => '/whatsapp/webhook?' + new URLSearchParams(q).toString();
    it('devolve o desafio quando o token confere', async () => {
      const r = await request(base).get(url({ 'hub.mode': 'subscribe', 'hub.verify_token': 'token-de-verificacao', 'hub.challenge': '1158201444' }));
      expect(r.status).toBe(200);
      expect(r.text).toBe('1158201444');
    });
    it('recusa token errado, modo errado, e qualquer coisa se o token não estiver configurado', async () => {
      expect((await request(base).get(url({ 'hub.mode': 'subscribe', 'hub.verify_token': 'x', 'hub.challenge': '1' }))).status).toBe(403);
      expect((await request(base).get(url({ 'hub.mode': 'unsubscribe', 'hub.verify_token': 'token-de-verificacao', 'hub.challenge': '1' }))).status).toBe(403);
      delete process.env.WHATSAPP_VERIFY_TOKEN;
      expect((await request(base).get(url({ 'hub.mode': 'subscribe', 'hub.verify_token': 'undefined', 'hub.challenge': '1' }))).status).toBe(403);
    });
  });

  describe('POST /whatsapp/webhook', () => {
    const enviar = (corpo: string, assinatura?: string) =>
      request(base).post('/whatsapp/webhook').set('content-type', 'application/json').set(assinatura ? { 'x-hub-signature-256': assinatura } : {}).send(corpo);

    it('assinatura correta: 200 imediato e a mensagem vai para o serviço', async () => {
      const corpo = JSON.stringify(payload);
      const r = await enviar(corpo, assinar(corpo, 'segredo-do-app'));
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ ok: true });
      expect(servico.processar).toHaveBeenCalledTimes(1);
      expect(servico.processar.mock.calls[0]![0]).toMatchObject({ id: 'wamid.1', de: '5567999998888', tipo: 'texto', texto: 'gastei 450 com ração' });
    });

    it('a assinatura vale sobre os BYTES exatos: JSON reformatado com a mesma assinatura é recusado', async () => {
      const original = JSON.stringify(payload);
      const reformatado = JSON.stringify(payload, null, 2); // mesmo conteúdo, bytes diferentes
      const r = await enviar(reformatado, assinar(original, 'segredo-do-app'));
      expect(r.status).toBe(403);
      expect(servico.processar).not.toHaveBeenCalled();
    });

    it('sem assinatura, com assinatura de outro segredo ou malformada: 403 e nada é processado', async () => {
      const corpo = JSON.stringify(payload);
      expect((await enviar(corpo)).status).toBe(403);
      expect((await enviar(corpo, assinar(corpo, 'outro-segredo'))).status).toBe(403);
      expect((await enviar(corpo, 'sha256=nada')).status).toBe(403);
      expect(servico.processar).not.toHaveBeenCalled();
    });

    it('sem WHATSAPP_APP_SECRET no servidor: 503, nunca "aberto"', async () => {
      delete process.env.WHATSAPP_APP_SECRET;
      const corpo = JSON.stringify(payload);
      expect((await enviar(corpo, assinar(corpo, ''))).status).toBe(503);
      expect(servico.processar).not.toHaveBeenCalled();
    });

    it('notificação de status (entregue/lida) responde 200 sem processar nada', async () => {
      const corpo = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { statuses: [{ id: 'x', status: 'read' }] } }] }] });
      const r = await enviar(corpo, assinar(corpo, 'segredo-do-app'));
      expect(r.status).toBe(200);
      expect(servico.processar).not.toHaveBeenCalled();
    });

    it('erro no processamento não vira 500 para a Meta (ela reenviaria sem parar)', async () => {
      servico.processar.mockRejectedValueOnce(new Error('falhou'));
      const corpo = JSON.stringify(payload);
      const r = await enviar(corpo, assinar(corpo, 'segredo-do-app'));
      expect(r.status).toBe(200);
    });
  });
});
