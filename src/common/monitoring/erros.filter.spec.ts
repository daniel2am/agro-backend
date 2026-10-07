import { BadRequestException, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ErrosFilter } from './erros.filter';
import * as sentry from './sentry';

describe('ErrosFilter', () => {
  const host: any = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: '/animais?token=segredo', route: { path: '/animais' } }),
      getResponse: () => ({}),
    }),
  };
  let filtro: ErrosFilter;
  let registrar: jest.SpyInstance;

  beforeEach(() => {
    filtro = new ErrosFilter({ reply: jest.fn(), isHeadersSent: () => false } as any);
    jest.spyOn((filtro as any).logger, 'error').mockImplementation(() => undefined);
    // a resposta HTTP em si é do Nest; aqui só importa o registro do erro
    jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);
    registrar = jest.spyOn(sentry, 'registrarErro').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('erro inesperado é registrado, com a rota sem query string', () => {
    filtro.catch(new Error('banco caiu'), host);
    expect(registrar).toHaveBeenCalledWith(expect.any(Error), { metodo: 'GET', rota: '/animais' });
  });

  it('HttpException 5xx é registrada', () => {
    filtro.catch(new HttpException('x', 503), host);
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it('sempre delega a resposta ao Nest, inclusive em erro 4xx', () => {
    const base = jest.spyOn(BaseExceptionFilter.prototype, 'catch');
    filtro.catch(new BadRequestException('x'), host);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('erro do cliente (4xx) não vai para o monitoramento', () => {
    filtro.catch(new BadRequestException('inválido'), host);
    expect(registrar).not.toHaveBeenCalled();
  });
});
