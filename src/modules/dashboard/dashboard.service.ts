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
}
