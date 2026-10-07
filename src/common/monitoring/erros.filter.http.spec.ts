import { Controller, Get, INestApplication, NotFoundException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ErrosFilter } from './erros.filter';
import * as sentry from './sentry';

@Controller('t')
class TesteController {
  @Get('quebra') quebra() { throw new Error('segredo interno'); }
  @Get('nao-achou') naoAchou() { throw new NotFoundException('nada aqui'); }
}

describe('ErrosFilter num app Nest real', () => {
  let app: INestApplication;
  let registrar: jest.SpyInstance;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [TesteController] }).compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new ErrosFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.init();
  });
  beforeEach(() => {
    registrar = jest.spyOn(sentry, 'registrarErro').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => app.close());

  it('500: registra e responde ao cliente sem vazar a mensagem interna', async () => {
    const r = await request(app.getHttpServer()).get('/t/quebra?x=1');
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('segredo interno');
    expect(registrar).toHaveBeenCalledWith(expect.any(Error), { metodo: 'GET', rota: '/t/quebra' });
  });

  it('404: resposta normal e fora do monitoramento', async () => {
    const r = await request(app.getHttpServer()).get('/t/nao-achou');
    expect(r.status).toBe(404);
    expect(r.body.message).toBe('nada aqui');
    expect(registrar).not.toHaveBeenCalled();
  });
});
