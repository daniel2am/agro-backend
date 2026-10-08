// Interpretação de mensagens de WhatsApp em comandos de registro (despesa, receita,
// chuva, pesagem, resumo). Puro: sem rede nem banco.
//
// Estratégia: um interpretador DETERMINÍSTICO em português cobre as frases comuns
// ("gastei 450 com ração", "choveu 25 mm ontem", "pesagem 1234 456 kg"), de graça e de
// forma previsível. Só quando ele não entende é que a IA (opcional) é consultada, e o
// que ela devolve passa por `validarComando` como qualquer outra entrada. Nada é
// gravado sem o produtor confirmar o resumo.

import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, ROTULOS_CATEGORIA } from '../financeiro/categorias';

export type Comando =
  | { tipo: 'despesa' | 'receita'; valor: number; descricao: string; categoria?: string; data: string }
  | { tipo: 'chuva'; mm: number; data: string }
  | { tipo: 'pesagem'; brinco: string; pesoKg: number; data: string }
  | { tipo: 'resumo' }
  | { tipo: 'ajuda' }
  | { tipo: 'fazenda'; nome: string };

export type ResultadoInterpretacao = { comando: Comando } | { erro: 'nao_entendi' | 'falta_valor' | 'valor_invalido'; dica?: string };

export const VALOR_MAXIMO = 10_000_000;
export const MM_MAXIMO = 500;
export const PESO_MIN_KG = 20;
export const PESO_MAX_KG = 1500;

// ---------------------------------------------------------------- utilidades

export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s: string) => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim();

/** Data civil de hoje em Brasília (AAAA-MM-DD). */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  return p; // en-CA já formata AAAA-MM-DD
}

const somarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** "ontem", "anteontem", "dd/mm" ou "dd/mm/aaaa" → AAAA-MM-DD; sem data = hoje. Futuro é descartado. */
export function lerData(textoNormalizado: string, hoje: string): string {
  if (/\banteontem\b/.test(textoNormalizado)) return somarDias(hoje, -2);
  if (/\bontem\b/.test(textoNormalizado)) return somarDias(hoje, -1);
  const m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(textoNormalizado);
  if (m) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    let ano = m[3] ? Number(m[3]) : Number(hoje.slice(0, 4));
    if (ano < 100) ano += 2000;
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const d = new Date(`${iso}T12:00:00Z`);
    const valida = d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
    if (valida && iso <= hoje) return iso;
  }
  return hoje;
};

// ------------------------------------------------------------------- números

export interface Numero {
  valor: number;
  inicio: number;
  fim: number;
  temMoeda: boolean;
}

/** Todos os números do texto, entendendo "1.200,50", "1200", "2 mil", "1,5 mil", "R$ 300". */
export function extrairNumeros(texto: string): Numero[] {
  const re = /(r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+\.\d+|\d+(?:,\d+)?)(\s*(?:mil|k)\b)?/gi;
  const out: Numero[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    let bruto = m[2]!;
    if (bruto.includes(',')) bruto = bruto.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(bruto)) bruto = bruto.replace(/\./g, ''); // 1.200 = mil e duzentos
    let valor = Number(bruto);
    if (!Number.isFinite(valor)) continue;
    if (m[3]) valor *= 1000;
    out.push({ valor, inicio: m.index, fim: m.index + m[0].length, temMoeda: !!m[1] });
  }
  return out;
}

// ---------------------------------------------------------------- categorias

