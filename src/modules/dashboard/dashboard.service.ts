import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getResumoDaFazenda(fazendaId: string) {
    const [totalAnimais, totalReceitas, totalDespesas, totalNotificacoes] = await Promise.all([
      this.prisma.animal.count({
        where: { fazendaId },
      }),
      this.prisma.financeiro.aggregate({
        where: {
          fazendaId,
          tipo: 'receita',
        },
        _sum: { valor: true },
      }),
      this.prisma.financeiro.aggregate({
        where: {
          fazendaId,
          tipo: 'despesa',
        },
        _sum: { valor: true },
      }),
      this.prisma.ocorrencia.count({
        where: { fazendaId },
      }),
    ]);

    return {
      totalAnimais,
      totalReceitas: totalReceitas._sum.valor || 0,
      totalDespesas: totalDespesas._sum.valor || 0,
      totalNotificacoes,
    };
  }

  async getHistoricoRecentes(fazendaId: string, usuarioId: string) {
  const historico: { tipo: string; descricao: string; data: Date }[] = [];

  // 1. Animais cadastrados
  const animais = await this.prisma.animal.findMany({
    where: { fazendaId },
    orderBy: { criadoEm: 'desc' },
    take: 2,
  });

  animais.forEach((a) => {
    historico.push({
      tipo: 'animal',
      descricao: `Animal ${a.nome ?? a.brinco ?? 'sem nome'} cadastrado`,
      data: a.criadoEm,
    });
  });

  // 2. Pesagens
  const pesagens = await this.prisma.pesagem.findMany({
    where: { fazendaId },
    orderBy: { data: 'desc' },
    take: 2,
  });

  pesagens.forEach((p) => {
    historico.push({
      tipo: 'pesagem',
      descricao: `Pesagem registrada: ${p.pesoKg} kg`,
      data: p.data,
    });
  });

  // 3. Financeiro
  const financeiros = await this.prisma.financeiro.findMany({
    where: { fazendaId },
    orderBy: { data: 'desc' },
    take: 2,
  });

  financeiros.forEach((f) => {
    historico.push({
      tipo: 'financeiro',
      descricao: `Lançamento financeiro: ${f.descricao}`,
      data: f.data,
    });
  });

  // Ordena todas as movimentações por data decrescente
  historico.sort((a, b) => b.data.getTime() - a.data.getTime());

  // Retorna as duas mais recentes
  return historico.slice(0, 2);
}


}
