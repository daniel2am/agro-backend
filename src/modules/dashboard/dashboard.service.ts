import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
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

//indicadores
async getIndicadores(
  fazendaId: string,
  tipo: 'peso' | 'financeiro',
  usuarioId: string
) {
  // Verifica se o usuário tem acesso à fazenda
  const fazenda = await this.prisma.fazenda.findFirst({
    where: {
      id: fazendaId,
      usuarios: {
        some: {
          usuarioId,
        },
      },
    },
  });

  if (!fazenda) {
    throw new ForbiddenException('Acesso negado à fazenda');
  }

  if (tipo === 'peso') {
    const registros = await this.prisma.pesagem.findMany({
      where: {
        animal: {
          fazendaId,
        },
      },
      orderBy: { data: 'asc' },
    });

      const dadosAgrupados: Record<string, { soma: number; qtd: number }> = registros.reduce((acc, registro) => {
      const mesAno = `${registro.data.getFullYear()}-${(registro.data.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;

      if (!acc[mesAno]) {
        acc[mesAno] = { soma: 0, qtd: 0 };
      }

      acc[mesAno].soma += registro.pesoKg;
      acc[mesAno].qtd += 1;

      return acc;
    }, {});

    const resultado = Object.entries(dadosAgrupados).map(([mesAno, { soma, qtd }]) => ({
      data: mesAno,
      valor: +(soma / qtd).toFixed(2),
    }));

    return resultado;
  }

  if (tipo === 'financeiro') {
    const registros = await this.prisma.financeiro.findMany({
      where: {
        fazendaId,
      },
      orderBy: { data: 'asc' },
    });

      const dadosAgrupados: Record<string, { receita: number; despesa: number }> = registros.reduce((acc, registro) => {
      const mesAno = `${registro.data.getFullYear()}-${(registro.data.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;

      if (!acc[mesAno]) {
        acc[mesAno] = { receita: 0, despesa: 0 };
      }

      if (registro.tipo === 'receita') {
        acc[mesAno].receita += registro.valor;
      } else {
        acc[mesAno].despesa += registro.valor;
      }

      return acc;
    }, {});

    const resultado = Object.entries(dadosAgrupados).map(([mesAno, valores]) => ({
      data: mesAno,
      valor: +(valores.receita - valores.despesa).toFixed(2),
    }));

    return resultado;
  }

  throw new BadRequestException('Tipo inválido');
}

}
