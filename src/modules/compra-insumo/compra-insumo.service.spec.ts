import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CompraInsumoService } from './compra-insumo.service';
import { PrismaService } from 'src/prisma.service';

const USER = { id: 'user-1' } as any;
const FAZENDA = 'faz-1';

function makePrismaMock() {
  const mock: any = {
    fazenda: { findFirst: jest.fn().mockResolvedValue({ id: FAZENDA }) },
    lavoura: { findFirst: jest.fn() },
    compraInsumo: { create: jest.fn().mockResolvedValue({ id: 'c1', insumo: 'Ureia', quantidade: 10, unidade: 'sc', valor: 900 }) },
    financeiro: { create: jest.fn().mockResolvedValue({}) },
    logAcesso: { create: jest.fn().mockResolvedValue({}) },
  };
  mock.$transaction = jest.fn((arg: any) => (typeof arg === 'function' ? arg(mock) : Promise.all(arg)));
  return mock;
}

const dto = (extra: object = {}) =>
  ({ fazendaId: FAZENDA, data: '2026-10-01', insumo: 'Ureia', quantidade: 10, unidade: 'sc', valor: 900, ...extra }) as any;

describe('CompraInsumoService.create — espelho no financeiro', () => {
  let service: CompraInsumoService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [CompraInsumoService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CompraInsumoService);
  });

  it('o espelho nasce como despesa da categoria "insumos"', async () => {
    await service.create(dto(), USER);
    expect(prisma.financeiro.create.mock.calls[0][0].data).toMatchObject({
      tipo: 'despesa',
      categoria: 'insumos',
      descricao: 'Compra de Ureia',
    });
  });

  it('com lavouraId, o custo é alocado na lavoura (connect)', async () => {
    prisma.lavoura.findFirst.mockResolvedValue({ id: 'l1' });
    await service.create(dto({ lavouraId: 'l1' }), USER);

    expect(prisma.lavoura.findFirst.mock.calls[0][0].where).toEqual({ id: 'l1', fazendaId: FAZENDA });
    expect(prisma.financeiro.create.mock.calls[0][0].data.custoLavoura).toEqual({ connect: { id: 'l1' } });
  });

  it('sem lavouraId não consulta lavoura nem aloca custo', async () => {
    await service.create(dto(), USER);
    expect(prisma.lavoura.findFirst).not.toHaveBeenCalled();
    expect(prisma.financeiro.create.mock.calls[0][0].data.custoLavoura).toBeUndefined();
  });

  it('nega lavoura de outra fazenda e não cria nada', async () => {
    prisma.lavoura.findFirst.mockResolvedValue(null);
    await expect(service.create(dto({ lavouraId: 'alheia' }), USER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.compraInsumo.create).not.toHaveBeenCalled();
    expect(prisma.financeiro.create).not.toHaveBeenCalled();
  });

  it('nega fazenda que não é do usuário', async () => {
    prisma.fazenda.findFirst.mockResolvedValue(null);
    await expect(service.create(dto(), USER)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