const PALAVRAS_DESPESA: [RegExp, string][] = [
  [/(compra|comprei).*(bezerro|boi|novilha|vaca|garrote|animal|gado|touro|cabeca)/, 'compra_animais'],
  [/(racao|sal mineral|\bsal\b|suplemento|farelo|silagem|proteinado|nucleo|milho moido|caroco)/, 'racao'],
  [/(vacina|vermifugo|medicamento|remedio|veterinario|antibiotico|carrapat|aftosa|brucelose|inseminacao|ivermectina)/, 'sanidade'],
  [/(diesel|gasolina|combustivel|etanol|lubrificante|oleo)/, 'combustivel'],
  [/(salario|vaqueiro|peao|diaria|funcionario|mao de obra|empregado|13o|ferias)/, 'mao_de_obra'],
  [/(conserto|peca|manutencao|cerca|arame|trator|reforma|pneu|mangueira|curral)/, 'manutencao'],
  [/(energia|\bluz\b|cemig|energisa|celesc)/, 'energia'],
  [/(frete|transporte|caminhao|carreta)/, 'frete'],
  [/(\bitr\b|imposto|funrural|\bgta\b|taxa|iptu|licenca)/, 'impostos'],
  [/(arrendamento|aluguel de pasto)/, 'arrendamento'],
  [/(semente|sementes|muda|mudas)/, 'sementes'],
  [/(adubo|fertilizante|calcario|herbicida|defensivo|fungicida|inseticida|dessecante|gesso|ureia)/, 'insumos'],
];

const PALAVRAS_RECEITA: [RegExp, string][] = [
  [/(boi|gado|bezerro|bezerra|vaca|novilha|garrote|touro|arroba|frigorifico|cabeca)/, 'venda_gado'],
  [/(leite|laticinio)/, 'leite'],
  [/(soja|milho|saca|sacas|colheita|grao|graos|trigo|algodao|cafe|sorgo|feijao|arroz)/, 'venda_lavoura'],
  [/(aluguel de pasto|arrendamento)/, 'arrendamento_recebido'],
  [/(servico|prestacao|frete)/, 'servicos'],
];

export function adivinharCategoria(tipo: 'despesa' | 'receita', textoNormalizado: string): string | undefined {
  const tabela = tipo === 'despesa' ? PALAVRAS_DESPESA : PALAVRAS_RECEITA;
  return tabela.find(([re]) => re.test(textoNormalizado))?.[1];
}

// ------------------------------------------------------------- interpretador

/**
 * Qual dos números é o valor em reais? Em "vendi 2 bois por 9 mil" o 2 é quantidade.
 * Ordem: o que vem com R$; o que vem depois de "por/a/de/valor/total/custou"; o que
 * tem "mil"; senão o primeiro.
 */
function escolherValor(textoNormalizado: string, numeros: Numero[]): Numero {
  const comMoeda = numeros.find((n) => n.temMoeda);
  if (comMoeda) return comMoeda;
  const depoisDePreposicao = numeros.find((n) => {
    const antes = textoNormalizado.slice(0, n.inicio).trim().split(' ').pop() ?? '';
    return ['por', 'a', 'de', 'valor', 'total', 'custou', 'em', 'pagando', 'ficou', 'foi'].includes(antes);
  });
  if (depoisDePreposicao) return depoisDePreposicao;
  const comMil = numeros.find((n) => /\bmil\b|\dk\b/.test(textoNormalizado.slice(n.inicio, n.fim + 4)));
  return comMil ?? numeros[0]!;
}

const VERBOS_DESPESA = /\b(gastei|paguei|comprei|despesa|pago|compra|custou|custo|pagamento|gasto)\b/;
const VERBOS_RECEITA = /\b(vendi|recebi|receita|venda|entrada|ganhei|vendeu|recebimento)\b/;

