// Gerador do arquivo LCDPR (Livro Caixa Digital do Produtor Rural), leiaute 1.3
// (Ato Declaratório Executivo Copes nº 1/2020). Puro: recebe os dados, devolve o
// texto e a lista de pendências. Segue o manual da Receita Federal:
//  - texto UTF-8, campos separados por "|", linhas terminadas em CR LF;
//  - valores em centavos, sem separadores; datas ddmmaaaa; períodos mmaaaa;
//  - CPF/CNPJ só com dígitos; códigos de imóvel/conta com 3 dígitos;
//  - ordem: 0000, 0010, 0030, 0040 (+0045), 0050, Q100, Q200, 9999.
//
// O arquivo NÃO é assinado: a assinatura digital (certificado ICP-Brasil) e a
// entrega continuam sendo feitas pelo contribuinte ou pelo contador.

import { UFS, apenasDigitos, cpfOuCnpjValido, cpfValido } from 'src/common/utils/documentos';

export const VERSAO_LEIAUTE = '0013';
export const COD_CONTA_ESPECIE = '000';

// ---------------------------------------------------------------------- tipos

export interface ContribuinteEntrada {
  cpf: string;
  nome: string;
  endereco: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  uf: string;
  codMunicipio: string;
  cep: string;
  telefone?: string | null;
  email: string;
  contador?: { nome?: string | null; doc?: string | null; crc?: string | null; email?: string | null; fone?: string | null } | null;
}

export interface ContraparteEntrada {
  tipo: number;
  documento: string;
  nome: string;
  percentual: number;
}

export interface ImovelEntrada {
  fazendaId: string;
  nomeFazenda: string;
  uf: string;
  /** Dados fiscais; null = a fazenda ainda não foi configurada como imóvel rural. */
  fiscal: {
    codItr?: string | null;
    caepf?: string | null;
    inscricaoEstadual?: string | null;
    endereco: string;
    numero?: string | null;
    complemento?: string | null;
    bairro: string;
    cep: string;
    codMunicipio: string;
    tipoExploracao: number;
    participacaoPct: number;
    contrapartes: ContraparteEntrada[];
  } | null;
}

export interface ContaEntrada {
  id: string;
  banco: string;
  nomeBanco: string;
  agencia: string;
  numeroConta: string;
}

export interface LancamentoEntrada {
  id: string;
  fazendaId: string;
  data: Date;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
  categoria: string | null;
  contaBancariaId: string | null;
  documentoTipo: number | null;
  documentoNumero: string | null;
  contraparteDoc: string | null;
}

export interface EntradaLcdpr {
  ano: number;
  contribuinte: ContribuinteEntrada | null;
  imoveis: ImovelEntrada[];
  contas: ContaEntrada[];
  lancamentos: LancamentoEntrada[];
}

export interface Pendencia {
  codigo: string;
  gravidade: 'bloqueio' | 'aviso';
  mensagem: string;
  lancamentoId?: string;
  fazendaId?: string;
}

export interface Excluido {
  id: string;
  descricao: string;
  motivo: string;
}

export interface SaidaLcdpr {
  /** Sem pendência de bloqueio: o arquivo pode ser gerado. */
  pronto: boolean;
  texto: string | null;
  nomeArquivo: string;
  pendencias: Pendencia[];
  excluidos: Excluido[];
  resumo: { lancamentos: number; receitas: number; despesas: number; resultado: number; linhasArquivo: number };
}

// --------------------------------------------------------------- formatação

/** Valor em reais → centavos como texto, sem sinal ("1234,56" → "123456"). */
export const emCentavos = (valor: number): string => String(Math.round(Math.abs(valor) * 100));

/** Data civil no fuso de Brasília, como ddmmaaaa. */
export function ddmmaaaa(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, x) => ({ ...a, [x.type]: x.value }), {});
  return `${p.day}${p.month}${p.year}`;
}

export const mmaaaa = (d: Date): string => ddmmaaaa(d).slice(2);

