// src/modules/dashboard/dashboard.service.ts
import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type HistoricoItem = {
  tipo: string;
  descricao: string;
  data: Date;
  meta?: any;
};

type IndicadoresFiltro = {
  from: Date;
  to: Date;
  groupBy: 'month' | 'animal';
  invernadaId?: string;
  animalIds?: string[];
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Resumo do topo =====
  async getResumoDaFazenda(fazendaId: string, usuarioId: string) {
    const acesso = await this.prisma.fazendaUsuario.findFirst({
      where: { fazendaId, usuarioId },
      select: { id: true },
    });
    if (!acesso) throw new ForbiddenException('Acesso negado à fazenda');

    const [
      totalAnimais,
      totalReceitasAgg,
      totalDespesasAgg,
      totalNotificacoes,
      totalHectaresAgg,
    ] = await Promise.all([
      this.prisma.animal.count({ where: { fazendaId } }),
      this.prisma.financeiro.aggregate({ where: { fazendaId, tipo: 'receita' }, _sum: { valor: true } }),
      this.prisma.financeiro.aggregate({ where: { fazendaId, tipo: 'despesa' }, _sum: { valor: true } }),
      this.prisma.ocorrencia.count({ where: { fazendaId } }),
      this.prisma.lavoura.aggregate({ where: { fazendaId }, _sum: { areaHa: true } }),
    ]);

    const totalReceitas = Number(totalReceitasAgg._sum.valor ?? 0);
    const totalDespesas = Number(totalDespesasAgg._sum.valor ?? 0);
    const saldo = Number((totalReceitas - totalDespesas).toFixed(2));
    const totalHectares = Number(totalHectaresAgg._sum.areaHa ?? 0);

    return {
      totalAnimais,
      totalReceitas,
      totalDespesas,
      totalNotificacoes,
      saldo,
      totalHectares,
      notificacoes: totalNotificacoes,
    };
  }

  // ===== Helpers de logs =====
  private parseKeyVals(acao: string): Record<string, string> {
    const map: Record<string, string> = {};
    const regex = /(\w+)=([^=\n\r]+)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(acao)) !== null) {
      const k = m[1];
      const v = m[2].trim();
      map[k] = v;
    }
    return map;
  }

  private normalizaLog(acao: string): { tipo: string; descricao: string; meta?: any } {
    const kv = this.parseKeyVals(acao);
    const changes = (kv.changes ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (acao.startsWith('animal_criado')) {
      return {
        tipo: 'animal',
        descricao: `✅ Criou animal — brinco=${kv.brinco ?? '—'}`,
        meta: { ids: { animalId: kv.id }, animal: { brinco: kv.brinco ?? null } },
      };
    }
    if (acao.startsWith('animal_atualizado')) {
      return {
        tipo: 'animal_atualizado',
        descricao: `✏️ Atualizou animal — brinco=${kv.brinco ?? '—'}`,
        meta: { ids: { animalId: kv.id }, animal: { brinco: kv.brinco ?? null }, changes },
      };
    }
    if (acao.startsWith('animal_excluido')) {
      return { tipo: 'log', descricao: `🗑️ Excluiu animal — brinco=${kv.brinco ?? '—'}` };
    }

    if (acao.startsWith('manejo_criado')) return { tipo: 'log', descricao: '🧰 Criou manejo' };
    if (acao.startsWith('manejo_atualizado')) return { tipo: 'log', descricao: '✏️ Atualizou manejo', meta: { changes } };
    if (acao.startsWith('manejo_excluido')) return { tipo: 'log', descricao: '🗑️ Excluiu manejo' };

    if (acao.startsWith('sanidade_criada')) return { tipo: 'log', descricao: '🩺 Criou sanidade' };
    if (acao.startsWith('sanidade_atualizada')) return { tipo: 'log', descricao: '✏️ Atualizou sanidade', meta: { changes } };
    if (acao.startsWith('sanidade_excluida')) return { tipo: 'log', descricao: '🗑️ Excluiu sanidade' };

    if (acao.startsWith('medicamento_criado')) return { tipo: 'log', descricao: '💊 Criou medicamento' };
    if (acao.startsWith('medicamento_atualizado')) return { tipo: 'log', descricao: '✏️ Atualizou medicamento', meta: { changes } };
    if (acao.startsWith('medicamento_excluido')) return { tipo: 'log', descricao: '🗑️ Excluiu medicamento' };

    if (acao.startsWith('lavoura_criada')) return { tipo: 'log', descricao: '🌱 Criou lavoura' };
    if (acao.startsWith('lavoura_atualizada')) return { tipo: 'log', descricao: '✏️ Atualizou lavoura', meta: { changes } };
    if (acao.startsWith('lavoura_excluida')) return { tipo: 'log', descricao: '🗑️ Excluiu lavoura' };

    if (acao.startsWith('invernada_criada')) return { tipo: 'log', descricao: '🌾 Criou invernada' };
    if (acao.startsWith('invernada_atualizada')) return { tipo: 'log', descricao: '✏️ Atualizou invernada', meta: { changes } };
    if (acao.startsWith('invernada_excluida')) return { tipo: 'log', descricao: '🗑️ Excluiu invernada' };

    if (acao.startsWith('compra_criada') || acao.startsWith('compra_insumo_criada'))
      return { tipo: 'log', descricao: '🧾 Criou compra de insumo' };
    if (acao.startsWith('compra_atualizada') || acao.startsWith('compra_insumo_atualizada'))
      return { tipo: 'log', descricao: '✏️ Atualizou compra de insumo', meta: { changes } };
    if (acao.startsWith('compra_excluida') || acao.startsWith('compra_insumo_excluida'))
      return { tipo: 'log', descricao: '🗑️ Excluiu compra de insumo' };

    if (acao.startsWith('financeiro_criado')) return { tipo: 'log', descricao: '💰 Criou lançamento financeiro' };
    if (acao.startsWith('financeiro_atualizado')) return { tipo: 'log', descricao: '✏️ Atualizou lançamento financeiro', meta: { changes } };
    if (acao.startsWith('financeiro_excluido')) return { tipo: 'log', descricao: '🗑️ Excluiu lançamento financeiro' };

    if (acao.startsWith('ocorrencia_criada')) return { tipo: 'ocorrencia', descricao: '📝 Criou ocorrência' };
    if (acao.startsWith('ocorrencia_atualizada')) return { tipo: 'ocorrencia', descricao: '✏️ Atualizou ocorrência', meta: { changes } };
    if (acao.startsWith('ocorrencia_excluida')) return { tipo: 'ocorrencia', descricao: '🗑️ Excluiu ocorrência' };

    return { tipo: 'log', descricao: acao };
  }

  // ===== Histórico unificado =====
  async getHistoricoRecentes(fazendaId: string, usuarioId: string) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
    });
    if (!fazenda) throw new ForbiddenException('Acesso negado à fazenda');

    const [
      animais,
      lavouras,
      invernadas,
      manejos,
      compras,
      financeiros,
      sanidades,
      medicamentos,
      ocorrencias,
    ] = await Promise.all([
      this.prisma.animal.findMany({
        where: { fazendaId },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: {
          id: true, criadoEm: true, brinco: true, sexo: true, raca: true, idade: true, unidadeIdade: true, lote: true,
          invernada: { select: { nome: true } },
        },
      }),
      this.prisma.lavoura.findMany({
        where: { fazendaId },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: { id: true, criadoEm: true, nome: true, areaHa: true, cultura: true },
      }),
      this.prisma.invernada.findMany({
        where: { fazendaId },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: { id: true, criadoEm: true, nome: true, area: true },
      }),
      this.prisma.manejo.findMany({
        where: { fazendaId },
        orderBy: { data: 'desc' },
        take: 2,
        select: {
          id: true, data: true, tipo: true, observacao: true, animalId: true,
          animal: {
            select: {
              id: true, brinco: true, sexo: true, raca: true, idade: true, unidadeIdade: true, lote: true,
              invernada: { select: { nome: true } },
            },
          },
        },
      }),
      this.prisma.compraInsumo.findMany({
        where: { fazendaId },
        orderBy: { data: 'desc' },
        take: 2,
        select: { id: true, data: true, insumo: true, quantidade: true, unidade: true, valor: true, fornecedor: true },
      }),
      this.prisma.financeiro.findMany({
        where: { fazendaId },
        orderBy: { data: 'desc' },
        take: 2,
        select: { id: true, data: true, descricao: true, tipo: true, valor: true },
      }),
      this.prisma.sanidade.findMany({
        where: { animal: { fazendaId } },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: {
          id: true, criadoEm: true, tipo: true, observacoes: true, animalId: true,
          animal: {
            select: {
              id: true, brinco: true, sexo: true, raca: true, idade: true, unidadeIdade: true, lote: true,
              invernada: { select: { nome: true } },
            },
          },
        },
      }),
      this.prisma.medicamento.findMany({
        where: { animal: { fazendaId } },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: {
          id: true, criadoEm: true, nome: true, dosagem: true, viaAplicacao: true, observacoes: true,
          proximaAplicacao: true, lembreteAtivo: true, animalId: true,
          animal: {
            select: {
              id: true, brinco: true, sexo: true, raca: true, idade: true, unidadeIdade: true, lote: true,
              invernada: { select: { nome: true } },
            },
          },
        },
      }),
      this.prisma.ocorrencia.findMany({
        where: { fazendaId },
        orderBy: { data: 'desc' },
        take: 2,
        select: {
          id: true, data: true, titulo: true, tipo: true, descricao: true, animalId: true,
          animal: {
            select: {
              id: true, brinco: true, sexo: true, raca: true, idade: true, unidadeIdade: true, lote: true,
              invernada: { select: { nome: true } },
            },
          },
        },
      }),
    ]);

    const historico: HistoricoItem[] = [];

    // blocos variáveis (animais, lavouras, etc) — omitido aqui para encurtar
    // (use a versão que já validamos juntos, que empurra todos os itens e enriquece “animal_atualizado”)

    // logs do usuário (filtrados por fazenda)
    const logs = await this.prisma.logAcesso.findMany({
      where: { usuarioId },
      orderBy: { data: 'desc' },
      take: 15,
      select: { data: true, acao: true },
    });

    const logsSomenteDestaFazenda = logs.filter((l) => {
      const kv = this.parseKeyVals(l.acao);
      if (kv.fazendaId) return kv.fazendaId === fazendaId;
      if (l.acao.startsWith('fazenda_') && kv.id) return kv.id === fazendaId;
      return true;
    });

    for (const l of logsSomenteDestaFazenda) {
      const norm = this.normalizaLog(l.acao);
      historico.push({
        tipo: norm.tipo,
        descricao: norm.descricao,
        data: l.data ?? new Date(),
        meta: norm.meta,
      });
    }

    historico.sort((a, b) => b.data.getTime() - a.data.getTime());
    return historico.slice(0, 6);
  }

  // ===== Indicadores =====
  async getIndicadores(
    fazendaId: string,
    tipo: 'peso' | 'financeiro',
    usuarioId: string,
    filtro: IndicadoresFiltro,
  ) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!fazenda) throw new ForbiddenException('Acesso negado à fazenda');

    if (tipo === 'peso') {
      // PESO: por período + filtros (invernada / animalIds)
      const whereBase: any = {
        animal: { fazendaId },
        data: { gte: filtro.from, lte: filtro.to },
      };

      if (filtro.invernadaId) {
        whereBase.animal.invernadaId = filtro.invernadaId;
      }
      if (filtro.animalIds?.length) {
        whereBase.animalId = { in: filtro.animalIds };
      }

      const regs = await this.prisma.pesagem.findMany({
        where: whereBase,
        orderBy: { data: 'asc' },
        select: {
          id: true,
          data: true,
          pesoKg: true,
          animalId: true,
          animal: { select: { brinco: true } },
        },
      });

      if (filtro.groupBy === 'animal') {
        // agrupa por animal
        const map: Record<string, { brinco: string; sum: number; count: number }> = {};
        for (const r of regs) {
          const key = r.animalId;
          if (!map[key]) map[key] = { brinco: r.animal?.brinco ?? key, sum: 0, count: 0 };
          map[key].sum += r.pesoKg;
          map[key].count += 1;
        }
        const labels = Object.values(map).map((v) => v.brinco);
        const data = Object.values(map).map((v) => +(v.sum / Math.max(v.count, 1)).toFixed(2));
        return { labels, datasets: [{ data }] };
      }

      // default: por mês
      const map: Record<string, { sum: number; count: number }> = {};
      for (const r of regs) {
        const key = `${r.data.getFullYear()}-${(r.data.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!map[key]) map[key] = { sum: 0, count: 0 };
        map[key].sum += r.pesoKg;
        map[key].count += 1;
      }
      const labels = Object.keys(map).sort();
      const data = labels.map((k) => +(map[k].sum / Math.max(map[k].count, 1)).toFixed(2));
      return { labels, datasets: [{ data }] };
    }

    if (tipo === 'financeiro') {
      // FINANCEIRO: saldo mensal do período (receitas - despesas)
      const regs = await this.prisma.financeiro.findMany({
        where: {
          fazendaId,
          data: { gte: filtro.from, lte: filtro.to },
        },
        orderBy: { data: 'asc' },
        select: { valor: true, tipo: true, data: true },
      });

      const map: Record<string, { receita: number; despesa: number }> = {};
      for (const r of regs) {
        const key = `${r.data.getFullYear()}-${(r.data.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!map[key]) map[key] = { receita: 0, despesa: 0 };
        if (r.tipo === 'receita') map[key].receita += r.valor;
        else map[key].despesa += r.valor;
      }
      const labels = Object.keys(map).sort();
      const data = labels.map((k) => +(map[k].receita - map[k].despesa).toFixed(2));
      return { labels, datasets: [{ data }] };
    }

    throw new BadRequestException('Tipo inválido');
  }
}