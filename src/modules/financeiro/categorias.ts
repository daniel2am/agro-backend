/**
 * Categorias de lançamento financeiro. São identificadores estáveis (slugs):
 * o app mostra rótulo e ícone, o backend só guarda e valida a chave.
 */
export const CATEGORIAS_DESPESA = [
  'racao',
  'sanidade',
  'insumos',
  'sementes',
  'combustivel',
  'mao_de_obra',
  'manutencao',
  'energia',
  'frete',
  'arrendamento',
  'impostos',
  'compra_animais',
  'outros_despesa',
] as const;

export const CATEGORIAS_RECEITA = [
  'venda_gado',
  'venda_lavoura',
  'leite',
  'servicos',
  'arrendamento_recebido',
  'outros_receita',
] as const;

export const CATEGORIAS = [...CATEGORIAS_DESPESA, ...CATEGORIAS_RECEITA] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const ehCategoriaDeDespesa = (c: string) =>
  (CATEGORIAS_DESPESA as readonly string[]).includes(c);

export const ehCategoriaDeReceita = (c: string) =>
  (CATEGORIAS_RECEITA as readonly string[]).includes(c);

/** Rótulos para relatórios (o app tem os seus; aqui só o necessário para o PDF). */
export const ROTULOS_CATEGORIA: Record<string, string> = {
  racao: 'Ração e suplementos',
  sanidade: 'Sanidade e veterinário',
  insumos: 'Insumos agrícolas',
  sementes: 'Sementes e mudas',
  combustivel: 'Combustível',
  mao_de_obra: 'Mão de obra',
  manutencao: 'Manutenção e peças',
  energia: 'Energia',
  frete: 'Frete e transporte',
  arrendamento: 'Arrendamento',
  impostos: 'Impostos e taxas',
  compra_animais: 'Compra de animais',
  outros_despesa: 'Outras despesas',
  venda_gado: 'Venda de gado',
  venda_lavoura: 'Venda de lavoura',
  leite: 'Leite',
  servicos: 'Serviços prestados',
  arrendamento_recebido: 'Arrendamento recebido',
  outros_receita: 'Outras receitas',
};

export const rotuloCategoria = (slug: string | null | undefined, tipo: 'receita' | 'despesa') =>
  (slug && ROTULOS_CATEGORIA[slug]) || (tipo === 'receita' ? 'Receitas sem categoria' : 'Despesas sem categoria');