/** Texto livre seguro: sem "|", sem caracteres de controle, espaços normalizados, com tamanho máximo. */
export function limparTexto(valor: unknown, max = 255): string {
  return String(valor ?? '')
    .replace(/[|\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const pad = (v: string | number, n: number) => String(v).padStart(n, '0');
/** Percentual com 2 casas, 5 dígitos fixos ("50" → "05000"; "100" → "10000"). */
const percentual = (p: number) => pad(Math.round(p * 100), 5);

const linha = (...campos: (string | number | null | undefined)[]) => campos.map((c) => c ?? '').join('|');

// ---------------------------------------------------------------- validações

const RECEITAS_DA_ATIVIDADE = ['venda_gado', 'venda_lavoura', 'leite'];
const RECEITAS_FORA = ['servicos', 'arrendamento_recebido', 'outros_receita'];

const ROTULO_FORA: Record<string, string> = {
  servicos: 'Serviços prestados não são receita da atividade rural',
  arrendamento_recebido: 'Arrendamento recebido não é receita da atividade rural (é aluguel)',
  outros_receita: 'Categoria "outras receitas" não é identificada como atividade rural',
};

const ehDigitos = (v: unknown, n: number) => apenasDigitos(v).length === n;

function validarContribuinte(c: ContribuinteEntrada): string[] {
  const erros: string[] = [];
  if (!cpfValido(c.cpf)) erros.push('CPF inválido');
  if (!limparTexto(c.nome)) erros.push('nome');
  if (!limparTexto(c.endereco, 150)) erros.push('endereço');
  if (!limparTexto(c.numero, 6)) erros.push('número do endereço (use S/N se não houver)');
  if (!limparTexto(c.bairro, 50)) erros.push('bairro');
  if (!(UFS as readonly string[]).includes(String(c.uf).toUpperCase())) erros.push('UF');
  if (!ehDigitos(c.codMunicipio, 7)) erros.push('município (código IBGE de 7 dígitos)');
  if (!ehDigitos(c.cep, 8)) erros.push('CEP (8 dígitos)');
  if (!/^\S+@\S+\.\S+$/.test(String(c.email ?? ''))) erros.push('e-mail');
  return erros;
}

function validarImovel(f: NonNullable<ImovelEntrada['fiscal']>): string[] {
  const erros: string[] = [];
  if (!ehDigitos(f.codItr, 8)) erros.push('CAFIR/NIRF do ITR (8 dígitos)');
  if (f.caepf && !ehDigitos(f.caepf, 14)) erros.push('CAEPF (14 dígitos)');
  if (!f.caepf && f.tipoExploracao === 1) erros.push('CAEPF (obrigatório na exploração individual)');
  if (!limparTexto(f.endereco, 150)) erros.push('endereço do imóvel');
  if (!limparTexto(f.bairro, 50)) erros.push('bairro do imóvel');
  if (!ehDigitos(f.cep, 8)) erros.push('CEP do imóvel');
  if (!ehDigitos(f.codMunicipio, 7)) erros.push('município do imóvel (código IBGE)');
  if (![1, 2, 3, 4, 5, 6].includes(f.tipoExploracao)) erros.push('tipo de exploração');
  if (!(f.participacaoPct > 0 && f.participacaoPct <= 100)) erros.push('participação (entre 0 e 100%)');
  return erros;
}

function validarConta(c: ContaEntrada): string[] {
  const erros: string[] = [];
  if (!ehDigitos(c.banco, 3)) erros.push('código do banco (3 dígitos)');
  if (!limparTexto(c.nomeBanco, 30)) erros.push('nome do banco');
  if (!ehDigitos(c.agencia, 4)) erros.push('agência (4 dígitos, sem dígito verificador)');
  const num = apenasDigitos(c.numeroConta);
  if (num.length < 1 || num.length > 16) erros.push('número da conta (até 16 dígitos, com dígito verificador)');
  return erros;
}

// ------------------------------------------------------------------- gerador

export function gerarLcdpr(e: EntradaLcdpr): SaidaLcdpr {
  const pendencias: Pendencia[] = [];
  const excluidos: Excluido[] = [];
  const cpfProdutor = apenasDigitos(e.contribuinte?.cpf);
  const nomeArquivo = `LCDPR_${cpfProdutor || 'SEM_CPF'}_${e.ano}.txt`;
  const bloq = (codigo: string, mensagem: string, extra: Partial<Pendencia> = {}) =>
    pendencias.push({ codigo, gravidade: 'bloqueio', mensagem, ...extra });
  const aviso = (codigo: string, mensagem: string, extra: Partial<Pendencia> = {}) =>
    pendencias.push({ codigo, gravidade: 'aviso', mensagem, ...extra });

  // ---- lançamentos do ano
  const inicio = `0101${e.ano}`;
  const noAno = e.lancamentos.filter((l) => ddmmaaaa(l.data).slice(4) === String(e.ano));
  const usaveis: LancamentoEntrada[] = [];
  for (const l of noAno) {
    if (!(l.valor > 0)) {
      excluidos.push({ id: l.id, descricao: l.descricao, motivo: 'Valor zerado ou negativo' });
      continue;
    }
    if (l.tipo === 'receita' && l.categoria && RECEITAS_FORA.includes(l.categoria)) {
      excluidos.push({ id: l.id, descricao: l.descricao, motivo: ROTULO_FORA[l.categoria] ?? 'Não é receita da atividade rural' });
      continue;
    }
    if (l.tipo === 'receita' && !l.categoria) {
      bloq('receita_sem_categoria', `Classifique a receita "${limparTexto(l.descricao, 60)}": é venda de gado, de lavoura ou leite?`, { lancamentoId: l.id });
      continue;
    }
    usaveis.push(l);
  }
  if (excluidos.some((x) => x.motivo !== 'Valor zerado ou negativo')) {
    aviso('receitas_fora', `${excluidos.filter((x) => x.motivo !== 'Valor zerado ou negativo').length} receita(s) ficaram fora do LCDPR por não serem da atividade rural. Confirme com seu contador.`);
  }

  // ---- contribuinte
  if (!e.contribuinte) {
    bloq('contribuinte_ausente', 'Preencha os dados do produtor (CPF, endereço, e-mail).');
  } else {
    const erros = validarContribuinte(e.contribuinte);
    if (erros.length) bloq('contribuinte_invalido', `Dados do produtor com problema: ${erros.join('; ')}.`);
  }

  // ---- imóveis: só entram os que têm lançamento no ano ou já estão configurados
  const comMovimento = new Set(usaveis.map((l) => l.fazendaId));
  const imoveisUsados = e.imoveis.filter((i) => comMovimento.has(i.fazendaId) || i.fiscal !== null);
  const codImovel = new Map<string, string>();
  imoveisUsados.forEach((i, idx) => codImovel.set(i.fazendaId, pad(idx + 1, 3)));

  for (const i of imoveisUsados) {
    if (!i.fiscal) {
      bloq('imovel_ausente', `Configure os dados fiscais do imóvel "${limparTexto(i.nomeFazenda, 50)}" (CAFIR, CAEPF, endereço).`, { fazendaId: i.fazendaId });
      continue;
    }
    const erros = validarImovel(i.fiscal);
    if (erros.length) bloq('imovel_invalido', `Imóvel "${limparTexto(i.nomeFazenda, 50)}": ${erros.join('; ')}.`, { fazendaId: i.fazendaId });
    const precisaTerceiro = i.fiscal.participacaoPct < 100 || i.fiscal.tipoExploracao !== 1;
    if (precisaTerceiro && i.fiscal.contrapartes.length === 0) {
      bloq('terceiros_ausentes', `Imóvel "${limparTexto(i.nomeFazenda, 50)}": informe condôminos, arrendador ou parceiros (participação menor que 100% ou exploração não individual).`, { fazendaId: i.fazendaId });
    }
    for (const c of i.fiscal.contrapartes) {
      if (!cpfOuCnpjValido(c.documento) || !limparTexto(c.nome) || ![1, 2, 3, 4, 5].includes(c.tipo) || !(c.percentual >= 0 && c.percentual <= 100)) {
        bloq('terceiro_invalido', `Imóvel "${limparTexto(i.nomeFazenda, 50)}": confira CPF/CNPJ, nome e percentual de "${limparTexto(c.nome, 40) || 'terceiro'}".`, { fazendaId: i.fazendaId });
      }
    }
    if (precisaTerceiro) {
      aviso('participacao', `Imóvel "${limparTexto(i.nomeFazenda, 50)}": os valores devem refletir a sua participação (${i.fiscal.participacaoPct}%). O app NÃO aplica o percentual: confira se os lançamentos já são a sua parte.`, { fazendaId: i.fazendaId });
    }
  }

  // ---- contas bancárias (só as realmente usadas entram no 0050)
  const idsDeContaUsados = new Set(usaveis.map((l) => l.contaBancariaId).filter((x): x is string => !!x));
  const contasUsadas = e.contas.filter((c) => idsDeContaUsados.has(c.id));
  const codConta = new Map<string, string>();
  contasUsadas.forEach((c, idx) => codConta.set(c.id, pad(idx + 1, 3)));
  for (const c of contasUsadas) {
    const erros = validarConta(c);
    if (erros.length) bloq('conta_invalida', `Conta ${limparTexto(c.nomeBanco, 30)} ${c.agencia}: ${erros.join('; ')}.`);
  }

  // ---- linhas Q100 (ordem cronológica, estável)
  const ordenados = usaveis
    .map((l, i) => ({ l, i }))
    .sort((a, b) => a.l.data.getTime() - b.l.data.getTime() || a.i - b.i)
    .map((x) => x.l);

  let saldo = 0; // em centavos
  let semConta = 0;
  let semDocTipo = 0;
  let totalReceitas = 0;
  let totalDespesas = 0;
  const q100: string[] = [];
  const porMes = new Map<string, { entrada: number; saida: number; saldo: number }>();

  for (const l of ordenados) {
    const imovel = codImovel.get(l.fazendaId);
    if (!imovel) continue; // fazenda sem imóvel já gerou bloqueio acima

    // participante: obrigatório; folha/mão de obra aceita o CPF do próprio produtor
    let idPartic = apenasDigitos(l.contraparteDoc);
    if (!idPartic && l.categoria === 'mao_de_obra' && cpfProdutor) {
      idPartic = cpfProdutor;
    } else if (!cpfOuCnpjValido(idPartic)) {
      bloq('sem_participante', `Informe o CPF/CNPJ de quem ${l.tipo === 'receita' ? 'pagou' : 'recebeu'}: "${limparTexto(l.descricao, 60)}" (${ddmmaaaa(l.data).replace(/(\d\d)(\d\d)(\d{4})/, '$1/$2/$3')}).`, { lancamentoId: l.id });
      continue;
    }

    const conta = l.contaBancariaId ? codConta.get(l.contaBancariaId) : undefined;
    if (!conta) semConta++;
    let tipoDoc = l.documentoTipo;
    if (!tipoDoc || tipoDoc < 1 || tipoDoc > 6) {
      tipoDoc = 6;
      semDocTipo++;
    }

    const centavos = Math.round(l.valor * 100);
    const entrada = l.tipo === 'receita' ? centavos : 0;
    const saida = l.tipo === 'despesa' ? centavos : 0;
    saldo += entrada - saida;
    if (l.tipo === 'receita') totalReceitas += centavos;
    else totalDespesas += centavos;

    const hist = limparTexto(l.descricao, 255) || (l.tipo === 'receita' ? 'Receita da atividade rural' : 'Despesa de custeio/investimento');
    q100.push(
      linha(
        'Q100',
        ddmmaaaa(l.data),
        imovel,
        conta ?? COD_CONTA_ESPECIE,
        limparTexto(l.documentoNumero, 60),
        tipoDoc,
        hist,
        idPartic,
        l.tipo === 'receita' ? 1 : 2,
        entrada,
        saida,
        Math.abs(saldo),
        saldo >= 0 ? 'P' : 'N',
      ),
    );

    const mes = mmaaaa(l.data);
    const m = porMes.get(mes) ?? { entrada: 0, saida: 0, saldo: 0 };
    m.entrada += entrada;
    m.saida += saida;
    m.saldo = saldo; // saldo acumulado até o último lançamento do mês
    porMes.set(mes, m);
  }

  if (semConta > 0) {
    aviso('sem_conta', `${semConta} lançamento(s) sem conta bancária foram registrados como pagos em espécie (000). Informe a conta se o dinheiro passou pelo banco.`);
  }
  if (semDocTipo > 0) {
    aviso('sem_tipo_documento', `${semDocTipo} lançamento(s) sem tipo de documento foram registrados como "Outros".`);
  }
  if (usaveis.length === 0 && !pendencias.some((p) => p.gravidade === 'bloqueio')) {
    aviso('sem_lancamentos', `Nenhum lançamento em ${e.ano}.`);
  }

  const resumoBase = {
    lancamentos: q100.length,
    receitas: totalReceitas / 100,
    despesas: totalDespesas / 100,
    resultado: (totalReceitas - totalDespesas) / 100,
  };
  const pronto = !pendencias.some((p) => p.gravidade === 'bloqueio') && !!e.contribuinte;
  if (!pronto) {
    return { pronto: false, texto: null, nomeArquivo, pendencias, excluidos, resumo: { ...resumoBase, linhasArquivo: 0 } };
  }

  // ---- montagem do arquivo
  const c = e.contribuinte!;
  const linhas: string[] = [];
  linhas.push(linha('0000', 'LCDPR', VERSAO_LEIAUTE, cpfProdutor, limparTexto(c.nome), 0, 0, '', inicio, `3112${e.ano}`));
  linhas.push(linha('0010', 1));
  linhas.push(
    linha(
      '0030',
      limparTexto(c.endereco, 150),
      limparTexto(c.numero, 6),
      limparTexto(c.complemento, 50),
      limparTexto(c.bairro, 50),
      String(c.uf).toUpperCase(),
      apenasDigitos(c.codMunicipio),
      apenasDigitos(c.cep),
      apenasDigitos(c.telefone).slice(0, 15),
      limparTexto(c.email, 115),
    ),
  );

  for (const i of imoveisUsados) {
    const f = i.fiscal!;
    const cod = codImovel.get(i.fazendaId)!;
    linhas.push(
      linha(
        '0040',
        cod,
        'BR',
        'BRL',
        apenasDigitos(f.codItr),
        apenasDigitos(f.caepf),
        apenasDigitos(f.inscricaoEstadual).slice(0, 14),
        limparTexto(i.nomeFazenda, 50),
        limparTexto(f.endereco, 150),
        limparTexto(f.numero, 6),
        limparTexto(f.complemento, 50),
        limparTexto(f.bairro, 50),
        String(i.uf).toUpperCase(),
        apenasDigitos(f.codMunicipio),
        apenasDigitos(f.cep),
        f.tipoExploracao,
        percentual(f.participacaoPct),
      ),
    );
    if (f.participacaoPct < 100 || f.tipoExploracao !== 1) {
      for (const t of f.contrapartes) {
        linhas.push(linha('0045', cod, t.tipo, apenasDigitos(t.documento), limparTexto(t.nome, 50), percentual(t.percentual)));
      }
    }
  }

  for (const conta of contasUsadas) {
    linhas.push(
      linha('0050', codConta.get(conta.id), 'BR', apenasDigitos(conta.banco), limparTexto(conta.nomeBanco, 30), apenasDigitos(conta.agencia), pad(apenasDigitos(conta.numeroConta), 16)),
    );
  }

  linhas.push(...q100);

  for (const [mes, m] of [...porMes.entries()].sort((a, b) => a[0].slice(2).localeCompare(b[0].slice(2)) || a[0].localeCompare(b[0]))) {
    linhas.push(linha('Q200', mes, m.entrada, m.saida, Math.abs(m.saldo), m.saldo >= 0 ? 'P' : 'N'));
  }

  const ct = c.contador ?? {};
  // QTD_LIN conta TODAS as linhas, inclusive a própria 9999
  linhas.push(
    linha(
      '9999',
      limparTexto(ct.nome),
      apenasDigitos(ct.doc),
      limparTexto(ct.crc),
      limparTexto(ct.email, 115),
      apenasDigitos(ct.fone).slice(0, 15),
      linhas.length + 1,
    ),
  );

  return {
    pronto: true,
    texto: linhas.join('\r\n') + '\r\n',
    nomeArquivo,
    pendencias,
    excluidos,
    resumo: { ...resumoBase, linhasArquivo: linhas.length },
  };
}

