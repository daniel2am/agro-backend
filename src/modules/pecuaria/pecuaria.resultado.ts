// Custo da arroba e ponto de equilíbrio da pecuária. Lógica pura (sem banco).
//
// Convenções (todas visíveis no resultado para o produtor poder contestar):
//  - Arroba de carcaça = 15 kg; carcaça = peso vivo × rendimento (padrão 52%).
//  - Arrobas PRODUZIDAS vêm do ganho de peso medido nas pesagens do período
//    (última − primeira de cada animal com 2+ pesagens), não do peso total.
//  - Custo OPERACIONAL = o que mantém o gado (ração, sanidade, mão de obra…),
//    SEM a compra de animais e SEM o que é da lavoura.
//  - Custos "gerais" (mão de obra, energia, combustível…) em fazenda mista são
//    rateados por `rateioGeraisPct` entre pecuária e lavoura.

export const KG_POR_ARROBA = 15;
export const RENDIMENTO_PADRAO_PCT = 52;

/** Despesas que são, por natureza, da pecuária. */
export const CATEGORIAS_DIRETAS = ['racao', 'sanidade'] as const;
/** Despesas que servem à fazenda toda: entram rateadas. */
export const CATEGORIAS_GERAIS = [
  'mao_de_obra',
  'manutencao',
  'energia',
  'combustivel',
  'frete',
  'arrendamento',
  'impostos',
  'outros_despesa',
] as const;
/** Despesas de lavoura: ficam de fora. 'compra_animais' é tratada à parte. */
export const CATEGORIAS_DA_LAVOURA = ['insumos', 'sementes'] as const;

export interface DespesaEntrada {
  categoria: string | null;
  valor: number;
  /** Despesa alocada a uma lavoura (custo da safra) → não é da pecuária. */
  custoLavouraId?: string | null;
}

export interface PesagemEntrada {
  animalId: string;
  data: Date;
  pesoKg: number;
}

export interface VendaEntrada {
  valor: number;
  data: Date;
  animalId: string;
  /** Peso conhecido do animal (a última pesagem até a venda ou o peso cadastrado). */
  pesoKg: number | null;
}

export interface EntradaResultado {
  despesas: DespesaEntrada[];
  pesagens: PesagemEntrada[];
  vendas: VendaEntrada[];
  animaisAtivos: number;
  rendimentoPct?: number;
  /** % dos custos gerais atribuída à pecuária (0–100). */
  rateioGeraisPct: number;
}

