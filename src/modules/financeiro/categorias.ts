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
