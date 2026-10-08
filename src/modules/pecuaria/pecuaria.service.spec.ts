import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PecuariaService, limitesDoDia } from './pecuaria.service';

describe('PecuariaService', () => {
  let prisma: any;
  let planos: any;
  let service: PecuariaService;

  beforeEach(() => {
    prisma = {
      fazendaUsuario: { findFirst: jest.fn().mockResolvedValue({ papel: 'administrador' }) },
      financeiro: { findMany: jest.fn().mockResolvedValue([]) },
      pesagem: { findMany: jest.fn().mockResolvedValue([]) },
      animal: { count: jest.fn().mockResolvedValue(10) },
      lavoura: { count: jest.fn().mockResolvedValue(0) },
    };
    planos = { assertRecursoDaFazenda: jest.fn().mockResolvedValue(undefined) };
    service = new PecuariaService(prisma, planos);
  });

  it('colaborador não vê custos', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue({ papel: 'colaborador' });
    await expect(service.resultado('f1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.financeiro.findMany).not.toHaveBeenCalled();
  });

  it('quem não é da fazenda não vê', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue(null);
    await expect(service.resultado('f1', 'intruso')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige o recurso custo_arroba no plano', async () => {
    await service.resultado('f1', 'u1');
    expect(planos.assertRecursoDaFazenda).toHaveBeenCalledWith('f1', 'custo_arroba');
  });

  it('valida rendimento e rateio', async () => {
    await expect(service.resultado('f1', 'u1', { rendimentoPct: 10 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.resultado('f1', 'u1', { rateioGeraisPct: 120 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('todas as consultas ficam restritas à fazenda', async () => {
    await service.resultado('f1', 'u1');
    for (const c of [...prisma.financeiro.findMany.mock.calls, ...prisma.pesagem.findMany.mock.calls]) {
      expect(c[0].where.fazendaId).toBe('f1');
    }
  });

  it('fazenda mista: rateio padrão é 50%; só pecuária: 100%', async () => {
    prisma.financeiro.findMany.mockImplementation(async ({ where }: any) =>
      where.tipo === 'despesa' ? [{ categoria: 'energia', valor: 1000, custoLavouraId: null }] : [],
    );
    prisma.lavoura.count.mockResolvedValue(2);
    expect((await service.resultado('f1', 'u1')).custos.geraisRateados).toBe(500);
    prisma.lavoura.count.mockResolvedValue(0);
    expect((await service.resultado('f1', 'u1')).custos.geraisRateados).toBe(1000);
    expect((await service.resultado('f1', 'u1', { rateioGeraisPct: 20 })).custos.geraisRateados).toBe(200);
  });

  it('peso na venda: última pesagem até a data da venda; senão o peso cadastrado', async () => {
    const venda = (animalId: string, peso: number | null) => ({
      valor: 10_000, data: new Date('2026-06-10T12:00:00Z'), animalId, animal: { peso },
    });
    prisma.financeiro.findMany.mockImplementation(async ({ where }: any) =>
      where.tipo === 'receita' ? [venda('a', 400), venda('b', null)] : [],
    );
    prisma.pesagem.findMany.mockImplementation(async ({ where }: any) =>
      where.animalId?.in
        ? [
            { animalId: 'a', data: new Date('2026-07-01T12:00:00Z'), pesoKg: 999 }, // depois da venda: ignora
            { animalId: 'a', data: new Date('2026-06-01T12:00:00Z'), pesoKg: 540 },
          ]
        : [],
    );
    const r = await service.resultado('f1', 'u1');
    expect(r.vendas.cabecas).toBe(2);
    expect(r.vendas.cabecasComPeso).toBe(1); // 'b' não tem peso nenhum
    expect(r.vendas.arrobasVendidas).toBe(18.72); // 540 kg, não 400 nem 999
  });

  describe('período em dias (horário de Brasília)', () => {
    it('data sem horário cobre o dia inteiro: início 00:00 e fim 23:59:59 em Brasília', () => {
      const l = limitesDoDia('2026-10-08', '2026-10-08');
      expect(new Date(l.inicio!).toISOString()).toBe('2026-10-08T03:00:00.000Z');
      expect(new Date(l.fim!).toISOString()).toBe('2026-10-09T02:59:59.999Z');
    });
    it('ISO completo e ausência passam como vieram', () => {
      expect(limitesDoDia('2026-10-08T10:00:00Z', undefined)).toEqual({ inicio: '2026-10-08T10:00:00Z' });
      expect(limitesDoDia()).toEqual({});
    });
    it('o que foi lançado às 22h (Brasília) do último dia ainda entra', async () => {
      await service.resultado('f1', 'u1', { inicio: '2026-01-01', fim: '2026-10-08' });
      const faixa = prisma.pesagem.findMany.mock.calls[0][0].where.data;
      expect(faixa.lte.getTime()).toBeGreaterThan(new Date('2026-10-09T01:00:00Z').getTime()); // 22h do dia 8 em Brasília
      expect(faixa.lte.getTime()).toBeLessThan(new Date('2026-10-09T03:00:00Z').getTime());
    });
  });
});
