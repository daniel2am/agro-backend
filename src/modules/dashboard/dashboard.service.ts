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

  // ===== Resumo do topo =====
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
      notificacoes: totalNotificacoes, // redundância pró-front
    };
  }

  // ===== Helpers: parse de logs =====
  // Captura pares k=v no texto do log (ex.: brinco=123 changes=Peso,Nome)
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

    // animal
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

    // manejo
    if (acao.startsWith('manejo_criado')) return { tipo: 'log', descricao: '🧰 Criou manejo' };
    if (acao.startsWith('manejo_atualizado')) return { tipo: 'log', descricao: '✏️ Atualizou manejo', meta: { changes } };
    if (acao.startsWith('manejo_excluido')) return { tipo: 'log', descricao: '🗑️ Excluiu manejo' };

    // sanidade
    if (acao.startsWith('sanidade_criada')) return { tipo: 'log', descricao: '🩺 Criou sanidade' };
    if (acao.startsWith('sanidade_atualizada')) return { tipo: 'log', descricao: '✏️ Atualizou sanidade', meta: { changes } };
    if (acao.startsWith('sanidade_excluida')) return { tipo: 'log', descricao: '🗑️ Excluiu sanidade' };

    // medicamento
    if (acao.startsWith('medicamento_criado')) return { tipo: 'log', descricao: '💊 Criou medicamento' };
    if (acao.startsWith('medicamento_atualizado')) return { tipo: 'log', descricao: '✏️ Atualizou medicamento', meta: { changes } };
    if (acao.startsWith('medicamento_excluido')) return { tipo: 'log', descricao: '🗑️ Excluiu medicamento' };

    // lavoura
    if (acao.startsWith('lavoura_criada')) return { tipo: 'log', descricao: '🌱 Criou lavoura' };
    if (acao.startsWith('lavoura_atualizada')) return { tipo: 'log', descricao: '✏️ Atualizou lavoura', meta: { changes } };
    if (acao.startsWith('lavoura_excluida')) return { tipo: 'log', descricao: '🗑️ Excluiu lavoura' };

    // invernada
    if (acao.startsWith('invernada_criada')) return { tipo: 'log', descricao: '🌾 Criou invernada' };
    if (acao.startsWith('invernada_atualizada')) return { tipo: 'log', descricao: '✏️ Atualizou invernada', meta: { changes } };
    if (acao.startsWith('invernada_excluida')) return { tipo: 'log', descricao: '🗑️ Excluiu invernada' };

    // compra-insumo (aceita os dois formatos de prefixo)
    if (acao.startsWith('compra_criada') || acao.startsWith('compra_insumo_criada'))
      return { tipo: 'log', descricao: '🧾 Criou compra de insumo' };
    if (acao.startsWith('compra_atualizada') || acao.startsWith('compra_insumo_atualizada'))
      return { tipo: 'log', descricao: '✏️ Atualizou compra de insumo', meta: { changes } };
    if (acao.startsWith('compra_excluida') || acao.startsWith('compra_insumo_excluida'))
      return { tipo: 'log', descricao: '🗑️ Excluiu compra de insumo' };

    // financeiro
    if (acao.startsWith('financeiro_criado')) return { tipo: 'log', descricao: '💰 Criou lançamento financeiro' };
    if (acao.startsWith('financeiro_atualizado')) return { tipo: 'log', descricao: '✏️ Atualizou lançamento financeiro', meta: { changes } };
    if (acao.startsWith('financeiro_excluido')) return { tipo: 'log', descricao: '🗑️ Excluiu lançamento financeiro' };

    // ocorrencia (adicionado)
    if (acao.startsWith('ocorrencia_criada')) return { tipo: 'ocorrencia', descricao: '📝 Criou ocorrência' };
    if (acao.startsWith('ocorrencia_atualizada')) return { tipo: 'ocorrencia', descricao: '✏️ Atualizou ocorrência', meta: { changes } };
    if (acao.startsWith('ocorrencia_excluida')) return { tipo: 'ocorrencia', descricao: '🗑️ Excluiu ocorrência' };

    // fallback
    return { tipo: 'log', descricao: acao };
  }

  // ===== Histórico unificado =====
  async getHistoricoRecentes(fazendaId: string, usuarioId: string) {
    // acesso
    const fazenda = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
    });
    if (!fazenda) throw new ForbiddenException('Acesso negado à fazenda');

    // blocos base (2 de cada)
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
      // 👇 NOVO: Ocorrências
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

    // animal
    for (const a of animais) {
      historico.push({
        tipo: 'animal',
        descricao: `Animal ${a.brinco} cadastrado`,
        data: a.criadoEm,
        meta: {
          ids: { animalId: a.id },
          animal: {
            brinco: a.brinco, sexo: a.sexo, raca: a.raca, idade: a.idade, unidadeIdade: a.unidadeIdade,
            lote: a.lote, invernada: a.invernada?.nome ?? null,
          },
        },
      });
    }

    // lavoura
    for (const l of lavouras) {
      historico.push({
        tipo: 'lavoura',
        descricao: `Lavoura ${l.nome} (${(l.areaHa ?? 0).toFixed(2)} ha)`,
        data: l.criadoEm,
        meta: { ids: { lavouraId: l.id }, lavoura: { nome: l.nome, areaHa: l.areaHa, cultura: l.cultura } },
      });
    }

    // invernada
    for (const inv of invernadas) {
      historico.push({
        tipo: 'invernada',
        descricao: `Invernada ${inv.nome} (${(inv.area ?? 0).toFixed(2)} ha)`,
        data: inv.criadoEm,
        meta: { ids: { invernadaId: inv.id }, invernada: { nome: inv.nome, area: inv.area } },
      });
    }

    // manejo
    for (const m of manejos) {
      historico.push({
        tipo: 'manejo',
        descricao: `Manejo: ${m.tipo}`,
        data: m.data,
        meta: {
          ids: { manejoId: m.id, animalId: m.animalId },
          manejo: { tipo: m.tipo, observacao: m.observacao ?? null },
          animal: {
            brinco: m.animal?.brinco ?? null, sexo: m.animal?.sexo ?? null, raca: m.animal?.raca ?? null,
            idade: m.animal?.idade ?? null, unidadeIdade: m.animal?.unidadeIdade ?? null, lote: m.animal?.lote ?? null,
            invernada: m.animal?.invernada?.nome ?? null,
          },
        },
      });
    }

    // compra
    for (const c of compras) {
      historico.push({
        tipo: 'compra',
        descricao: `Compra de ${c.insumo}`,
        data: c.data,
        meta: {
          ids: { compraId: c.id },
          compra: { insumo: c.insumo, quantidade: c.quantidade, unidade: c.unidade, valor: c.valor, fornecedor: c.fornecedor ?? null },
        },
      });
    }

    // pesagens com peso anterior
    const pesagens = await this.prisma.pesagem.findMany({
      where: { fazendaId },
      orderBy: { data: 'desc' },
      take: 2,
      select: {
        id: true, data: true, pesoKg: true, animalId: true,
        animal: {
          select: {
            id: true, brinco: true, sexo: true, raca: true, idade: true, unidadeIdade: true, lote: true,
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
            brinco: p.animal?.brinco ?? null, sexo: p.animal?.sexo ?? null, raca: p.animal?.raca ?? null,
            idade: p.animal?.idade ?? null, unidadeIdade: p.animal?.unidadeIdade ?? null, lote: p.animal?.lote ?? null,
            invernada: p.animal?.invernada?.nome ?? null,
            pesoAtual: p.pesoKg, pesoAnterior: anterior?.pesoKg ?? null, dataAnterior: anterior?.data ?? null,
          },
        },
      });
    }

    // financeiro
    for (const f of financeiros) {
      historico.push({
        tipo: 'financeiro',
        descricao: `Lançamento ${f.tipo}: ${f.descricao}`,
        data: f.data,
        meta: { ids: { financeiroId: f.id }, financeiro: { descricao: f.descricao, tipo: f.tipo, valor: f.valor } },
      });
    }

    // sanidade
    for (const s of sanidades) {
      historico.push({
        tipo: 'sanidade',
        descricao: `Sanidade: ${s.tipo}`,
        data: s.criadoEm,
        meta: {
          ids: { sanidadeId: s.id, animalId: s.animalId },
          sanidade: { tipo: s.tipo, observacoes: s.observacoes ?? null },
          animal: {
            brinco: s.animal?.brinco ?? null, sexo: s.animal?.sexo ?? null, raca: s.animal?.raca ?? null,
            idade: s.animal?.idade ?? null, unidadeIdade: s.animal?.unidadeIdade ?? null, lote: s.animal?.lote ?? null,
            invernada: s.animal?.invernada?.nome ?? null,
          },
        },
      });
    }

    // medicamento
    for (const m of medicamentos) {
      historico.push({
        tipo: 'medicamento',
        descricao: `Medicamento: ${m.nome}`,
        data: m.criadoEm,
        meta: {
          ids: { medicamentoId: m.id, animalId: m.animalId },
          medicamento: {
            nome: m.nome, dosagem: m.dosagem ?? null, viaAplicacao: m.viaAplicacao ?? null,
            observacoes: m.observacoes ?? null, proximaAplicacao: m.proximaAplicacao ?? null, lembreteAtivo: m.lembreteAtivo ?? false,
          },
          animal: {
            brinco: m.animal?.brinco ?? null, sexo: m.animal?.sexo ?? null, raca: m.animal?.raca ?? null,
            idade: m.animal?.idade ?? null, unidadeIdade: m.animal?.unidadeIdade ?? null, lote: m.animal?.lote ?? null,
            invernada: m.animal?.invernada?.nome ?? null,
          },
        },
      });
    }

    // 👇 NOVO: ocorrências (base)
    for (const o of ocorrencias) {
      historico.push({
        tipo: 'ocorrencia',
        descricao: `Ocorrência: ${o.titulo}`,
        data: o.data,
        meta: {
          ids: { ocorrenciaId: o.id, animalId: o.animalId ?? undefined },
          ocorrencia: { titulo: o.titulo, tipo: o.tipo ?? null, descricao: o.descricao ?? null },
          animal: o.animal
            ? {
                brinco: o.animal?.brinco ?? null, sexo: o.animal?.sexo ?? null, raca: o.animal?.raca ?? null,
                idade: o.animal?.idade ?? null, unidadeIdade: o.animal?.unidadeIdade ?? null, lote: o.animal?.lote ?? null,
                invernada: o.animal?.invernada?.nome ?? null,
              }
            : undefined,
        },
      });
    }

    // logs do usuário (enriquece com meta/changes; inclui ocorrências e compras)
    const logs = await this.prisma.logAcesso.findMany({
      where: { usuarioId },
      orderBy: { data: 'desc' },
      take: 15,
      select: { data: true, acao: true },
    });

    for (const l of logs) {
      const norm = this.normalizaLog(l.acao);
      historico.push({
        tipo: norm.tipo,
        descricao: norm.descricao,
        data: l.data ?? new Date(),
        meta: norm.meta,
      });

      // enriquecer "animal_atualizado" com dados atuais do animal (via brinco)
      if (norm.tipo === 'animal_atualizado' && norm.meta?.animal?.brinco) {
        const brinco = norm.meta.animal.brinco as string;
        const a = await this.prisma.animal.findFirst({
          where: { brinco, fazendaId },
          include: { invernada: true },
        });
        if (a) {
          historico[historico.length - 1].meta = {
            ...(historico[historico.length - 1].meta || {}),
            ids: { ...(historico[historico.length - 1].meta?.ids || {}), animalId: a.id },
            animal: {
              brinco: a.brinco, sexo: a.sexo, raca: a.raca, idade: a.idade, unidadeIdade: a.unidadeIdade,
              peso: a.peso, lote: a.lote, invernada: a.invernada?.nome ?? null,
            },
          };
        }
      }
    }

    // ordena/limita
    historico.sort((a, b) => b.data.getTime() - a.data.getTime());
    return historico.slice(0, 6);
  }

  // ===== Indicadores (peso / financeiro) =====
  async getIndicadores(fazendaId: string, tipo: 'peso' | 'financeiro', usuarioId: string) {
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
        {} as Record<string, { soma: number; qtd: number }>,
      );

      const resultado = Object.entries(dadosAgrupados).map(([mesAno, { soma, qtd }]) => ({
        data: mesAno,
        valor: +(soma / qtd).toFixed(2),
      }));

      return { labels: resultado.map((r) => r.data), datasets: [{ data: resultado.map((r) => r.valor) }] };
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
        {} as Record<string, { receita: number; despesa: number }>,
      );

      const resultado = Object.entries(dadosAgrupados).map(([mesAno, { receita, despesa }]) => ({
        data: mesAno,
        valor: +(receita - despesa).toFixed(2),
      }));

      return { labels: resultado.map((r) => r.data), datasets: [{ data: resultado.map((r) => r.valor) }] };
    }

    throw new BadRequestException('Tipo inválido');
  }
}