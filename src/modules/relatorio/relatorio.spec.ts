import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { agregarFinanceiro, lotacao, LancamentoRel, RelatorioDados } from './relatorio.dados';
import { descreverPeriodo, renderizarRelatorioPdf } from './relatorio.pdf';
import { RelatorioService, lerPeriodo } from './relatorio.service';
import { PrismaService } from 'src/prisma.service';
import { PlanoService, erroDeRecurso } from '../plano/plano.service';

const utc = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d, 12));
const L = (o: Partial<LancamentoRel>): LancamentoRel => ({ data: utc(2026, 10, 5), valor: 100, tipo: 'despesa', categoria: null, ...o });

describe('agregarFinanceiro', () => {
  it('soma, saldo e margem', () => {
    const r = agregarFinanceiro([L({ tipo: 'receita', valor: 1000 }), L({ valor: 250.5 }), L({ valor: 249.5 })]);
    expect(r).toMatchObject({ receitas: 1000, despesas: 500, saldo: 500, margemPct: 50 });
  });

  it('agrupa por categoria, do maior ao menor, com rótulo e %', () => {
    const r = agregarFinanceiro([
      L({ categoria: 'racao', valor: 600 }),
      L({ categoria: 'racao', valor: 200 }),
      L({ categoria: 'combustivel', valor: 200 }),
      L({ categoria: null, valor: 100 }),
      L({ tipo: 'receita', categoria: 'venda_gado', valor: 5000 }),
    ]);
    expect(r.despesasPorCategoria.map((c) => c.rotulo)).toEqual(['Ração e suplementos', 'Combustível', 'Despesas sem categoria']);
    expect(r.despesasPorCategoria[0]).toMatchObject({ total: 800, pct: 72.7 });
    expect(r.receitasPorCategoria).toEqual([{ rotulo: 'Venda de gado', total: 5000, pct: 100 }]);
  });

  it('fluxo mensal em ordem cronológica, incluindo a virada de ano', () => {
    const r = agregarFinanceiro([
      L({ data: utc(2026, 1, 10), valor: 50 }),
      L({ data: utc(2025, 12, 20), tipo: 'receita', valor: 300 }),
      L({ data: utc(2026, 1, 15), tipo: 'receita', valor: 100 }),
    ]);
    expect(r.mensal.map((m) => m.mes)).toEqual(['2025-12', '2026-01']);
    expect(r.mensal[1]).toMatchObject({ receitas: 100, despesas: 50, saldo: 50 });
  });

  it('vazio não quebra e a margem fica nula', () => {
    expect(agregarFinanceiro([])).toMatchObject({ receitas: 0, despesas: 0, saldo: 0, margemPct: null, mensal: [] });
  });

  it('lotação (animais por ha)', () => {
    expect(lotacao(30, 20)).toBe(1.5);
    expect(lotacao(10, 0)).toBeNull();
  });
});

describe('PDF', () => {
  const dados: RelatorioDados = {
    fazenda: { nome: 'Fazenda São João', cidade: 'Ribeirão Preto', estado: 'SP', areaTotal: 500 },
    periodo: { inicio: utc(2026, 1, 1), fim: utc(2026, 12, 31) },
    geradoEm: new Date('2026-10-08T15:00:00Z'),
    financeiro: agregarFinanceiro([
      L({ tipo: 'receita', categoria: 'venda_gado', valor: 18500 }),
      L({ categoria: 'racao', valor: 2300 }),
      L({ categoria: 'combustivel', valor: 1850.5 }),
    ]),
    rebanho: { ativos: 120, pesoMedioKg: 412.3, invernadas: [{ nome: 'Norte', areaHa: 34.5, animais: 40, lotacao: lotacao(40, 34.5) }] },
    lavouras: [{ nome: 'Talhão 1', cultura: 'Soja', areaHa: 80, custo: 12000, receita: 30000, resultado: 18000 }],
  };

  it('gera um PDF válido (cabeçalho %PDF e fim %%EOF)', async () => {
    const buf = await renderizarRelatorioPdf(dados);
    expect(buf.length).toBeGreaterThan(1500);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.subarray(-8).toString()).toContain('%%EOF');
  });

  it('relatório grande vira várias páginas sem estourar', async () => {
    const muitos = { ...dados, lavouras: Array.from({ length: 120 }, (_, i) => ({ ...dados.lavouras[0]!, nome: `Talhão ${i}` })) };
    const buf = await renderizarRelatorioPdf(muitos);
    const paginas = (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
    expect(paginas).toBeGreaterThan(2);
  });

  it('descreve o período', () => {
    expect(descreverPeriodo({ inicio: null, fim: null })).toBe('Todo o histórico');
    expect(descreverPeriodo(dados.periodo)).toBe('01/01/2026 a 31/12/2026');
  });
});

