// src/modules/dashboard/dashboard.service.ts
import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type HistoricoItem = { tipo: string; descricao: string; data: Date };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Mantive as chaves iguais pra não quebrar o app:
  // totalAnimais, totalReceitas, totalDespesas, totalNotificacoes
  async getResumoDaFazenda(fazendaId: string) {
    const [totalAnimais, totalReceitas, totalDespesas, totalNotificacoes] =
      await Promise.all([
        this.prisma.animal.count({ where: { fazendaId } }),
        this.prisma.financeiro.aggregate({
          where: { fazendaId, tipo: 'receita' },
          _sum: { valor: true },
        }),
        this.prisma.financeiro.aggregate({
          where: { fazendaId, tipo: 'despesa' },
          _sum: { valor: true },
        }),
        // segue sendo “ocorrencias” (como você já tinha)
        this.prisma.ocorrencia.count({ where: { fazendaId } }),
      ]);

    return {
      totalAnimais,
      totalReceitas: totalReceitas._sum.valor || 0,
      totalDespesas: totalDespesas._sum.valor || 0,
      totalNotificacoes,
    };
  }

  /**
   * Histórico unificado:
   * - últimos registros nativos (2 de cada): Animal, Lavoura, Invernada, Manejo,
   *   CompraInsumo, Pesagem, Financeiro, Sanidade, Medicamento
   * - MAIS últimos logs do usuário (LogAcesso), que capturam create/update/delete
   *
   * Retorna os 6 mais recentes (misturado), ordenados por data desc.
   */
  async getHistoricoRecentes(fazendaId: string, usuarioId: string) {
    // 1) “eventos base” (2 de cada) — todos restritos à fazenda:
    const [
      animais,
      lavouras,
      invernadas,
      manejos,
      compras,
      pesagens,
      financeiros,
      sanidades,
      medicamentos,
    ] = await Promise.all([
      this.prisma.animal.findMany({
        where: { fazendaId },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: { criadoEm: true, nome: true, brinco: true },
      }),
      this.prisma.lavoura.findMany({
        where: { fazendaId },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: { criadoEm: true, nome: true, areaHa: true },
      }),
      this.prisma.invernada.findMany({
        where: { fazendaId },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: { criadoEm: true, nome: true, area: true },
      }),
      this.prisma.manejo.findMany({
        where: { fazendaId },
        orderBy: { data: 'desc' },
        take: 2,
        select: { data: true, tipo: true, observacao: true },
      }),
      this.prisma.compraInsumo.findMany({
        where: { fazendaId },
        orderBy: { data: 'desc' },
        take: 2,
        select: { data: true, insumo: true, quantidade: true, unidade: true, valor: true },
      }),
      this.prisma.pesagem.findMany({
        where: { fazendaId },
        orderBy: { data: 'desc' },
        take: 2,
        select: { data: true, pesoKg: true },
      }),
      this.prisma.financeiro.findMany({
        where: { fazendaId },
        orderBy: { data: 'desc' },
        take: 2,
        select: { data: true, descricao: true, tipo: true, valor: true },
      }),
      this.prisma.sanidade.findMany({
        where: { animal: { fazendaId } },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: { criadoEm: true, tipo: true },
      }),
      this.prisma.medicamento.findMany({
        where: { animal: { fazendaId } },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: { criadoEm: true, nome: true, proximaAplicacao: true },
      }),
    ]);

    const historicoBase: HistoricoItem[] = [];

    // animais
    animais.forEach((a) => {
      historicoBase.push({
        tipo: 'animal',
        descricao: `Animal ${a.nome ?? a.brinco ?? 'sem nome'} cadastrado`,
        data: a.criadoEm,
      });
    });

    // lavouras
    lavouras.forEach((l) => {
      historicoBase.push({
        tipo: 'lavoura',
        descricao: `Lavoura ${l.nome} cadastrada (${(l.areaHa ?? 0).toFixed(2)} ha)`,
        data: l.criadoEm,
      });
    });

    // invernadas
    invernadas.forEach((inv) => {
      historicoBase.push({
        tipo: 'invernada',
        descricao: `Invernada ${inv.nome} cadastrada (${(inv.area ?? 0).toFixed(2)} ha)`,
        data: inv.criadoEm,
      });
    });

    // manejos
    manejos.forEach((m) => {
      historicoBase.push({
        tipo: 'manejo',
        descricao: `Manejo: ${m.tipo}${m.observacao ? ` — ${m.observacao}` : ''}`,
        data: m.data,
      });
    });

    // compras de insumo
    compras.forEach((c) => {
      historicoBase.push({
        tipo: 'compra',
        descricao: `Compra de ${c.insumo} — ${c.quantidade} ${c.unidade} (R$ ${c.valor.toFixed(2)})`,
        data: c.data,
      });
    });

    // pesagens
    pesagens.forEach((p) => {
      historicoBase.push({
        tipo: 'pesagem',
        descricao: `Pesagem registrada: ${p.pesoKg} kg`,
        data: p.data,
      });
    });

    // financeiro
    financeiros.forEach((f) => {
      historicoBase.push({
        tipo: 'financeiro',
        descricao: `Lançamento ${f.tipo}: ${f.descricao} (R$ ${f.valor.toFixed(2)})`,
        data: f.data,
      });
    });

    // sanidade
    sanidades.forEach((s) => {
      historicoBase.push({
        tipo: 'sanidade',
        descricao: `Sanidade registrada: ${s.tipo}`,
        data: s.criadoEm,
      });
    });

    // medicamento
    medicamentos.forEach((m) => {
      historicoBase.push({
        tipo: 'medicamento',
        descricao: `Medicamento aplicado: ${m.nome}${
          m.proximaAplicacao ? ` — próxima: ${m.proximaAplicacao.toLocaleDateString()}` : ''
        }`,
        data: m.criadoEm,
      });
    });

    // 2) Últimos logs do usuário (capturam create/update/delete em vários módulos)
    const logs = await this.prisma.logAcesso.findMany({
      where: { usuarioId },
      orderBy: { data: 'desc' },
      take: 15,
      select: { data: true, acao: true },
    });

    const normalizaLog = (acao: string): HistoricoItem => {
      // animal
      if (acao.startsWith('animal_criado')) return { tipo: 'log', descricao: acao.replace('animal_criado', '✅ Criou animal'), data: new Date() };
      if (acao.startsWith('animal_atualizado')) return { tipo: 'log', descricao: acao.replace('animal_atualizado', '✏️ Atualizou animal'), data: new Date() };
      if (acao.startsWith('animal_excluido')) return { tipo: 'log', descricao: acao.replace('animal_excluido', '🗑️ Excluiu animal'), data: new Date() };

      // lavoura
      if (acao.startsWith('lavoura_criada')) return { tipo: 'log', descricao: acao.replace('lavoura_criada', '🌱 Criou lavoura'), data: new Date() };
      if (acao.startsWith('lavoura_atualizada')) return { tipo: 'log', descricao: acao.replace('lavoura_atualizada', '✏️ Atualizou lavoura'), data: new Date() };
      if (acao.startsWith('lavoura_excluida')) return { tipo: 'log', descricao: acao.replace('lavoura_excluida', '🗑️ Excluiu lavoura'), data: new Date() };

      // invernada
      if (acao.startsWith('invernada_criada')) return { tipo: 'log', descricao: acao.replace('invernada_criada', '🌾 Criou invernada'), data: new Date() };
      if (acao.startsWith('invernada_atualizada')) return { tipo: 'log', descricao: acao.replace('invernada_atualizada', '✏️ Atualizou invernada'), data: new Date() };
      if (acao.startsWith('invernada_excluida')) return { tipo: 'log', descricao: acao.replace('invernada_excluida', '🗑️ Excluiu invernada'), data: new Date() };

      // manejo
      if (acao.startsWith('manejo_criado')) return { tipo: 'log', descricao: acao.replace('manejo_criado', '🧰 Criou manejo'), data: new Date() };
      if (acao.startsWith('manejo_atualizado')) return { tipo: 'log', descricao: acao.replace('manejo_atualizado', '✏️ Atualizou manejo'), data: new Date() };
      if (acao.startsWith('manejo_excluido')) return { tipo: 'log', descricao: acao.replace('manejo_excluido', '🗑️ Excluiu manejo'), data: new Date() };

      // compra-insumo
      if (acao.startsWith('compra_insumo_criada')) return { tipo: 'log', descricao: acao.replace('compra_insumo_criada', '🧾 Criou compra de insumo'), data: new Date() };
      if (acao.startsWith('compra_insumo_atualizada')) return { tipo: 'log', descricao: acao.replace('compra_insumo_atualizada', '✏️ Atualizou compra de insumo'), data: new Date() };
      if (acao.startsWith('compra_insumo_excluida')) return { tipo: 'log', descricao: acao.replace('compra_insumo_excluida', '🗑️ Excluiu compra de insumo'), data: new Date() };

      // financeiro
      if (acao.startsWith('financeiro_criado')) return { tipo: 'log', descricao: acao.replace('financeiro_criado', '💰 Criou lançamento financeiro'), data: new Date() };
      if (acao.startsWith('financeiro_atualizado')) return { tipo: 'log', descricao: acao.replace('financeiro_atualizado', '✏️ Atualizou lançamento financeiro'), data: new Date() };
      if (acao.startsWith('financeiro_excluido')) return { tipo: 'log', descricao: acao.replace('financeiro_excluido', '🗑️ Excluiu lançamento financeiro'), data: new Date() };

      // sanidade
      if (acao.startsWith('sanidade_criada')) return { tipo: 'log', descricao: acao.replace('sanidade_criada', '🩺 Criou sanidade'), data: new Date() };
      if (acao.startsWith('sanidade_atualizada')) return { tipo: 'log', descricao: acao.replace('sanidade_atualizada', '✏️ Atualizou sanidade'), data: new Date() };
      if (acao.startsWith('sanidade_excluida')) return { tipo: 'log', descricao: acao.replace('sanidade_excluida', '🗑️ Excluiu sanidade'), data: new Date() };

      // medicamento
      if (acao.startsWith('medicamento_criado')) return { tipo: 'log', descricao: acao.replace('medicamento_criado', '💊 Criou medicamento'), data: new Date() };
      if (acao.startsWith('medicamento_atualizado')) return { tipo: 'log', descricao: acao.replace('medicamento_atualizado', '✏️ Atualizou medicamento'), data: new Date() };
      if (acao.startsWith('medicamento_excluido')) return { tipo: 'log', descricao: acao.replace('medicamento_excluido', '🗑️ Excluiu medicamento'), data: new Date() };

      // genérico
      return { tipo: 'log', descricao: acao, data: new Date() };
    };

    const historicoLogs: HistoricoItem[] = logs.map((l) => ({
      ...normalizaLog(l.acao),
      data: l.data, // preserva a data real do log
    }));

    // 3) Mescla, ordena e limita (6 mais recentes)
    const historico = [...historicoBase, ...historicoLogs]
      .sort((a, b) => b.data.getTime() - a.data.getTime())
      .slice(0, 6);

    return historico;
  }

  // Indicadores (inalterado, só confere acesso)
  async getIndicadores(
    fazendaId: string,
    tipo: 'peso' | 'financeiro',
    usuarioId: string
  ) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
    });
    if (!fazenda) throw new ForbiddenException('Acesso negado à fazenda');

    if (tipo === 'peso') {
      const registros = await this.prisma.pesagem.findMany({
        where: { animal: { fazendaId } },
        orderBy: { data: 'asc' },
      });

      const dadosAgrupados: Record<string, { soma: number; qtd: number }> = registros.reduce(
        (acc, r) => {
          const mesAno = `${r.data.getFullYear()}-${(r.data.getMonth() + 1).toString().padStart(2, '0')}`;
          if (!acc[mesAno]) acc[mesAno] = { soma: 0, qtd: 0 };
          acc[mesAno].soma += r.pesoKg;
          acc[mesAno].qtd += 1;
          return acc;
        },
        {} as Record<string, { soma: number; qtd: number }>
      );

      const resultado = Object.entries(dadosAgrupados).map(([mesAno, { soma, qtd }]) => ({
        data: mesAno,
        valor: +(soma / qtd).toFixed(2),
      }));

      return {
        labels: resultado.map((r) => r.data),
        datasets: [{ data: resultado.map((r) => r.valor) }],
      };
    }

    if (tipo === 'financeiro') {
      const registros = await this.prisma.financeiro.findMany({
        where: { fazendaId },
        orderBy: { data: 'asc' },
      });

      const dadosAgrupados: Record<string, { receita: number; despesa: number }> = registros.reduce(
        (acc, r) => {
          const mesAno = `${r.data.getFullYear()}-${(r.data.getMonth() + 1).toString().padStart(2, '0')}`;
          if (!acc[mesAno]) acc[mesAno] = { receita: 0, despesa: 0 };
          if (r.tipo === 'receita') acc[mesAno].receita += r.valor;
          else acc[mesAno].despesa += r.valor;
          return acc;
        },
        {} as Record<string, { receita: number; despesa: number }>
      );

      const resultado = Object.entries(dadosAgrupados).map(([mesAno, { receita, despesa }]) => ({
        data: mesAno,
        valor: +(receita - despesa).toFixed(2),
      }));

      return {
        labels: resultado.map((r) => r.data),
        datasets: [{ data: resultado.map((r) => r.valor) }],
      };
    }

    throw new BadRequestException('Tipo inválido');
  }
}