function descricaoDe(original: string): string {
  const limpo = original.replace(/[|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  return limpo.length > 120 ? `${limpo.slice(0, 117)}...` : limpo;
}

export function interpretarTexto(textoOriginal: string, hoje: string = hojeEmBrasilia()): ResultadoInterpretacao {
  const original = (textoOriginal ?? '').trim();
  const t = norm(original);
  if (!t) return { erro: 'nao_entendi' };

  // --- comandos simples
  if (t === '?' || /^(ajuda|menu|help|oi|ola|bom dia|boa tarde|boa noite|comandos|como funciona)\b/.test(t)) return { comando: { tipo: 'ajuda' } };
  if (/^(resumo|saldo|balanco|extrato|como estou|situacao)\b/.test(t)) return { comando: { tipo: 'resumo' } };
  const fz = /^fazenda\s+(.{2,60})$/.exec(t);
  if (fz) return { comando: { tipo: 'fazenda', nome: fz[1]!.trim() } };

  const numeros = extrairNumeros(original);
  const data = lerData(t, hoje);

  // --- chuva
  if (/\b(choveu|chuva|pluviometro|chuvoso)\b/.test(t) || /\d\s*mm\b/.test(t)) {
    const n = numeros[0];
    if (!n) return { erro: 'falta_valor', dica: 'Quantos milímetros? Ex.: "choveu 25 mm".' };
    if (!(n.valor >= 0 && n.valor <= MM_MAXIMO)) return { erro: 'valor_invalido', dica: `Chuva de ${n.valor} mm parece errada (máximo ${MM_MAXIMO}).` };
    return { comando: { tipo: 'chuva', mm: n.valor, data } };
  }

  // --- pesagem: "pesagem 1234 456 kg", "brinco 1234 pesou 456", "peso BR-001 470"
  if (/\b(peso|pesagem|pesei|pesou|pesamos|balanca)\b/.test(t)) {
    const m =
      /\b(?:peso|pesagem|pesei|pesamos)\s+(?:do\s+|da\s+)?(?:brinco\s+|boi\s+|vaca\s+|animal\s+)?([a-z0-9-]*\d[a-z0-9-]*)\s+(?:pesou\s+|com\s+)?(\d+(?:[.,]\d+)?)\s*(?:kg|quilos?)?\b/.exec(t) ??
      /\b(?:brinco|boi|vaca|animal)\s+([a-z0-9-]*\d[a-z0-9-]*)\s+(?:pesou|pesando|peso|com)\s+(\d+(?:[.,]\d+)?)/.exec(t);
    if (!m) return { erro: 'nao_entendi', dica: 'Para pesagem use: "pesagem 1234 456 kg" (brinco e peso).' };
    const peso = Number(m[2]!.replace(',', '.'));
    if (!(peso >= PESO_MIN_KG && peso <= PESO_MAX_KG)) return { erro: 'valor_invalido', dica: `Peso de ${peso} kg parece errado (entre ${PESO_MIN_KG} e ${PESO_MAX_KG} kg).` };
    return { comando: { tipo: 'pesagem', brinco: m[1]!.toUpperCase(), pesoKg: peso, data } };
  }

  // --- financeiro
  const ehDespesa = VERBOS_DESPESA.test(t);
  const ehReceita = VERBOS_RECEITA.test(t);
  if (ehDespesa || ehReceita) {
    // quando há os dois ("vendi para comprar ração") vale o primeiro verbo
    const tipo: 'despesa' | 'receita' =
      ehDespesa && ehReceita ? (t.search(VERBOS_RECEITA) < t.search(VERBOS_DESPESA) ? 'receita' : 'despesa') : ehReceita ? 'receita' : 'despesa';

    if (numeros.length === 0) return { erro: 'falta_valor', dica: 'Qual o valor? Ex.: "gastei 450 com ração".' };

    // "12 bezerros a 2800 cada" → quantidade × preço unitário
    let valor: number;
    if (/\b(cada|por cabeca|a cabeca|por unidade|a unidade|por saca|a saca|por arroba|a arroba)\b/.test(t) && numeros.length >= 2) {
      const unit = [...numeros].reverse().find((n) => n.temMoeda) ?? numeros[numeros.length - 1]!;
      const qtd = numeros.find((n) => n !== unit && Number.isInteger(n.valor) && n.valor >= 1 && n.valor <= 100_000);
      valor = qtd ? qtd.valor * unit.valor : unit.valor;
    } else {
      valor = escolherValor(t, numeros).valor;
    }
    valor = Math.round(valor * 100) / 100;
    if (!(valor > 0 && valor <= VALOR_MAXIMO)) return { erro: 'valor_invalido', dica: 'Esse valor parece errado. Confira e envie de novo.' };

    const categoria = adivinharCategoria(tipo, t);
    return { comando: { tipo, valor, descricao: descricaoDe(original), ...(categoria ? { categoria } : {}), data } };
  }

  return { erro: 'nao_entendi' };
}

// ----------------------------------------------------------- validação (IA)

const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ehData = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/**
 * Confere um comando vindo de fonte não confiável (a IA): tipos, faixas, categoria na lista
 * oficial e data que não seja futura. Devolve o comando limpo ou null.
 */
export function validarComando(bruto: any, hoje: string = hojeEmBrasilia()): Comando | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const data = ehData(bruto.data) && bruto.data <= hoje ? bruto.data : hoje;

  switch (bruto.tipo) {
    case 'despesa':
    case 'receita': {
      const valor = ehNumero(bruto.valor) ? Math.round(bruto.valor * 100) / 100 : NaN;
      if (!(valor > 0 && valor <= VALOR_MAXIMO)) return null;
      const lista = (bruto.tipo === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA) as readonly string[];
      const categoria = typeof bruto.categoria === 'string' && lista.includes(bruto.categoria) ? bruto.categoria : undefined;
      const descricao = descricaoDe(String(bruto.descricao ?? '')) || (bruto.tipo === 'despesa' ? 'Despesa' : 'Receita');
      return { tipo: bruto.tipo, valor, descricao, ...(categoria ? { categoria } : {}), data };
    }
    case 'chuva':
      return ehNumero(bruto.mm) && bruto.mm >= 0 && bruto.mm <= MM_MAXIMO ? { tipo: 'chuva', mm: bruto.mm, data } : null;
    case 'pesagem': {
      const brinco = String(bruto.brinco ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      return brinco && ehNumero(bruto.pesoKg) && bruto.pesoKg >= PESO_MIN_KG && bruto.pesoKg <= PESO_MAX_KG
        ? { tipo: 'pesagem', brinco, pesoKg: bruto.pesoKg, data }
        : null;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------- respostas

export const moedaBR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => iso.split('-').reverse().join('/');
const num1 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Resumo do que será gravado, para o produtor confirmar. */
export function resumoDoComando(c: Comando, nomeFazenda: string): string {
  switch (c.tipo) {
    case 'despesa':
    case 'receita': {
      const cat = c.categoria ? ROTULOS_CATEGORIA[c.categoria] : undefined;
      return [
        `${c.tipo === 'despesa' ? '💸 Despesa' : '💰 Receita'} de ${moedaBR(c.valor)}`,
        `📝 ${c.descricao}`,
        cat ? `🏷️ ${cat}` : null,
        `📅 ${dataBR(c.data)} · 🌾 ${nomeFazenda}`,
      ].filter(Boolean).join('\n');
    }
    case 'chuva':
      return `🌧️ Chuva de ${num1(c.mm)} mm\n📅 ${dataBR(c.data)} · 🌾 ${nomeFazenda}`;
    case 'pesagem':
      return `⚖️ Pesagem: brinco ${c.brinco} com ${num1(c.pesoKg)} kg\n📅 ${dataBR(c.data)} · 🌾 ${nomeFazenda}`;
    default:
      return '';
  }
}

export const TEXTO_AJUDA = [
  '🌾 *AgroTotal no WhatsApp*',
  'Mande uma mensagem (ou áudio) e eu registro depois que você confirmar:',
  '',
  '💸 "gastei 450 com ração"',
  '💰 "vendi 12 bezerros a 2800 cada"',
  '🌧️ "choveu 25 mm ontem"',
  '⚖️ "pesagem 1234 456 kg"',
  '📊 "resumo" (saldo do mês)',
  '🏠 "fazenda Boa Vista" (trocar de fazenda)',
].join('\n');

export const MENSAGEM_NAO_ENTENDI = 'Não entendi 🤔. Exemplos: "gastei 450 com ração", "choveu 25 mm", "pesagem 1234 456 kg" ou "ajuda".';
