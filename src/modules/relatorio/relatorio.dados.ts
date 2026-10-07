// src/modules/relatorio/relatorio.dados.ts
// Agregações puras do relatório (sem banco, sem PDF): fáceis de testar.

import { rotuloCategoria } from '../financeiro/categorias';

export interface LancamentoRel {
  data: Date;
  valor: number;
  tipo: 'receita' | 'despesa';
  categoria: string | null;
}

export interface LinhaCategoria {
  rotulo: string;
  total: number;
  pct: number;
}

export interface LinhaMensal {
  mes: string; // AAAA-MM
  receitas: number;
  despesas: number;
  saldo: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function agrupar(lancs: LancamentoRel[], tipo: 'receita' | 'despesa'): LinhaCategoria[] {
  const mapa = new Map<string, number>();
  let soma = 0;
  for (const l of lancs) {
    if (l.tipo !== tipo) continue;
    const rotulo = rotuloCategoria(l.categoria, tipo);
    mapa.set(rotulo, (mapa.get(rotulo) ?? 0) + l.valor);
    soma += l.valor;
  }
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([rotulo, total]) => ({ rotulo, total: r2(total), pct: soma > 0 ? Math.round((total / soma) * 1000) / 10 : 0 }));
}

export function agregarFinanceiro(lancs: LancamentoRel[]) {
  let receitas = 0;
  let despesas = 0;
  const meses = new Map<string, LinhaMensal>();

  for (const l of lancs) {
    const mes = `${l.data.getUTCFullYear()}-${String(l.data.getUTCMonth() + 1).padStart(2, '0')}`;
    const m = meses.get(mes) ?? { mes, receitas: 0, despesas: 0, saldo: 0 };
    if (l.tipo === 'receita') {
      receitas += l.valor;
      m.receitas += l.valor;
    } else {
      despesas += l.valor;
      m.despesas += l.valor;
    }
    meses.set(mes, m);
  }

  const saldo = receitas - despesas;
  return {
    receitas: r2(receitas),
    despesas: r2(despesas),
    saldo: r2(saldo),
    margemPct: receitas > 0 ? Math.round((saldo / receitas) * 1000) / 10 : null,
    despesasPorCategoria: agrupar(lancs, 'despesa'),
    receitasPorCategoria: agrupar(lancs, 'receita'),
    mensal: [...meses.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((m) => ({ ...m, receitas: r2(m.receitas), despesas: r2(m.despesas), saldo: r2(m.receitas - m.despesas) })),
  };
}

export interface InvernadaRel {
  nome: string;
  areaHa: number;
  animais: number;
}

/** Animais por hectare; null quando a área é desconhecida. */
export function lotacao(animais: number, areaHa: number): number | null {
  return areaHa > 0 ? Math.round((animais / areaHa) * 100) / 100 : null;
}

export interface RelatorioDados {
  fazenda: { nome: string; cidade: string; estado: string; areaTotal: number | null };
  periodo: { inicio: Date | null; fim: Date | null };
  geradoEm: Date;
  financeiro: ReturnType<typeof agregarFinanceiro>;
  rebanho: { ativos: number; pesoMedioKg: number | null; invernadas: (InvernadaRel & { lotacao: number | null })[] };
  lavouras: { nome: string; cultura: string; areaHa: number; custo: number; receita: number; resultado: number }[];
}