export interface ResultadoPecuaria {
  premissas: { rendimentoPct: number; rateioGeraisPct: number; kgPorArroba: number };
  cobertura: { animaisPesados: number; animaisAtivos: number };
  producao: { ganhoKg: number; arrobasProduzidas: number };
  custos: {
    racao: number;
    sanidade: number;
    geraisBrutos: number;
    geraisRateados: number;
    operacional: number;
    compraAnimais: number;
  };
  /** R$ por arroba produzida (custo operacional ÷ arrobas). null = sem pesagens suficientes. */
  custoPorArroba: number | null;
  vendas: {
    cabecas: number;
    cabecasComPeso: number;
    receita: number;
    arrobasVendidas: number;
    /** R$/@ médio, só sobre as vendas com peso conhecido. */
    precoMedioArroba: number | null;
  };
  resultado: {
    /** Receita de vendas − custo operacional − compra de animais. */
    liquido: number;
    /** Margem por arroba vendida (preço médio − custo por arroba). */
    margemPorArroba: number | null;
  };
  /** Preço mínimo da arroba para cobrir o custo operacional (= custo por arroba). */
  pontoEquilibrio: { precoMinimoArroba: number | null };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const soma = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

const ehDa = (lista: readonly string[], cat: string | null) => !!cat && lista.includes(cat);

export function calcularResultadoPecuaria(e: EntradaResultado): ResultadoPecuaria {
  const rendimentoPct = e.rendimentoPct ?? RENDIMENTO_PADRAO_PCT;
  const rateio = Math.min(100, Math.max(0, e.rateioGeraisPct));
  const arrobaDe = (kgVivo: number) => (kgVivo * (rendimentoPct / 100)) / KG_POR_ARROBA;

  // ---- custos (despesas de lavoura saem; compra de animais é separada)
  const daPecuaria = e.despesas.filter((d) => !d.custoLavouraId && !ehDa(CATEGORIAS_DA_LAVOURA, d.categoria));
  const racao = soma(daPecuaria.filter((d) => d.categoria === 'racao').map((d) => d.valor));
  const sanidade = soma(daPecuaria.filter((d) => d.categoria === 'sanidade').map((d) => d.valor));
  const compraAnimais = soma(daPecuaria.filter((d) => d.categoria === 'compra_animais').map((d) => d.valor));
  // sem categoria também é custo geral: melhor ratear do que sumir com o gasto
  const geraisBrutos = soma(
    daPecuaria.filter((d) => ehDa(CATEGORIAS_GERAIS, d.categoria) || !d.categoria).map((d) => d.valor),
  );
  const geraisRateados = geraisBrutos * (rateio / 100);
  const operacional = racao + sanidade + geraisRateados;

  // ---- produção: ganho de peso por animal dentro do período
  const porAnimal = new Map<string, PesagemEntrada[]>();
  for (const p of e.pesagens) {
    if (!(p.pesoKg > 0)) continue;
    (porAnimal.get(p.animalId) ?? porAnimal.set(p.animalId, []).get(p.animalId)!).push(p);
  }
  let ganhoKg = 0;
  let animaisPesados = 0;
  for (const lista of porAnimal.values()) {
    if (lista.length < 2) continue;
    const ord = [...lista].sort((a, b) => a.data.getTime() - b.data.getTime());
    const dias = (ord[ord.length - 1]!.data.getTime() - ord[0]!.data.getTime()) / 86_400_000;
    if (dias < 1) continue;
    animaisPesados++;
    // perda de peso entra negativa: esconder reduziria a verdade do número
    ganhoKg += ord[ord.length - 1]!.pesoKg - ord[0]!.pesoKg;
  }
  const arrobasProduzidas = ganhoKg > 0 ? arrobaDe(ganhoKg) : 0;
  const custoPorArroba = arrobasProduzidas > 0 ? operacional / arrobasProduzidas : null;

  // ---- vendas
  const comPeso = e.vendas.filter((v) => v.pesoKg !== null && v.pesoKg > 0);
  const receita = soma(e.vendas.map((v) => v.valor));
  const receitaComPeso = soma(comPeso.map((v) => v.valor));
  const arrobasVendidas = soma(comPeso.map((v) => arrobaDe(v.pesoKg as number)));
  const precoMedioArroba = arrobasVendidas > 0 ? receitaComPeso / arrobasVendidas : null;

  return {
    premissas: { rendimentoPct, rateioGeraisPct: rateio, kgPorArroba: KG_POR_ARROBA },
    cobertura: { animaisPesados, animaisAtivos: e.animaisAtivos },
    producao: { ganhoKg: r2(ganhoKg), arrobasProduzidas: r2(arrobasProduzidas) },
    custos: {
      racao: r2(racao),
      sanidade: r2(sanidade),
      geraisBrutos: r2(geraisBrutos),
      geraisRateados: r2(geraisRateados),
      operacional: r2(operacional),
      compraAnimais: r2(compraAnimais),
    },
    custoPorArroba: custoPorArroba === null ? null : r2(custoPorArroba),
    vendas: {
      cabecas: e.vendas.length,
      cabecasComPeso: comPeso.length,
      receita: r2(receita),
      arrobasVendidas: r2(arrobasVendidas),
      precoMedioArroba: precoMedioArroba === null ? null : r2(precoMedioArroba),
    },
    resultado: {
      liquido: r2(receita - operacional - compraAnimais),
      margemPorArroba:
        precoMedioArroba !== null && custoPorArroba !== null ? r2(precoMedioArroba - custoPorArroba) : null,
    },
    pontoEquilibrio: { precoMinimoArroba: custoPorArroba === null ? null : r2(custoPorArroba) },
  };
}

/** Quanto sobra (ou falta) por arroba e no total, a um preço de venda hipotético. */
export function simularPreco(custoPorArroba: number, arrobasParaVender: number, precoArroba: number) {
  const margemPorArroba = precoArroba - custoPorArroba;
  return { precoArroba, margemPorArroba: r2(margemPorArroba), margemTotal: r2(margemPorArroba * arrobasParaVender) };
}
