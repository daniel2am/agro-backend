import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LavouraService } from './lavoura.service';
import { PrismaService } from 'src/prisma.service';

const USER = 'user-1';
const LAVOURA = 'lav-1';

describe('LavouraService.resumo', () => {
  let service: LavouraService;
  let prisma: any;

  const lavoura = {
    id: LAVOURA,
    nome: 'Talhão 1',
    cultura: 'Soja',
    areaHa: 80, // já descontada a área vendida
    dataPlantio: new Date('2026-01-10'),
    status: 'ativo',
  };

  beforeEach(async () => {
    prisma = {
      lavoura: { findFirst: jest.fn().mockResolvedValue(lavoura) },
      financeiro: { aggregate: jest.fn() },
      procedimentoLavoura: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [LavouraService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(LavouraService);
  });

  const agregados = (custo: number, nCusto: number, receita: number, nVenda: number, areaVendida: number) =>
    prisma.financeiro.aggregate
      .mockResolvedValueOnce({ _sum: { valor: custo }, _count: { _all: nCusto } })
      .mockResolvedValueOnce({ _sum: { valor: receita, areaVendidaHa: areaVendida }, _count: { _all: nVenda } });

  it('exige que a lavoura seja de uma fazenda do usuário', async () => {
    prisma.lavoura.findFirst.mockResolvedValue(null);
    await expect(service.resumo(LAVOURA, USER)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.lavoura.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: LAVOURA, fazenda: { usuarios: { some: { usuarioId: USER } } } },
      }),
    );
  });

  it('só soma despesas ALOCADAS na lavoura (custoLavouraId) e vendas dela (lavouraId)', async () => {
    agregados(0, 0, 0, 0, 0);
    await service.resumo(LAVOURA, USER);
    const [custoCall, vendaCall] = prisma.financeiro.aggregate.mock.calls;
    expect(custoCall[0].where).toEqual({ custoLavouraId: LAVOURA, tipo: 'despesa' });
    expect(vendaCall[0].where).toEqual({ lavouraId: LAVOURA, tipo: 'receita' });
  });

  it('calcula resultado, margem e custo/ha sobre a área ORIGINAL (atual + vendida)', async () => {
    // 80 ha restantes + 20 ha vendidos = 100 ha originais
    agregados(30000, 4, 50000, 1, 20);
    const r = await service.resumo(LAVOURA, USER);

    expect(r.areaOriginalHa).toBe(100);
    expect(r.custo.total).toBe(30000);
    expect(r.receita.total).toBe(50000);
    expect(r.resultado).toBe(20000);
    expect(r.margemPct).toBe(40);
    expect(r.custoPorHa).toBe(300); // 30000 / 100, e não / 80
    expect(r.receita.areaVendidaHa).toBe(20);
  });

  it('sem vendas: margem nula (não divide por zero) e resultado negativo', async () => {
    agregados(12000, 3, null as any, 0, null as any);
    const r = await service.resumo(LAVOURA, USER);

    expect(r.receita.total).toBe(0);
    expect(r.resultado).toBe(-12000);
    expect(r.margemPct).toBeNull();
    expect(r.custoPorHa).toBe(150); // 12000 / 80
  });

  it('agrupa procedimentos por tipo, do mais frequente ao menos', async () => {
    agregados(0, 0, 0, 0, 0);
    prisma.procedimentoLavoura.groupBy.mockResolvedValue([
      { tipo: 'colheita', _count: { _all: 1 }, _max: { data: new Date('2026-05-01') } },
      { tipo: 'defensivo', _count: { _all: 5 }, _max: { data: new Date('2026-03-01') } },
      { tipo: 'adubação', _count: { _all: 2 }, _max: { data: new Date('2026-02-01') } },
    ]);
    const r = await service.resumo(LAVOURA, USER);

    expect(r.procedimentos.total).toBe(8);
    expect(r.procedimentos.porTipo.map((t) => t.tipo)).toEqual(['defensivo', 'adubação', 'colheita']);
    expect(r.procedimentos.porTipo[0]!.quantidade).toBe(5);
  });
});
