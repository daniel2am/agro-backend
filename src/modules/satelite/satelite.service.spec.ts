import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { SateliteService } from './satelite.service';
import { ProvedorIndisponivelError } from './satelite.provedor';

const quadrado = [
  { latitude: -20.45, longitude: -54.6 },
  { latitude: -20.45, longitude: -54.59 },
  { latitude: -20.44, longitude: -54.59 },
  { latitude: -20.44, longitude: -54.6 },
];

const hoje = new Date('2026-10-08T12:00:00Z');
const med = (inicio: string, media: number | null, extra: any = {}) => ({
  alvoTipo: 'invernada', alvoId: 'i1', inicio: new Date(`${inicio}T00:00:00Z`),
  fim: new Date(new Date(`${inicio}T00:00:00Z`).getTime() + 10 * 86_400_000), media, minimo: null, maximo: null, desvio: null,
  cobertura: media === null ? 0 : 0.9, atualizadoEm: new Date('2026-10-08T06:00:00Z'), ...extra,
});

describe('SateliteService', () => {
  let prisma: any;
  let planos: any;
  let provedor: any;
  let service: SateliteService;

  beforeEach(() => {
    prisma = {
      fazendaUsuario: { findFirst: jest.fn().mockResolvedValue({ id: 'v' }) },
      invernada: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', nome: 'Pasto Sul', area: 100, poligono: quadrado }]) },
      lavoura: { findMany: jest.fn().mockResolvedValue([{ id: 'l1', nome: 'Soja Norte', areaHa: 50, poligono: null }]) },
      ndviMedicao: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    };
    planos = { assertRecursoDaFazenda: jest.fn().mockResolvedValue(undefined) };
    provedor = { configurado: jest.fn().mockReturnValue(true), estatisticas: jest.fn().mockResolvedValue([]) };
    service = new SateliteService(prisma, planos, provedor);
  });

  describe('acesso', () => {
    it('quem não é da fazenda não vê nem atualiza', async () => {
      prisma.fazendaUsuario.findFirst.mockResolvedValue(null);
      await expect(service.resumo('f1', 'x', hoje)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.atualizar('f1', 'x', hoje)).rejects.toBeInstanceOf(ForbiddenException);
      expect(provedor.estatisticas).not.toHaveBeenCalled();
    });
    it('exige o recurso satelite do plano', async () => {
      await service.resumo('f1', 'u1', hoje);
      expect(planos.assertRecursoDaFazenda).toHaveBeenCalledWith('f1', 'satelite');
    });
    it('as consultas ficam restritas à fazenda', async () => {
      await service.resumo('f1', 'u1', hoje);
      expect(prisma.invernada.findMany.mock.calls[0][0].where.fazendaId).toBe('f1');
      expect(prisma.lavoura.findMany.mock.calls[0][0].where.fazendaId).toBe('f1');
      expect(prisma.ndviMedicao.findMany.mock.calls[0][0].where.fazendaId).toBe('f1');
    });
  });

  describe('resumo', () => {
    it('separa áreas monitoradas das sem perímetro', async () => {
      const r = await service.resumo('f1', 'u1', hoje);
      expect(r.alvos.map((a) => a.nome)).toEqual(['Pasto Sul']);
      expect(r.semPerimetro).toEqual([{ tipo: 'lavoura', id: 'l1', nome: 'Soja Norte' }]);
    });

    it('último vigor, classificação, tendência de queda e alerta', async () => {
      prisma.ndviMedicao.findMany.mockResolvedValue([med('2026-08-20', 0.72), med('2026-09-09', 0.55), med('2026-09-29', 0.45)]);
      const a = (await service.resumo('f1', 'u1', hoje)).alvos[0]!;
      expect(a.ultimo!.media).toBe(0.45);
      expect(a.classificacao!.nivel).toBe('moderado');
      expect(a.tendencia.sentido).toBe('caindo');
      expect(a.alerta).toBe(true);
      expect(a.textoTendencia).toContain('Caindo');
    });

    it('área só com nuvem: sem leitura útil, sem classificação', async () => {
      prisma.ndviMedicao.findMany.mockResolvedValue([med('2026-09-29', null)]);
      const a = (await service.resumo('f1', 'u1', hoje)).alvos[0]!;
      expect(a.ultimo).toBeNull();
      expect(a.classificacao).toBeNull();
      expect(a.tendencia.sentido).toBe('sem_dados');
    });

    it('pede atualização quando nunca leu ou a leitura é antiga; não pede quando é recente', async () => {
      expect((await service.resumo('f1', 'u1', hoje)).precisaAtualizar).toBe(true); // nunca leu
      prisma.ndviMedicao.findMany.mockResolvedValue([med('2026-09-29', 0.6, { atualizadoEm: new Date('2026-10-08T06:00:00Z') })]);
      expect((await service.resumo('f1', 'u1', hoje)).precisaAtualizar).toBe(false); // 6 h atrás
      prisma.ndviMedicao.findMany.mockResolvedValue([med('2026-09-29', 0.6, { atualizadoEm: new Date('2026-10-01T06:00:00Z') })]);
      expect((await service.resumo('f1', 'u1', hoje)).precisaAtualizar).toBe(true);
    });

    it('sem provedor configurado nunca pede atualização (e avisa)', async () => {
      provedor.configurado.mockReturnValue(false);
      const r = await service.resumo('f1', 'u1', hoje);
      expect(r.provedorConfigurado).toBe(false);
      expect(r.precisaAtualizar).toBe(false);
    });
  });

  describe('atualizar', () => {
    it('sem provedor configurado: 503 com código para o app explicar', async () => {
      provedor.configurado.mockReturnValue(false);
      await expect(service.atualizar('f1', 'u1', hoje)).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(service.atualizar('f1', 'u1', hoje)).rejects.toMatchObject({ response: { code: 'SATELITE_NAO_CONFIGURADO' } });
    });

    it('primeira vez: busca ~13 meses de histórico, só das áreas com perímetro, e grava por intervalo', async () => {
      provedor.estatisticas.mockResolvedValue([
        { inicio: '2026-09-29', fim: '2026-10-09', media: 0.6, minimo: 0.2, maximo: 0.9, desvio: 0.1, cobertura: 0.8 },
        { inicio: '2026-09-19', fim: '2026-09-29', media: null, minimo: null, maximo: null, desvio: null, cobertura: 0 },
      ]);
      const r = await service.atualizar('f1', 'u1', hoje);
      expect(provedor.estatisticas).toHaveBeenCalledTimes(1); // a lavoura sem perímetro não consome cota
      const pedido = provedor.estatisticas.mock.calls[0][0];
      expect(pedido.ate).toBe('2026-10-08');
      const dias = (Date.parse(`${pedido.ate}T00:00:00Z`) - Date.parse(`${pedido.de}T00:00:00Z`)) / 86_400_000;
      expect(dias).toBeGreaterThan(390);
      expect(pedido.poligono).toHaveLength(4);
      expect(prisma.ndviMedicao.upsert).toHaveBeenCalledTimes(2);
      const u = prisma.ndviMedicao.upsert.mock.calls[0][0];
      expect(u.where.alvoTipo_alvoId_inicio).toMatchObject({ alvoTipo: 'invernada', alvoId: 'i1' });
      expect(u.create).toMatchObject({ fazendaId: 'f1', media: 0.6, cobertura: 0.8 });
      expect(r).toMatchObject({ atualizados: 1, recentes: 0, falhas: [], semPerimetro: 1 });
    });

    it('com histórico: relê só os últimos dias', async () => {
      prisma.ndviMedicao.findFirst.mockResolvedValue({ inicio: new Date('2026-09-29T00:00:00Z'), atualizadoEm: new Date('2026-10-05T00:00:00Z') });
      await service.atualizar('f1', 'u1', hoje);
      const pedido = provedor.estatisticas.mock.calls[0][0];
      const dias = (Date.parse(`${pedido.ate}T00:00:00Z`) - Date.parse(`${pedido.de}T00:00:00Z`)) / 86_400_000;
      expect(dias).toBeLessThan(40);
    });

    it('atualizada há menos de 12 h: não gasta cota', async () => {
      prisma.ndviMedicao.findFirst.mockResolvedValue({ inicio: new Date('2026-09-29T00:00:00Z'), atualizadoEm: new Date('2026-10-08T05:00:00Z') });
      const r = await service.atualizar('f1', 'u1', hoje);
      expect(provedor.estatisticas).not.toHaveBeenCalled();
      expect(r.recentes).toBe(1);
    });

    it('área grande demais é recusada sem chamar o provedor', async () => {
      const enorme = [
        { latitude: -20, longitude: -55 }, { latitude: -20, longitude: -54 },
        { latitude: -19, longitude: -54 }, { latitude: -19, longitude: -55 },
      ]; // ~ 1° × 1° ≈ 1,1 milhão de ha
      prisma.invernada.findMany.mockResolvedValue([{ id: 'i1', nome: 'Gigante', area: 1, poligono: enorme }]);
      const r = await service.atualizar('f1', 'u1', hoje);
      expect(provedor.estatisticas).not.toHaveBeenCalled();
      expect(r.falhas[0]!.motivo).toContain('limite');
    });

    it('erro do provedor numa área é registrado e as outras seguem; 429 para tudo', async () => {
      prisma.invernada.findMany.mockResolvedValue([
        { id: 'i1', nome: 'A', area: 100, poligono: quadrado },
        { id: 'i2', nome: 'B', area: 100, poligono: quadrado },
        { id: 'i3', nome: 'C', area: 100, poligono: quadrado },
      ]);
      provedor.estatisticas.mockRejectedValueOnce(new ProvedorIndisponivelError('instável', 503)).mockRejectedValueOnce(new ProvedorIndisponivelError('limite', 429));
      const r = await service.atualizar('f1', 'u1', hoje);
      expect(provedor.estatisticas).toHaveBeenCalledTimes(2); // parou ao bater no limite (429)
      expect(r.falhas.map((f) => f.nome)).toEqual(['A', 'B']);
    });
  });

  describe('serie', () => {
    it('devolve a série da área; tipo inválido e área de outra fazenda são recusados', async () => {
      prisma.ndviMedicao.findMany.mockResolvedValue([med('2026-09-29', 0.6)]);
      const s = await service.serie('f1', 'invernada', 'i1', 'u1');
      expect(s.serie).toHaveLength(1);
      await expect(service.serie('f1', 'banana', 'i1', 'u1')).rejects.toThrow('inválido');
      await expect(service.serie('f1', 'invernada', 'de-outra-fazenda', 'u1')).rejects.toThrow('não encontrada');
    });
  });
});
