import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getResumoDaFazenda(fazendaId: string) {
    const [totalAnimais, totalReceitas, totalDespesas, totalNotificacoes] = await Promise.all([
      this.prisma.animal.count({ where: { fazendaId } }),
      this.prisma.financeiro.aggregate({
        where: { fazendaId, tipo: 'receita' },
        _sum: { valor: true },
      }),
      this.prisma.financeiro.aggregate({
        where: { fazendaId, tipo: 'despesa' },
        _sum: { valor: true },
      }),
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
   * - últimos animais criados (tabela Animal)
   * - últimas pesagens (tabela Pesagem)
   * - últimos lançamentos financeiros (tabela Financeiro)
   * - últimos logs de ações (tabela LogAcesso) -> captura edições/exclusões etc
   */
  async getHistoricoRecentes(fazendaId: string, usuarioId: string) {
    // 1) Coleta “eventos” de tabelas operacionais (2 mais recentes de cada)
    const [animais, pesagens, financeiros] = await Promise.all([
      this.prisma.animal.findMany({
        where: { fazendaId },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: { criadoEm: true, nome: true, brinco: true },
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
    ]);

    const historicoBase: { tipo: string; descricao: string; data: Date }[] = [];

    animais.forEach((a) => {
      historicoBase.push({
        tipo: 'animal',
        descricao: `Animal ${a.nome ?? a.brinco ?? 'sem nome'} cadastrado`,
        data: a.criadoEm,
      });
    });

    pesagens.forEach((p) => {
      historicoBase.push({
        tipo: 'pesagem',
        descricao: `Pesagem registrada: ${p.pesoKg} kg`,
        data: p.data,
      });
    });

    financeiros.forEach((f) => {
      historicoBase.push({
        tipo: 'financeiro',
        descricao: `Lançamento ${f.tipo}: ${f.descricao} (${f.valor})`,
        data: f.data,
      });
    });

    // 2) Coleta últimos logs do usuário (captura exclusões/edições etc)
    const logs = await this.prisma.logAcesso.findMany({
      where: { usuarioId },
      orderBy: { data: 'desc' },
      take: 10,
      select: { data: true, acao: true },
    });

    const historicoLogs = logs.map((l) => {
      // normaliza as mensagens dos logs
      if (l.acao.startsWith('animal_criado')) {
        return { tipo: 'log', descricao: l.acao.replace('animal_criado: ', '✅ Criou '), data: l.data };
      }
      if (l.acao.startsWith('animal_atualizado')) {
        return { tipo: 'log', descricao: l.acao.replace('animal_atualizado: ', '✏️ Atualizou '), data: l.data };
      }
      if (l.acao.startsWith('animal_excluido')) {
        return { tipo: 'log', descricao: l.acao.replace('animal_excluido: ', '🗑️ Excluiu '), data: l.data };
      }
      return { tipo: 'log', descricao: l.acao, data: l.data };
    });

    // 3) Mescla tudo, ordena e devolve os 6 mais recentes
    const historico = [...historicoBase, ...historicoLogs]
      .sort((a, b) => b.data.getTime() - a.data.getTime())
      .slice(0, 6);

    return historico;
  }

  // Indicadores (sem mudanças estruturais)
  async getIndicadores(
    fazendaId: string,
    tipo: 'peso' | 'financeiro',
    usuarioId: string
  ) {
    // Verifica acesso à fazenda
    const fazenda = await this.prisma.fazenda.findFirst({
      where: {
        id: fazendaId,
        usuarios: { some: { usuarioId } },
      },
    });
    if (!fazenda) {
      throw new ForbiddenException('Acesso negado à fazenda');
    }

    if (tipo === 'peso') {
      const registros = await this.prisma.pesagem.findMany({
        where: { animal: { fazendaId } },
        orderBy: { data: 'asc' },
      });

      const dadosAgrupados: Record<string, { soma: number; qtd: number }> = registros.reduce(
        (acc, r) => {
          const mesAno = `${r.data.getFullYear()}-${(r.data.getMonth() + 1)
            .toString()
            .padStart(2, '0')}`;
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
          const mesAno = `${r.data.getFullYear()}-${(r.data.getMonth() + 1)
            .toString()
            .padStart(2, '0')}`;
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