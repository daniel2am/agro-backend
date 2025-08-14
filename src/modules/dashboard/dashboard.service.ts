// src/modules/dashboard/dashboard.service.ts
import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

type HistoricoItem = {
  tipo: string;
  descricao: string;
  data: Date;
  meta?: any;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getResumoDaFazenda(fazendaId: string) {
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

    const totalReceitas = totalReceitasAgg._sum.valor || 0;
    const totalDespesas = totalDespesasAgg._sum.valor || 0;
    const saldo = +(totalReceitas - totalDespesas).toFixed(2);
    const totalHectares = +(totalHectaresAgg._sum.areaHa || 0);

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

  private parseAnimalUpdate(acao: string): { brinco?: string; changes?: string[] } {
    try {
      // formato: "animal_atualizado brinco=XYZ id=... fazenda=... changes=a,b,c"
      const parts = acao.split(' ').slice(1);
      const map: Record<string, string> = {};
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k && v) map[k.trim()] = v.trim();
      }
      const brinco = map['brinco'];
      const changes = (map['changes'] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return { brinco, changes };
    } catch {
      return {};
    }
  }

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
    ] = await Promise.all([
      this.prisma.animal.findMany({
        where: { fazendaId },
        orderBy: { criadoEm: 'desc' },
        take: 2,
        select: {
          id: true,
          criadoEm: true,
          brinco: true,
          sexo: true,
          raca: true,
          idade: true,
          unidadeIdade: true,
          lote: true,
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
          id: true,
          data: true,
          tipo: true,
          observacao: true,
          animalId: true,
          animal: {
            select: {
              id: true,
              brinco: true,
              sexo: true,
              raca: true,
              idade: true,
              unidadeIdade: true,
              lote: true,
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
          id: true,
          criadoEm: true,
          tipo: true,
          observacoes: true,
          animalId: true,
          animal: {
            select: {
              id: true,
              brinco: true,
              sexo: true,
              raca: true,
              idade: true,
              unidadeIdade: true,
              lote: true,
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
          id: true,
          criadoEm: true,
          nome: true,
          dosagem: true,
          viaAplicacao: true,
          observacoes: true,
          proximaAplicacao: true,
          lembreteAtivo: true,
          animalId: true,
          animal: {
            select: {
              id: true,
              brinco: true,
              sexo: true,
              raca: true,
              idade: true,
              unidadeIdade: true,
              lote: true,
              invernada: { select: { nome: true } },
            },
          },
        },
      }),
    ]);

    const historico: HistoricoItem[] = [];

    // animal criado
    animais.forEach((a) =>
      historico.push({
        tipo: 'animal',
        descricao: `Animal ${a.brinco} cadastrado`,
        data: a.criadoEm,
        meta: {
          ids: { animalId: a.id },
          animal: {
            brinco: a.brinco,
            sexo: a.sexo,
            raca: a.raca,
            idade: a.idade,
            unidadeIdade: a.unidadeIdade,
            lote: a.lote,
            invernada: a.invernada?.nome ?? null,
          },
        },
      })
    );

    // lavoura
    lavouras.forEach((l) =>
      historico.push({
        tipo: 'lavoura',
        descricao: `Lavoura ${l.nome} (${(l.areaHa ?? 0).toFixed(2)} ha)`,
        data: l.criadoEm,
        meta: { ids: { lavouraId: l.id }, lavoura: { nome: l.nome, areaHa: l.areaHa, cultura: l.cultura } },
      })
    );

    // invernada
    invernadas.forEach((inv) =>
      historico.push({
        tipo: 'invernada',
        descricao: `Invernada ${inv.nome} (${(inv.area ?? 0).toFixed(2)} ha)`,
        data: inv.criadoEm,
        meta: { ids: { invernadaId: inv.id }, invernada: { nome: inv.nome, area: inv.area } },
      })
    );

    // manejo
    manejos.forEach((m) =>
      historico.push({
        tipo: 'manejo',
        descricao: `Manejo: ${m.tipo}`,
        data: m.data,
        meta: {
          ids: { manejoId: m.id, animalId: m.animalId },
          manejo: { tipo: m.tipo, observacao: m.observacao ?? null },
          animal: {
            brinco: m.animal?.brinco ?? null,
            sexo: m.animal?.sexo ?? null,
            raca: m.animal?.raca ?? null,
            idade: m.animal?.idade ?? null,
            unidadeIdade: m.animal?.unidadeIdade ?? null,
            lote: m.animal?.lote ?? null,
            invernada: m.animal?.invernada?.nome ?? null,
          },
        },
      })
    );

    // compra
    compras.forEach((c) =>
      historico.push({
        tipo: 'compra',
        descricao: `Compra de ${c.insumo}`,
        data: c.data,
        meta: {
          ids: { compraId: c.id },
          compra: {
            insumo: c.insumo,
            quantidade: c.quantidade,
            unidade: c.unidade,
            valor: c.valor,
            fornecedor: c.fornecedor ?? null,
          },
        },
      })
    );

    // PESAGENS com id e peso anterior
    const pesagens = await this.prisma.pesagem.findMany({
      where: { fazendaId },
      orderBy: { data: 'desc' },
      take: 2,
      select: {
        id: true,
        data: true,
        pesoKg: true,
        animalId: true,
        animal: {
          select: {
            id: true,
            brinco: true,
            sexo: true,
            raca: true,
            idade: true,
            unidadeIdade: true,
            lote: true,
            invernada: { select: { nome: true } },
          },
        },
      },
    });

    for (const p of pesagens) {
      const anterior = await this.prisma.pesagem.findFirst({
        where: { animalId: p.animalId, data: { lt: p.data } },
        orderBy: { data: 'desc' },
        select: { pesoKg: true, data: true },
      });

      historico.push({
        tipo: 'pesagem',
        descricao: `Pesagem registrada: ${p.pesoKg} kg`,
        data: p.data,
        meta: {
          ids: { pesagemId: p.id, animalId: p.animalId },
          animal: {
            brinco: p.animal?.brinco ?? null,
            sexo: p.animal?.sexo ?? null,
            raca: p.animal?.raca ?? null,
            idade: p.animal?.idade ?? null,
            unidadeIdade: p.animal?.unidadeIdade ?? null,
            lote: p.animal?.lote ?? null,
            invernada: p.animal?.invernada?.nome ?? null,
            pesoAtual: p.pesoKg,
            pesoAnterior: anterior?.pesoKg ?? null,
            dataAnterior: anterior?.data ?? null,
          },
        },
      });
    }

    // financeiro
    financeiros.forEach((f) =>
      historico.push({
        tipo: 'financeiro',
        descricao: `Lançamento ${f.tipo}: ${f.descricao}`,
        data: f.data,
        meta: { ids: { financeiroId: f.id }, financeiro: { descricao: f.descricao, tipo: f.tipo, valor: f.valor } },
      })
    );

    // sanidade
    sanidades.forEach((s) =>
      historico.push({
        tipo: 'sanidade',
        descricao: `Sanidade: ${s.tipo}`,
        data: s.criadoEm,
        meta: {
          ids: { sanidadeId: s.id, animalId: s.animalId },
          sanidade: { tipo: s.tipo, observacoes: s.observacoes ?? null },
          animal: {
            brinco: s.animal?.brinco ?? null,
            sexo: s.animal?.sexo ?? null,
            raca: s.animal?.raca ?? null,
            idade: s.animal?.idade ?? null,
            unidadeIdade: s.animal?.unidadeIdade ?? null,
            lote: s.animal?.lote ?? null,
            invernada: s.animal?.invernada?.nome ?? null,
          },
        },
      })
    );

    // medicamento
    medicamentos.forEach((m) =>
      historico.push({
        tipo: 'medicamento',
        descricao: `Medicamento: ${m.nome}`,
        data: m.criadoEm,
        meta: {
          ids: { medicamentoId: m.id, animalId: m.animalId },
          medicamento: {
            nome: m.nome,
            dosagem: m.dosagem ?? null,
            viaAplicacao: m.viaAplicacao ?? null,
            observacoes: m.observacoes ?? null,
            proximaAplicacao: m.proximaAplicacao ?? null,
            lembreteAtivo: m.lembreteAtivo ?? false,
          },
          animal: {
            brinco: m.animal?.brinco ?? null,
            sexo: m.animal?.sexo ?? null,
            raca: m.animal?.raca ?? null,
            idade: m.animal?.idade ?? null,
            unidadeIdade: m.animal?.unidadeIdade ?? null,
            lote: m.animal?.lote ?? null,
            invernada: m.animal?.invernada?.nome ?? null,
          },
        },
      })
    );

    // logs de atualização do animal
    const logs = await this.prisma.logAcesso.findMany({
      where: { usuarioId, acao: { startsWith: 'animal_atualizado ' } },
      orderBy: { data: 'desc' },
      take: 8,
      select: { data: true, acao: true },
    });

    for (const log of logs) {
      const info = this.parseAnimalUpdate(log.acao);
      if (!info.brinco) continue;

      const a = await this.prisma.animal.findFirst({
        where: { brinco: info.brinco, fazendaId },
        include: { invernada: true },
      });
      if (!a) continue;

      historico.push({
        tipo: 'animal_atualizado',
        descricao: `Animal ${a.brinco} atualizado`,
        data: log.data ?? new Date(),
        meta: {
          ids: { animalId: a.id },
          animal: {
            brinco: a.brinco,
            sexo: a.sexo,
            raca: a.raca,
            idade: a.idade,
            unidadeIdade: a.unidadeIdade,
            peso: a.peso,
            lote: a.lote,
            invernada: a.invernada?.nome ?? null,
          },
          changes: info.changes ?? [],
        },
      });
    }

    historico.sort((a, b) => b.data.getTime() - a.data.getTime());
    return historico.slice(0, 6);
  }

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