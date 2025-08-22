// src/modules/dashboard/dashboard.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { GroupBy, IndicadoresFiltro, IndicadoresResposta, TipoIndicador } from './dto/indicadores.dto';

type HistoricoItem = {
  tipo: string;
  descricao: string;
  data: Date;
  meta?: any;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================
  // ================ RESUMO (versão premium) ================
  // =========================================================
  async getResumoDaFazenda(fazendaId: string, usuarioId: string) {
    // 1) Check de acesso
    const acesso = await this.prisma.fazendaUsuario.findFirst({
      where: { fazendaId, usuarioId },
      select: { id: true },
    });
    if (!acesso) throw new ForbiddenException('Acesso negado à fazenda');

    // 2) Intervalos auxiliares (últimos 7 dias)
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje);
    seteDiasAtras.setDate(hoje.getDate() - 7);

    // 3) Coletas paralelas
    const [
      totalAnimais,
      totalReceitasAgg,
      totalDespesasAgg,
      totalNotificacoes,
      totalHectaresAgg,
      novosAnimais7d,
      novosLancamentos7d,
      novasOcorrencias7d,
    ] = await Promise.all([
      this.prisma.animal.count({ where: { fazendaId } }),
      this.prisma.financeiro.aggregate({ where: { fazendaId, tipo: 'receita' }, _sum: { valor: true } }),
      this.prisma.financeiro.aggregate({ where: { fazendaId, tipo: 'despesa' }, _sum: { valor: true } }),
      this.prisma.ocorrencia.count({ where: { fazendaId } }).catch(() => 0),
      this.prisma.lavoura.aggregate({ where: { fazendaId }, _sum: { areaHa: true } }),
      this.prisma.animal.count({ where: { fazendaId, criadoEm: { gte: seteDiasAtras, lte: hoje } } }),
      this.prisma.financeiro.count({ where: { fazendaId, data: { gte: seteDiasAtras, lte: hoje } } }),
      this.prisma.ocorrencia.count({ where: { fazendaId, data: { gte: seteDiasAtras, lte: hoje } } }).catch(() => 0),
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
      ultimos7d: {
        novosAnimais: novosAnimais7d,
        novosLancamentosFinanceiros: novosLancamentos7d,
        novasOcorrencias: novasOcorrencias7d,
      },
    };
  }

  // =========================================================
  // ========= HISTÓRICO ENRIQUECIDO (versão premium) =========
  // =========================================================

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

    // compra-insumo
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

    // ocorrência
    if (acao.startsWith('ocorrencia_criada')) return { tipo: 'ocorrencia', descricao: '📝 Criou ocorrência' };
    if (acao.startsWith('ocorrencia_atualizada')) return { tipo: 'ocorrencia', descricao: '✏️ Atualizou ocorrência', meta: { changes } };
    if (acao.startsWith('ocorrencia_excluida')) return { tipo: 'ocorrencia', descricao: '🗑️ Excluiu ocorrência' };

    // fallback
    return { tipo: 'log', descricao: acao };
  }

  async getHistoricoRecentes(fazendaId: string, usuarioId: string) {
    const acesso = await this.prisma.fazendaUsuario.findFirst({
      where: { fazendaId, usuarioId },
      select: { id: true },
    });
    if (!acesso) throw new ForbiddenException('Acesso negado à fazenda');

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

    // animais
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

    // lavouras
    for (const l of lavouras) {
      historico.push({
        tipo: 'lavoura',
        descricao: `Lavoura ${l.nome} (${(l.areaHa ?? 0).toFixed(2)} ha)`,
        data: l.criadoEm,
        meta: { ids: { lavouraId: l.id }, lavoura: { nome: l.nome, areaHa: l.areaHa, cultura: l.cultura } },
      });
    }

    // invernadas
    for (const inv of invernadas) {
      historico.push({
        tipo: 'invernada',
        descricao: `Invernada ${inv.nome} (${(inv.area ?? 0).toFixed(2)} ha)`,
        data: inv.criadoEm,
        meta: { ids: { invernadaId: inv.id }, invernada: { nome: inv.nome, area: inv.area } },
      });
    }

    // manejos
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

    // compras de insumo
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

    // pesagens (com “peso anterior” por animal)
    const pesagens = await this.prisma.pesagem.findMany({
      where: { fazendaId }, // se a tabela pesagem não tiver fazendaId, remova e filtre via join de animal
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

    // ocorrências
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

    // LOGS do usuário (apenas da fazenda atual)
    const logs = await this.prisma.logAcesso.findMany({
      where: { usuarioId },
      orderBy: { data: 'desc' },
      take: 20,
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

      if (norm.tipo === 'animal_atualizado' && norm.meta?.animal?.brinco) {
        const brinco = norm.meta.animal.brinco as string;
        const a = await this.prisma.animal.findFirst({
          where: { brinco, fazendaId },
          include: { invernada: true },
        });
        if (a) {
          const last = historico[historico.length - 1];
          last.meta = {
            ...(last.meta || {}),
            ids: { ...(last.meta?.ids || {}), animalId: a.id },
            animal: {
              brinco: a.brinco, sexo: a.sexo, raca: a.raca, idade: a.idade, unidadeIdade: a.unidadeIdade,
              peso: a.peso, lote: a.lote, invernada: a.invernada?.nome ?? null,
            },
          };
        }
      }
    }

    historico.sort((a, b) => b.data.getTime() - a.data.getTime());
    return historico.slice(0, 6);
  }

  // =========================================================
  // ================== INDICADORES (premium) =================
  // =========================================================

  async getIndicadores(
    fazendaId: string,
    tipo: TipoIndicador,
    usuarioId: string,
    filtro: IndicadoresFiltro,
  ): Promise<IndicadoresResposta> {
    // 1) Segurança
    const acesso = await this.prisma.fazendaUsuario.findFirst({
      where: { fazendaId, usuarioId },
      select: { id: true },
    });
    if (!acesso) throw new ForbiddenException('Acesso negado à fazenda');

    // 2) Datas (aceita Date ou string ISO)
    const from = new Date((filtro as any).from);
    const to = new Date((filtro as any).to);
    if (isNaN(from.getTime())) throw new BadRequestException('from inválido');
    if (isNaN(to.getTime())) throw new BadRequestException('to inválido');
    if (from > to) throw new BadRequestException('Range de datas inválido (from > to)');

    // 3) GroupBy (legado 'animal' -> month)
    const rawGb = (filtro as any)?.groupBy;
    const groupBy: GroupBy = rawGb === 'animal' ? GroupBy.month : (filtro.groupBy ?? GroupBy.month);

    if (tipo === 'peso') {
      return this.buildIndicadorPeso(fazendaId, { ...filtro, from, to }, groupBy);
    }
    if (tipo === 'financeiro') {
      return this.buildIndicadorFinanceiro(fazendaId, { ...filtro, from, to }, groupBy);
    }
    throw new BadRequestException('Tipo inválido');
  }

  // ---------- Helpers de bucketing ----------
  private keyForBucket(d: Date, gb: GroupBy): string {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();

    if (gb === GroupBy.day) {
      return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
    if (gb === GroupBy.quarter) {
      const q = Math.floor((m - 1) / 3) + 1;
      return `${y}-Q${q}`;
    }
    return `${y}-${String(m).padStart(2, '0')}`; // month
  }

  private sortBucketLabels(labels: string[], gb: GroupBy): string[] {
    if (gb === GroupBy.day) {
      return labels.sort((a, b) => +new Date(a) - +new Date(b));
    }
    if (gb === GroupBy.quarter) {
      return labels.sort((a, b) => {
        const [ya, qa] = a.split('-Q').map(Number);
        const [yb, qb] = b.split('-Q').map(Number);
        return ya === yb ? qa - qb : ya - yb;
      });
    }
    return labels.sort((a, b) => {
      const [ya, ma] = a.split('-').map(Number);
      const [yb, mb] = b.split('-').map(Number);
      return ya === yb ? ma - mb : ya - yb;
    });
  }

  private invernadaAndAnimalsFilter(fazendaId: string, invernadaId?: string, animalIds?: string[]) {
    const animalWhere: any = { fazendaId };
    if (invernadaId) animalWhere.invernadaId = invernadaId;
    if (animalIds && animalIds.length > 0) animalWhere.id = { in: animalIds };
    return { animal: { is: animalWhere } };
  }

  // ---------- Indicador de PESO ----------
  private async buildIndicadorPeso(
    fazendaId: string,
    filtro: IndicadoresFiltro,
    groupBy: GroupBy,
  ): Promise<IndicadoresResposta> {
    const where: any = {
      data: { gte: filtro.from, lte: filtro.to },
      fazendaId, // remova se pesagem não tiver fazendaId na sua schema
    };
    Object.assign(where, this.invernadaAndAnimalsFilter(fazendaId, filtro.invernadaId, filtro.animalIds));

    const pesagens = await this.prisma.pesagem.findMany({
      where,
      orderBy: { data: 'asc' },
      select: {
        data: true,
        pesoKg: true,
        animalId: true,
        animal: { select: { id: true } },
      },
    });

    const buckets: Record<string, { soma: number; qtd: number }> = {};
    for (const p of pesagens) {
      const k = this.keyForBucket(p.data, groupBy);
      if (!buckets[k]) buckets[k] = { soma: 0, qtd: 0 };
      buckets[k].soma += p.pesoKg || 0;
      buckets[k].qtd += 1;
    }

    const labels = this.sortBucketLabels(Object.keys(buckets), groupBy);
    const data = labels.map((k) => {
      const { soma, qtd } = buckets[k];
      return qtd > 0 ? +(soma / qtd).toFixed(2) : 0;
    });

    return { labels, datasets: [{ label: 'Peso médio (kg)', data }] };
  }

  // ---------- Indicador FINANCEIRO ----------
  private async buildIndicadorFinanceiro(
    fazendaId: string,
    filtro: IndicadoresFiltro,
    groupBy: GroupBy,
  ): Promise<IndicadoresResposta> {
    const where: any = {
      fazendaId,
      data: { gte: filtro.from, lte: filtro.to },
    };

    const lancamentos = await this.prisma.financeiro.findMany({
      where,
      orderBy: { data: 'asc' },
      select: { data: true, tipo: true, valor: true },
    });

    const buckets: Record<string, { receita: number; despesa: number }> = {};
    for (const l of lancamentos) {
      const k = this.keyForBucket(l.data, groupBy);
      if (!buckets[k]) buckets[k] = { receita: 0, despesa: 0 };
      if (l.tipo === 'receita') buckets[k].receita += Number(l.valor) || 0;
      else buckets[k].despesa += Number(l.valor) || 0;
    }

    const labels = this.sortBucketLabels(Object.keys(buckets), groupBy);

    const natureza = (filtro as any).natureza ?? 'saldo';
    if (natureza === 'receita') {
      const data = labels.map((k) => +(buckets[k]?.receita ?? 0));
      return { labels, datasets: [{ label: 'Receitas', data }] };
    }
    if (natureza === 'despesa') {
      const data = labels.map((k) => +(buckets[k]?.despesa ?? 0));
      return { labels, datasets: [{ label: 'Despesas', data }] };
    }

    const data = labels.map((k) => +((buckets[k]?.receita ?? 0) - (buckets[k]?.despesa ?? 0)).toFixed(2));
    return { labels, datasets: [{ label: 'Saldo', data }] };
  }
}