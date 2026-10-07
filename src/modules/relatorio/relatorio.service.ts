// src/modules/relatorio/relatorio.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PlanoService } from '../plano/plano.service';
import { PAPEIS_FINANCEIRO } from '../equipe/equipe.service';
import { RelatorioDados, agregarFinanceiro, lotacao } from './relatorio.dados';
import { renderizarRelatorioPdf } from './relatorio.pdf';

export function lerPeriodo(inicio?: string, fim?: string) {
  const parse = (v: string | undefined, nome: string) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`${nome} inválido`);
    return d;
  };
  const i = parse(inicio, 'Início');
  const f = parse(fim, 'Fim');
  if (i && f && i > f) throw new BadRequestException('O início do período não pode ser depois do fim');
  return { inicio: i, fim: f };
}

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planos: PlanoService,
  ) {}

  async dados(fazendaId: string, usuarioId: string, inicio?: string, fim?: string): Promise<RelatorioDados> {
    // relatório traz dinheiro: só administrador e gestor
    const vinculo = await this.prisma.fazendaUsuario.findFirst({ where: { fazendaId, usuarioId }, select: { papel: true } });
    if (!vinculo) throw new ForbiddenException('Acesso negado à fazenda');
    if (!PAPEIS_FINANCEIRO.includes(vinculo.papel)) throw new ForbiddenException('Seu papel não acessa relatórios financeiros');
    await this.planos.assertRecursoDaFazenda(fazendaId, 'relatorio_pdf');

    const periodo = lerPeriodo(inicio, fim);
    const faixa = {
      ...(periodo.inicio ? { gte: periodo.inicio } : {}),
      ...(periodo.fim ? { lte: periodo.fim } : {}),
    };

    const fazenda = await this.prisma.fazenda.findUnique({
      where: { id: fazendaId },
      select: { nome: true, cidade: true, estado: true, areaTotal: true },
    });
    if (!fazenda) throw new NotFoundException('Fazenda não encontrada');

    const [lancamentos, invernadas, animais, lavouras] = await Promise.all([
      this.prisma.financeiro.findMany({
        where: { fazendaId, ...(Object.keys(faixa).length ? { data: faixa } : {}) },
        select: { data: true, valor: true, tipo: true, categoria: true, custoLavouraId: true, lavouraId: true },
      }),
      this.prisma.invernada.findMany({
        where: { fazendaId },
        orderBy: { nome: 'asc' },
        select: { nome: true, area: true, _count: { select: { animais: { where: { status: 'ativo' } } } } },
      }),
      this.prisma.animal.findMany({ where: { fazendaId, status: 'ativo' }, select: { peso: true } }),
      this.prisma.lavoura.findMany({ where: { fazendaId }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, cultura: true, areaHa: true } }),
    ]);

    const pesos = animais.map((a) => a.peso).filter((p): p is number => typeof p === 'number' && p > 0);
    const pesoMedio = pesos.length ? pesos.reduce((s, p) => s + p, 0) / pesos.length : null;

    const soma = (filtro: (l: (typeof lancamentos)[number]) => boolean) =>
      Math.round(lancamentos.filter(filtro).reduce((s, l) => s + l.valor, 0) * 100) / 100;

    return {
      fazenda,
      periodo,
      geradoEm: new Date(),
      financeiro: agregarFinanceiro(lancamentos.map((l) => ({ data: l.data, valor: l.valor, tipo: l.tipo, categoria: l.categoria }))),
      rebanho: {
        ativos: animais.length,
        pesoMedioKg: pesoMedio === null ? null : Math.round(pesoMedio * 10) / 10,
        invernadas: invernadas.map((i) => ({
          nome: i.nome,
          areaHa: i.area,
          animais: i._count.animais,
          lotacao: lotacao(i._count.animais, i.area),
        })),
      },
      lavouras: lavouras.map((l) => {
        const custo = soma((x) => x.custoLavouraId === l.id && x.tipo === 'despesa');
        const receita = soma((x) => x.lavouraId === l.id && x.tipo === 'receita');
        return { nome: l.nome, cultura: l.cultura, areaHa: l.areaHa, custo, receita, resultado: Math.round((receita - custo) * 100) / 100 };
      }),
    };
  }

  async gerarPdf(fazendaId: string, usuarioId: string, inicio?: string, fim?: string) {
    const dados = await this.dados(fazendaId, usuarioId, inicio, fim);
    const buffer = await renderizarRelatorioPdf(dados);
    const slug = dados.fazenda.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return { buffer, filename: `relatorio-${slug || 'fazenda'}-${new Date().toISOString().slice(0, 10)}.pdf` };
  }
}
