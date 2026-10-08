import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PlanoService } from '../plano/plano.service';
import { PAPEIS_FINANCEIRO } from '../equipe/equipe.service';
import { lerPeriodo } from '../relatorio/relatorio.service';
import { RENDIMENTO_PADRAO_PCT, ResultadoPecuaria, calcularResultadoPecuaria } from './pecuaria.resultado';

/**
 * "AAAA-MM-DD" vira o dia inteiro no horário de Brasília (UTC−3): o início às 00:00 e o fim
 * às 23:59:59.999. Sem isso, "até hoje" cortava à meia-noite UTC e deixava de fora o que foi
 * lançado hoje. Datas com horário (ISO completo) passam como vieram.
 */
export function limitesDoDia(inicio?: string, fim?: string): { inicio?: string; fim?: string } {
  const so = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return {
    ...(inicio !== undefined ? { inicio: so(inicio) ? `${inicio}T00:00:00.000-03:00` : inicio } : {}),
    ...(fim !== undefined ? { fim: so(fim) ? `${fim}T23:59:59.999-03:00` : fim } : {}),
  };
}

export interface OpcoesResultado {
  inicio?: string;
  fim?: string;
  rendimentoPct?: number;
  rateioGeraisPct?: number;
}

@Injectable()
export class PecuariaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planos: PlanoService,
  ) {}

  async resultado(fazendaId: string, usuarioId: string, op: OpcoesResultado = {}): Promise<ResultadoPecuaria & { periodo: { inicio: string; fim: string } }> {
    // traz dinheiro: só administrador e gestor
    const vinculo = await this.prisma.fazendaUsuario.findFirst({ where: { fazendaId, usuarioId }, select: { papel: true } });
    if (!vinculo) throw new ForbiddenException('Acesso negado à fazenda');
    if (!PAPEIS_FINANCEIRO.includes(vinculo.papel)) throw new ForbiddenException('Seu papel não acessa o financeiro');
    await this.planos.assertRecursoDaFazenda(fazendaId, 'custo_arroba');

    if (op.rendimentoPct !== undefined && !(op.rendimentoPct >= 30 && op.rendimentoPct <= 70)) {
      throw new BadRequestException('Rendimento de carcaça deve ficar entre 30% e 70%');
    }
    if (op.rateioGeraisPct !== undefined && !(op.rateioGeraisPct >= 0 && op.rateioGeraisPct <= 100)) {
      throw new BadRequestException('O rateio deve ficar entre 0% e 100%');
    }

    const lim = limitesDoDia(op.inicio, op.fim);
    const p = lerPeriodo(lim.inicio, lim.fim);
    const fim = p.fim ?? new Date();
    const inicio = p.inicio ?? new Date(fim.getFullYear() - 1, fim.getMonth(), fim.getDate());
    const faixa = { gte: inicio, lte: fim };

    const [despesas, vendasBrutas, pesagens, ativos, lavouras] = await Promise.all([
      this.prisma.financeiro.findMany({
        where: { fazendaId, tipo: 'despesa', data: faixa },
        select: { categoria: true, valor: true, custoLavouraId: true },
      }),
      this.prisma.financeiro.findMany({
        where: { fazendaId, tipo: 'receita', animalId: { not: null }, data: faixa },
        select: { valor: true, data: true, animalId: true, animal: { select: { peso: true } } },
      }),
      this.prisma.pesagem.findMany({
        where: { fazendaId, data: faixa },
        select: { animalId: true, data: true, pesoKg: true },
      }),
      this.prisma.animal.count({ where: { fazendaId, status: 'ativo' } }),
      this.prisma.lavoura.count({ where: { fazendaId } }),
    ]);

    // peso na venda: última pesagem até a data da venda; senão o peso cadastrado
    const idsVendidos = [...new Set(vendasBrutas.map((v) => v.animalId as string))];
    const historico = idsVendidos.length
      ? await this.prisma.pesagem.findMany({
          where: { animalId: { in: idsVendidos }, fazendaId, data: { lte: fim } },
          select: { animalId: true, data: true, pesoKg: true },
          orderBy: { data: 'desc' },
        })
      : [];
    const vendas = vendasBrutas.map((v) => {
      const ultima = historico.find((h) => h.animalId === v.animalId && h.data <= v.data);
      return {
        valor: v.valor,
        data: v.data,
        animalId: v.animalId as string,
        pesoKg: ultima?.pesoKg ?? v.animal?.peso ?? null,
      };
    });

    // fazenda mista: por padrão metade dos custos gerais é da lavoura
    const rateioGeraisPct = op.rateioGeraisPct ?? (lavouras > 0 ? 50 : 100);

    const r = calcularResultadoPecuaria({
      despesas,
      pesagens,
      vendas,
      animaisAtivos: ativos,
      rendimentoPct: op.rendimentoPct ?? RENDIMENTO_PADRAO_PCT,
      rateioGeraisPct,
    });
    return { ...r, periodo: { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) } };
  }
}
