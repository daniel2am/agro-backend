/**
 * Definição dos planos comerciais. É a ÚNICA fonte de verdade: o app lê isto por
 * GET /plano, então mudar um limite ou um recurso aqui muda o produto sem
 * publicar o app de novo.
 *
 * Princípios:
 *  - Limite é "soft": nunca apaga nem bloqueia o que já existe (ex.: após o fim do
 *    teste ou um downgrade). Só impede CRIAR além do limite.
 *  - O plano pertence a quem administra a fazenda; colaboradores usam o do dono.
 */

export const PLANOS = ['basico', 'intermediario', 'avancado'] as const;
export type PlanoTipo = (typeof PLANOS)[number];

/** Recursos liberados por plano. Chaves estáveis, usadas também pelo app. */
export const RECURSOS = [
  'financeiro_avancado', // gráficos, categorias, comparativo e exportação CSV
  'ferramentas_campo', // calculadoras (pulverização, adubação, calagem, sementes…)
  'clima', // previsão, janela de pulverização, geada, estresse térmico
  'alertas_vacina', // notificações no aparelho para vacinas/medicamentos
  'ganho_peso', // GMD por animal, lotação das invernadas
  'modo_offline', // fila de lançamentos sem internet
  'suplementacao', // calculadora de suplementação animal
  'pragas', // guia de pragas e doenças
  'relatorio_pdf', // relatório em PDF (banco/contador)
  'equipe', // vários usuários por fazenda, com papéis
  'importar_mapas', // importar invernadas de KML/GeoJSON/Shapefile
] as const;
export type Recurso = (typeof RECURSOS)[number];

export interface Limites {
  fazendas: number;
  /** Invernadas + lavouras ativas, somadas. */
  areas: number;
  /** Animais ativos (os vendidos/baixados não contam). */
  animais: number;
  /** Pessoas com acesso a cada fazenda, contando o dono. */
  membros: number;
}

export interface DefinicaoPlano {
  tipo: PlanoTipo;
  nome: string;
  resumo: string;
  /** Preço mensal em reais; null = a definir. Informativo (a cobrança é externa). */
  precoMensal: number | null;
  limites: Limites;
  recursos: Recurso[];
}

const SEM_LIMITE = Number.MAX_SAFE_INTEGER;

const INTERMEDIARIO: Recurso[] = [
  'financeiro_avancado',
  'ferramentas_campo',
  'clima',
  'alertas_vacina',
  'ganho_peso',
  'modo_offline',
];

export const DEFINICOES: Record<PlanoTipo, DefinicaoPlano> = {
  basico: {
    tipo: 'basico',
    nome: 'Essencial',
    resumo: 'Para começar: uma propriedade com o controle básico do rebanho e da lavoura.',
    precoMensal: null,
    limites: { fazendas: 1, areas: 3, animais: 99, membros: 1 },
    recursos: [],
  },
  intermediario: {
    tipo: 'intermediario',
    nome: 'Produtor',
    resumo: 'Para quem toca a fazenda de verdade: mais área, mais gado e as ferramentas do dia a dia.',
    precoMensal: null,
    limites: { fazendas: 3, areas: 20, animais: 500, membros: 3 },
    recursos: INTERMEDIARIO,
  },
  avancado: {
    tipo: 'avancado',
    nome: 'Pro',
    resumo: 'Operação grande ou várias propriedades: sem limites práticos, com equipe e relatórios.',
    precoMensal: null,
    limites: { fazendas: SEM_LIMITE, areas: SEM_LIMITE, animais: SEM_LIMITE, membros: SEM_LIMITE },
    recursos: [...INTERMEDIARIO, 'suplementacao', 'pragas', 'relatorio_pdf', 'equipe', 'importar_mapas'],
  },
};

export const ehPlano = (v: unknown): v is PlanoTipo => (PLANOS as readonly string[]).includes(String(v));

export const ehIlimitado = (n: number) => n >= SEM_LIMITE;

export type RecursoContavel = 'fazendas' | 'areas' | 'animais' | 'membros';

/**
 * Plano EM VIGOR: o contratado, desde que não tenha vencido. Vencido = básico.
 * `ateEm` nulo significa sem vencimento.
 */
export function planoEmVigor(plano: PlanoTipo, ateEm: Date | null | undefined, agora: Date = new Date()): PlanoTipo {
  if (plano === 'basico') return 'basico';
  if (ateEm && ateEm.getTime() <= agora.getTime()) return 'basico';
  return plano;
}

export const temRecurso = (plano: PlanoTipo, recurso: Recurso) => DEFINICOES[plano].recursos.includes(recurso);

export interface ResultadoLimite {
  permitido: boolean;
  limite: number;
  usado: number;
  restante: number;
}

/** Cabe mais `adicionar` itens de `recurso` dado o uso atual? */
export function verificarLimite(
  plano: PlanoTipo,
  recurso: RecursoContavel,
  usado: number,
  adicionar = 1,
): ResultadoLimite {
  const limite = DEFINICOES[plano].limites[recurso];
  const restante = ehIlimitado(limite) ? SEM_LIMITE : Math.max(0, limite - usado);
  return { permitido: ehIlimitado(limite) || usado + adicionar <= limite, limite, usado, restante };
}

/** O próximo plano que resolve (ou aumenta) o limite estourado; null se já é o maior. */
export function proximoPlano(plano: PlanoTipo): PlanoTipo | null {
  const i = PLANOS.indexOf(plano);
  return i >= 0 && i < PLANOS.length - 1 ? PLANOS[i + 1]! : null;
}

/** Menor plano que libera o recurso. */
export function menorPlanoComRecurso(recurso: Recurso): PlanoTipo {
  return PLANOS.find((p) => temRecurso(p, recurso)) ?? 'avancado';
}

const ROTULO_RECURSO: Record<RecursoContavel, [string, string]> = {
  fazendas: ['propriedade', 'propriedades'],
  areas: ['área (invernada ou lavoura)', 'áreas (invernadas e lavouras)'],
  animais: ['animal', 'animais'],
  membros: ['pessoa na equipe', 'pessoas na equipe'],
};

export function mensagemLimite(plano: PlanoTipo, recurso: RecursoContavel, limite: number): string {
  const [singular, plural] = ROTULO_RECURSO[recurso];
  const prox = proximoPlano(plano);
  const base = `O plano ${DEFINICOES[plano].nome} permite até ${limite} ${limite === 1 ? singular : plural}.`;
  return prox ? `${base} Faça upgrade para o plano ${DEFINICOES[prox].nome} para continuar.` : base;
}
