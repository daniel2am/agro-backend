// Regras puras da base de parceiros: escopos de dados, código de convite, plano
// patrocinado e o "cartão" que o parceiro enxerga de cada produtor.
//
// Princípio: o parceiro só vê o que o produtor autorizou, e NUNCA dinheiro, CPF,
// contas bancárias ou lançamentos. Os escopos abaixo são a lista fechada do que
// pode ser compartilhado; qualquer outro valor é descartado.

import { PLANOS, PlanoTipo, planoEmVigor } from '../plano/planos';

export const ESCOPOS = ['rebanho', 'desempenho', 'area', 'localizacao', 'contato'] as const;
export type Escopo = (typeof ESCOPOS)[number];

export const ROTULO_ESCOPO: Record<Escopo, string> = {
  rebanho: 'Tamanho do rebanho (nº de animais ativos)',
  desempenho: 'Ganho de peso médio (GMD) do rebanho',
  area: 'Área em hectares (invernadas e lavouras)',
  localizacao: 'Município e estado da propriedade',
  contato: 'Seu nome e e-mail',
};

export const TIPOS_PARCEIRO = ['associacao', 'nutricao', 'insumos'] as const;
export type TipoParceiro = (typeof TIPOS_PARCEIRO)[number];

/** Mantém só escopos válidos, sem repetição, na ordem canônica. */
export function limparEscopos(entrada: unknown): Escopo[] {
  const lista = Array.isArray(entrada) ? entrada : [];
  return ESCOPOS.filter((e) => lista.includes(e));
}

/** O produtor só pode autorizar o que foi pedido (nunca mais). */
export function escoposConcedidos(pedidos: Escopo[], escolhidos: unknown): Escopo[] {
  const ok = new Set(limparEscopos(escolhidos));
  return pedidos.filter((e) => ok.has(e));
}

// ------------------------------------------------------------------- código

// sem 0/O/1/I/L para não confundir ao ditar por telefone
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código curto de convite, ex.: "K7M2-9QXP". `aleatorio` injetável para teste. */
export function gerarCodigo(aleatorio: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const c = () => ALFABETO[aleatorio(ALFABETO.length)]!;
  return `${c()}${c()}${c()}${c()}-${c()}${c()}${c()}${c()}`;
}