describe('lerPeriodo', () => {
  it('aceita ISO, vazio, e recusa inválido ou invertido', () => {
    expect(lerPeriodo()).toEqual({ inicio: null, fim: null });
    expect(lerPeriodo('2026-01-01', '2026-02-01').inicio).toEqual(new Date('2026-01-01'));
    expect(() => lerPeriodo('lixo')).toThrow(BadRequestException);
    expect(() => lerPeriodo('2026-03-01', '2026-02-01')).toThrow(BadRequestException);
  });
});

describe('RelatorioService — acesso', () => {
  let service: RelatorioService;
  let prisma: any;
  let planos: any;

  beforeEach(async () => {
    prisma = {
      fazendaUsuario: { findFirst: jest.fn() },
      fazenda: { findUnique: jest.fn().mockResolvedValue({ nome: 'F', cidade: 'C', estado: 'SP', areaTotal: null }) },
      financeiro: { findMany: jest.fn().mockResolvedValue([]) },
      invernada: { findMany: jest.fn().mockResolvedValue([]) },
      animal: { findMany: jest.fn().mockResolvedValue([]) },
      lavoura: { findMany: jest.fn().mockResolvedValue([]) },
    };
    planos = { assertRecursoDaFazenda: jest.fn().mockResolvedValue(undefined) };
    const m: TestingModule = await Test.createTestingModule({
      providers: [RelatorioService, { provide: PrismaService, useValue: prisma }, { provide: PlanoService, useValue: planos }],
    }).compile();
    service = m.get(RelatorioService);
  });

  it('quem não é da fazenda → 403', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue(null);
    await expect(service.dados('f', 'u')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('colaborador não acessa relatório financeiro → 403', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue({ papel: 'colaborador' });
    await expect(service.dados('f', 'u')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.financeiro.findMany).not.toHaveBeenCalled();
  });

  it('plano sem o recurso → 402 antes de consultar qualquer dado', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue({ papel: 'administrador' });
    planos.assertRecursoDaFazenda.mockRejectedValue(erroDeRecurso('intermediario', 'relatorio_pdf'));
    await expect(service.dados('f', 'u')).rejects.toMatchObject({ status: 402 });
    expect(prisma.financeiro.findMany).not.toHaveBeenCalled();
  });

  it('gestor no plano certo recebe o relatório; consultas são restritas à fazenda', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue({ papel: 'gestor' });
    prisma.financeiro.findMany.mockResolvedValue([{ data: utc(2026, 10, 1), valor: 500, tipo: 'receita', categoria: 'leite', custoLavouraId: null, lavouraId: null }]);
    prisma.animal.findMany.mockResolvedValue([{ peso: 400 }, { peso: 500 }, { peso: null }]);
    prisma.lavoura.findMany.mockResolvedValue([{ id: 'l1', nome: 'T', cultura: 'Soja', areaHa: 10 }]);
    const r = await service.dados('faz-1', 'u');
    expect(r.rebanho).toMatchObject({ ativos: 3, pesoMedioKg: 450 });
    expect(r.financeiro.receitas).toBe(500);
    for (const consulta of [prisma.financeiro, prisma.invernada, prisma.animal, prisma.lavoura]) {
      expect(consulta.findMany.mock.calls[0][0].where.fazendaId).toBe('faz-1');
    }
  });

  it('o resultado da lavoura soma só os custos ALOCADOS nela e as vendas dela', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue({ papel: 'administrador' });
    prisma.lavoura.findMany.mockResolvedValue([{ id: 'l1', nome: 'T', cultura: 'Soja', areaHa: 10 }, { id: 'l2', nome: 'U', cultura: 'Milho', areaHa: 5 }]);
    const base = { data: utc(2026, 10, 1), categoria: null };
    prisma.financeiro.findMany.mockResolvedValue([
      { ...base, valor: 300, tipo: 'despesa', custoLavouraId: 'l1', lavouraId: null },
      { ...base, valor: 100, tipo: 'despesa', custoLavouraId: 'l2', lavouraId: null },
      { ...base, valor: 1000, tipo: 'receita', custoLavouraId: null, lavouraId: 'l1' },
      { ...base, valor: 50, tipo: 'despesa', custoLavouraId: null, lavouraId: null }, // custo geral: de nenhuma lavoura
    ]);
    const r = await service.dados('f', 'u');
    expect(r.lavouras[0]).toMatchObject({ nome: 'T', custo: 300, receita: 1000, resultado: 700 });
    expect(r.lavouras[1]).toMatchObject({ nome: 'U', custo: 100, receita: 0, resultado: -100 });
  });

  it('o nome do arquivo é seguro (sem acento nem espaço)', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue({ papel: 'administrador' });
    prisma.fazenda.findUnique.mockResolvedValue({ nome: 'Fazenda São João / Sede', cidade: 'C', estado: 'SP', areaTotal: null });
    const { filename, buffer } = await service.gerarPdf('f', 'u');
    expect(filename).toMatch(/^relatorio-fazenda-sao-joao-sede-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
