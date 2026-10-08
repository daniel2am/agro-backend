// src/modules/lavoura/lavoura.service.ts
import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateLavouraDto, UpdateLavouraDto } from './dto';
import { PlanoService } from '../plano/plano.service';

@Injectable()
export class LavouraService {
  private readonly logger = new Logger(LavouraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planos: PlanoService,
  ) {}

  // ===== Helpers =====
  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log (lavoura): ${String(e)}`);
    }
  }

  private async assertAcessoFazenda(fazendaId: string, usuarioId: string) {
    const ok = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('Acesso negado à fazenda');
  }

  // ===== CRUD =====
  async create(data: CreateLavouraDto, usuarioId: string) {
    await this.assertAcessoFazenda(data.fazendaId, usuarioId);
    await this.planos.assertLimiteDaFazenda(data.fazendaId, 'areas');

    const { poligono, ...resto } = data;
    const lavoura = await this.prisma.lavoura.create({
      data: {
        ...resto,
        dataPlantio: new Date(data.dataPlantio),
        ...(poligono ? { poligono: poligono.map(({ latitude, longitude }) => ({ latitude, longitude })) } : {}),
      },
    });

    // log para histórico (padrão key=value que já usamos)
    await this.safeLog(
      usuarioId,
      `lavoura_criada id=${lavoura.id} nome=${lavoura.nome} areaHa=${lavoura.areaHa ?? 0} fazenda=${lavoura.fazendaId}`
    );

    return lavoura;
  }

  async findAll(usuarioId: string) {
    return this.prisma.lavoura.findMany({
      where: { fazenda: { usuarios: { some: { usuarioId } } } },
      include: { fazenda: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: string, usuarioId: string) {
    const lavoura = await this.prisma.lavoura.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      include: { fazenda: true },
    });
    if (!lavoura) throw new NotFoundException('Lavoura não encontrada');
    return lavoura;
  }

  /**
   * Resultado da lavoura: quanto custou (despesas alocadas nela), quanto rendeu
   * (vendas) e o resumo do que foi feito (procedimentos por tipo).
   *
   * O custo por hectare usa a área ORIGINAL (área atual + área já vendida):
   * `areaHa` encolhe a cada venda de área, e dividir pelo que sobrou inflaria o custo.
   */
  async resumo(id: string, usuarioId: string) {
    const lavoura = await this.prisma.lavoura.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true, nome: true, cultura: true, areaHa: true, dataPlantio: true, status: true },
    });
    if (!lavoura) throw new NotFoundException('Lavoura não encontrada');

    const [custos, vendas, porTipo] = await Promise.all([
      this.prisma.financeiro.aggregate({
        where: { custoLavouraId: id, tipo: 'despesa' },
        _sum: { valor: true },
        _count: { _all: true },
      }),
      this.prisma.financeiro.aggregate({
        where: { lavouraId: id, tipo: 'receita' },
        _sum: { valor: true, areaVendidaHa: true },
        _count: { _all: true },
      }),
      this.prisma.procedimentoLavoura.groupBy({
        by: ['tipo'],
        where: { lavouraId: id },
        _count: { _all: true },
        _max: { data: true },
      }),
    ]);

    const custoTotal = Number(custos._sum.valor ?? 0);
    const receitaTotal = Number(vendas._sum.valor ?? 0);
    const areaVendidaHa = Number(vendas._sum.areaVendidaHa ?? 0);
    const areaOriginalHa = lavoura.areaHa + areaVendidaHa;
    const resultado = receitaTotal - custoTotal;

    const tipos = porTipo
      .map((p) => ({ tipo: p.tipo, quantidade: p._count._all, ultimaData: p._max.data }))
      .sort((a, b) => b.quantidade - a.quantidade);

    return {
      lavoura,
      areaOriginalHa,
      custo: { total: custoTotal, lancamentos: custos._count._all },
      receita: { total: receitaTotal, lancamentos: vendas._count._all, areaVendidaHa },
      resultado,
      margemPct: receitaTotal > 0 ? Number(((resultado / receitaTotal) * 100).toFixed(1)) : null,
      custoPorHa: areaOriginalHa > 0 ? Number((custoTotal / areaOriginalHa).toFixed(2)) : null,
      procedimentos: {
        total: tipos.reduce((s, t) => s + t.quantidade, 0),
        porTipo: tipos,
      },
    };
  }

  async update(id: string, data: UpdateLavouraDto, usuarioId: string) {
    // garante acesso
    const atual = await this.prisma.lavoura.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true, fazendaId: true },
    });
    if (!atual) throw new ForbiddenException('Acesso negado');

    const lavoura = await this.prisma.lavoura.update({
      where: { id },
      data: {
        ...(data.nome !== undefined ? { nome: data.nome } : {}),
        ...(data.areaHa !== undefined ? { areaHa: data.areaHa } : {}),
        ...(data.cultura !== undefined ? { cultura: data.cultura } : {}),
        ...(data.semente !== undefined ? { semente: data.semente } : {}),
        // perímetro para o satélite; a classe de validação vira objeto simples antes de ir ao JSON
        ...(data.poligono !== undefined
          ? { poligono: data.poligono.map(({ latitude, longitude }) => ({ latitude, longitude })) }
          : {}),
      },
    });

    await this.safeLog(
      usuarioId,
      `lavoura_atualizada id=${lavoura.id} nome=${lavoura.nome} areaHa=${lavoura.areaHa ?? 0} fazenda=${lavoura.fazendaId}`
    );

    return lavoura;
  }

  async remove(id: string, usuarioId: string) {
    const lavoura = await this.prisma.lavoura.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true, nome: true, fazendaId: true, areaHa: true },
    });
    if (!lavoura) throw new ForbiddenException('Acesso negado');

    await this.prisma.lavoura.delete({ where: { id } });

    await this.safeLog(
      usuarioId,
      `lavoura_excluida id=${lavoura.id} nome=${lavoura.nome} areaHa=${lavoura.areaHa ?? 0} fazenda=${lavoura.fazendaId}`
    );

    return { message: 'Lavoura removida com sucesso' };
  }
}