/** Aceita o código digitado de qualquer jeito (minúsculas, sem hífen, espaços). */
export function normalizarCodigo(entrada: unknown): string | null {
  const s = String(entrada ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== 8) return null;
  if (![...s].every((ch) => ALFABETO.includes(ch))) return null;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

// ------------------------------------------------------------------- convite

export interface ConviteEstado {
  ativo: boolean;
  validoAte: Date;
  usos: number;
  usosMax: number;
}

export type MotivoConvite = 'ok' | 'desativado' | 'vencido' | 'esgotado';

export function situacaoDoConvite(c: ConviteEstado, agora: Date = new Date()): MotivoConvite {
  if (!c.ativo) return 'desativado';
  if (c.validoAte.getTime() <= agora.getTime()) return 'vencido';
  if (c.usos >= c.usosMax) return 'esgotado';
  return 'ok';
}

export const MENSAGEM_CONVITE: Record<Exclude<MotivoConvite, 'ok'>, string> = {
  desativado: 'Este convite foi cancelado pelo parceiro.',
  vencido: 'Este convite venceu. Peça um novo ao parceiro.',
  esgotado: 'Este convite já atingiu o número de usos.',
};

// --------------------------------------------------------------- plano patrocinado

const ordem = (p: PlanoTipo) => PLANOS.indexOf(p);

export interface DecisaoPlano {
  conceder: boolean;
  plano?: PlanoTipo;
  ateEm?: Date;
  motivo: 'concedido' | 'sem_patrocinio' | 'plano_atual_igual_ou_melhor';
}

/**
 * O patrocínio nunca rebaixa nem substitui quem já tem plano igual ou melhor em
 * vigor (inclusive o teste gratuito: se o teste é Pro e o convite é Produtor, fica o Pro).
 * Se o plano atual vence depois do patrocínio, também não troca.
 */
export function decidirPatrocinio(
  atual: { plano: PlanoTipo; planoAteEm: Date | null },
  oferta: { plano: PlanoTipo; meses: number },
  agora: Date = new Date(),
): DecisaoPlano {
  if (oferta.plano === 'basico' || oferta.meses <= 0) return { conceder: false, motivo: 'sem_patrocinio' };
  const emVigor = planoEmVigor(atual.plano, atual.planoAteEm, agora);
  const ateEm = new Date(agora);
  ateEm.setMonth(ateEm.getMonth() + oferta.meses);

  if (ordem(emVigor) > ordem(oferta.plano)) return { conceder: false, motivo: 'plano_atual_igual_ou_melhor' };
  if (ordem(emVigor) === ordem(oferta.plano)) {
    // mesmo plano: só vale se o patrocínio estender o vencimento (sem vencimento = já é eterno)
    const venceEm = atual.planoAteEm;
    if (emVigor !== 'basico' && (venceEm === null || venceEm.getTime() >= ateEm.getTime())) {
      return { conceder: false, motivo: 'plano_atual_igual_ou_melhor' };
    }
  }
  return { conceder: true, plano: oferta.plano, ateEm, motivo: 'concedido' };
}

// -------------------------------------------------------------------- cartão

export interface DadosDaFazenda {
  animaisAtivos: number;
  gmdMedioKgDia: number | null;
  animaisAvaliados: number;
  areaHa: number;
  invernadas: number;
  lavouras: number;
  cidade: string;
  estado: string;
  produtorNome: string;
  produtorEmail: string;
}

export interface CartaoProdutor {
  rebanho?: { animaisAtivos: number };
  desempenho?: { gmdMedioKgDia: number | null; animaisAvaliados: number };
  area?: { areaHa: number; invernadas: number; lavouras: number };
  localizacao?: { cidade: string; estado: string };
  contato?: { nome: string; email: string };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Monta só os blocos autorizados. Escopo fora da lista fechada nunca vaza. */
export function montarCartao(escopos: string[], d: DadosDaFazenda): CartaoProdutor {
  const ok = new Set(limparEscopos(escopos));
  const c: CartaoProdutor = {};
  if (ok.has('rebanho')) c.rebanho = { animaisAtivos: d.animaisAtivos };
  if (ok.has('desempenho')) c.desempenho = { gmdMedioKgDia: d.gmdMedioKgDia === null ? null : r2(d.gmdMedioKgDia), animaisAvaliados: d.animaisAvaliados };
  if (ok.has('area')) c.area = { areaHa: r2(d.areaHa), invernadas: d.invernadas, lavouras: d.lavouras };
  if (ok.has('localizacao')) c.localizacao = { cidade: d.cidade, estado: d.estado };
  if (ok.has('contato')) c.contato = { nome: d.produtorNome, email: d.produtorEmail };
  return c;
}

export interface PesagemSimples {
  animalId: string;
  data: Date;
  pesoKg: number;
}

/** GMD médio: média, entre animais com 2+ pesagens em dias diferentes, de (último−primeiro)/dias. */
export function gmdMedio(pesagens: PesagemSimples[]): { gmd: number | null; avaliados: number } {
  const por = new Map<string, PesagemSimples[]>();
  for (const p of pesagens) {
    if (!(p.pesoKg > 0)) continue;
    (por.get(p.animalId) ?? por.set(p.animalId, []).get(p.animalId)!).push(p);
  }
  const gmds: number[] = [];
  for (const l of por.values()) {
    if (l.length < 2) continue;
    const o = [...l].sort((a, b) => a.data.getTime() - b.data.getTime());
    const dias = (o[o.length - 1]!.data.getTime() - o[0]!.data.getTime()) / 86_400_000;
    if (dias < 1) continue;
    gmds.push((o[o.length - 1]!.pesoKg - o[0]!.pesoKg) / dias);
  }
  return { gmd: gmds.length ? gmds.reduce((s, v) => s + v, 0) / gmds.length : null, avaliados: gmds.length };
}
