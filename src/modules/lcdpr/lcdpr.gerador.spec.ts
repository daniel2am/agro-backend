import {
  ContaEntrada, ContribuinteEntrada, EntradaLcdpr, ImovelEntrada, LancamentoEntrada,
  ddmmaaaa, emCentavos, gerarLcdpr, limparTexto,
} from './lcdpr.gerador';

// CPFs/CNPJ válidos (dígitos verificadores conferidos)
const CPF_PRODUTOR = '529.982.247-25';
const CPF_COMPRADOR = '111.444.777-35';
const CNPJ_FORNECEDOR = '11.222.333/0001-81';

const contribuinte: ContribuinteEntrada = {
  cpf: CPF_PRODUTOR, nome: 'JOSÉ DA SILVA', endereco: 'RUA TESTE', numero: '1234', complemento: 'BLOCO Z',
  bairro: 'CENTRO', uf: 'MS', codMunicipio: '5002704', cep: '79000-000', telefone: '(67) 3333-3333', email: 'jose@exemplo.com',
};

const imovelOk = (over: Partial<NonNullable<ImovelEntrada['fiscal']>> = {}): ImovelEntrada => ({
  fazendaId: 'f1', nomeFazenda: 'Fazenda Tudo Certo', uf: 'MS',
  fiscal: {
    codItr: '12345678', caepf: '12345678901234', inscricaoEstadual: '28.123.123-7',
    endereco: 'Rodovia BR 163, Km 30', numero: null, complemento: null, bairro: 'Zona Rural',
    cep: '79000000', codMunicipio: '5002704', tipoExploracao: 1, participacaoPct: 100, contrapartes: [], ...over,
  },
});

const conta: ContaEntrada = { id: 'c1', banco: '001', nomeBanco: 'Banco do Brasil', agencia: '1234', numeroConta: '12345678-9' };

const l = (id: string, data: string, tipo: 'receita' | 'despesa', valor: number, extra: Partial<LancamentoEntrada> = {}): LancamentoEntrada => ({
  id, fazendaId: 'f1', data: new Date(`${data}T12:00:00Z`), descricao: id, valor, tipo,
  categoria: tipo === 'receita' ? 'venda_lavoura' : 'insumos', contaBancariaId: 'c1', documentoTipo: 3,
  documentoNumero: null, contraparteDoc: CPF_COMPRADOR, ...extra,
});

const base = (lancamentos: LancamentoEntrada[], over: Partial<EntradaLcdpr> = {}): EntradaLcdpr => ({
  ano: 2026, contribuinte, imoveis: [imovelOk()], contas: [conta], lancamentos, ...over,
});

describe('formatação', () => {
  it('centavos sem separador e sem sinal (exemplos do manual)', () => {
    expect(emCentavos(1129998.99)).toBe('112999899');
    expect(emCentavos(1255.42)).toBe('125542');
    expect(emCentavos(10000)).toBe('1000000');
    expect(emCentavos(0)).toBe('0');
    expect(emCentavos(234.567)).toBe('23457'); // arredonda
  });
  it('data ddmmaaaa no fuso de Brasília (22h local ainda é o mesmo dia)', () => {
    expect(ddmmaaaa(new Date('2026-01-02T12:00:00Z'))).toBe('02012026');
    expect(ddmmaaaa(new Date('2026-03-05T01:00:00Z'))).toBe('04032026'); // 22h do dia 4 em Brasília
  });
  it('texto livre: sem pipe, sem controle, com limite, acentos preservados', () => {
    expect(limparTexto('Venda | 100 sacas\r\nde milho')).toBe('Venda 100 sacas de milho');
    expect(limparTexto('açúcar e ç', 255)).toBe('açúcar e ç');
    expect(limparTexto('x'.repeat(100), 50)).toHaveLength(50);
  });
});

describe('arquivo completo (formato do manual, leiaute 1.3)', () => {
  const saida = gerarLcdpr(
    base([
      l('Venda de 100 sacas de milho', '2026-01-02', 'receita', 10000, { documentoNumero: '2', documentoTipo: 3 }),
      l('Pagamento de sementes e outros insumos', '2026-01-02', 'despesa', 5000, { documentoNumero: '3', documentoTipo: 1, contraparteDoc: CNPJ_FORNECEDOR }),
    ]),
  );
  const linhas = saida.texto!.split('\r\n');

  it('fica pronto, sem bloqueios', () => {
    expect(saida.pronto).toBe(true);
    expect(saida.pendencias.filter((p) => p.gravidade === 'bloqueio')).toEqual([]);
    expect(saida.nomeArquivo).toBe('LCDPR_52998224725_2026.txt');
  });

  it('linhas terminam em CR LF (inclusive a última) e começam na coluna 1', () => {
    expect(saida.texto!.endsWith('\r\n')).toBe(true);
    expect(saida.texto!.split('\n').slice(0, -1).every((x) => x.endsWith('\r'))).toBe(true);
    expect(linhas.slice(0, -1).every((x) => /^[0-9Q]/.test(x))).toBe(true);
  });

  it('registros na ordem do manual', () => {
    const regs = linhas.slice(0, -1).map((x) => x.split('|')[0]);
    expect(regs).toEqual(['0000', '0010', '0030', '0040', '0050', 'Q100', 'Q100', 'Q200', '9999']);
  });

  it('0000, 0010 e 0030 exatamente como no manual', () => {
    expect(linhas[0]).toBe('0000|LCDPR|0013|52998224725|JOSÉ DA SILVA|0|0||01012026|31122026');
    expect(linhas[1]).toBe('0010|1');
    expect(linhas[2]).toBe('0030|RUA TESTE|1234|BLOCO Z|CENTRO|MS|5002704|79000000|6733333333|jose@exemplo.com');
  });

  it('0040 tem 17 campos, participação com 5 dígitos; 0050 com conta de 16 dígitos', () => {
    expect(linhas[3]).toBe('0040|001|BR|BRL|12345678|12345678901234|28123123 7'.replace(' ', '') + '|Fazenda Tudo Certo|Rodovia BR 163, Km 30|||Zona Rural|MS|5002704|79000000|1|10000');
    expect(linhas[3]!.split('|')).toHaveLength(17);
    expect(linhas[4]).toBe('0050|001|BR|001|Banco do Brasil|1234|0000000123456789');
  });

  it('Q100: mesma estrutura do exemplo do manual, saldo corrente e natureza', () => {
    expect(linhas[5]).toBe('Q100|02012026|001|001|2|3|Venda de 100 sacas de milho|11144477735|1|1000000|0|1000000|P');
    expect(linhas[6]).toBe('Q100|02012026|001|001|3|1|Pagamento de sementes e outros insumos|11222333000181|2|0|500000|500000|P');
    expect(linhas[5]!.split('|')).toHaveLength(13);
  });

  it('Q200 resume o mês com saldo acumulado; 9999 conta todas as linhas, inclusive ela mesma', () => {
    expect(linhas[7]).toBe('Q200|012026|1000000|500000|500000|P');
    expect(linhas[8]).toBe('9999||||||9');
    expect(saida.resumo).toMatchObject({ lancamentos: 2, receitas: 10000, despesas: 5000, resultado: 5000, linhasArquivo: 9 });
  });
});

describe('saldo e resumo mensal', () => {
  it('saldo acumulado atravessa os meses; fica negativo (N) quando a despesa supera a receita', () => {
    const s = gerarLcdpr(
      base([
        l('r1', '2026-01-10', 'receita', 100000),
        l('d1', '2026-01-20', 'despesa', 85000),
        l('r2', '2026-02-05', 'receita', 90000),
        l('d2', '2026-02-25', 'despesa', 93000),
        l('d3', '2026-03-10', 'despesa', 50000),
      ]),
    );
    const q200 = s.texto!.split('\r\n').filter((x) => x.startsWith('Q200'));
    expect(q200).toEqual([
      'Q200|012026|10000000|8500000|1500000|P', // exemplo do manual (jan)
      'Q200|022026|9000000|9300000|1200000|P', //   saldo acumulado 15.000 − 3.000 (fev)
      'Q200|032026|0|5000000|3800000|N', //          12.000 − 50.000 = −38.000
    ]);
    const q100 = s.texto!.split('\r\n').filter((x) => x.startsWith('Q100'));
    expect(q100[4]!.endsWith('|0|5000000|3800000|N')).toBe(true);
  });

  it('ordena por data mesmo se vierem embaralhados e mantém a ordem de lançamentos do mesmo dia', () => {
    const s = gerarLcdpr(base([l('b', '2026-05-02', 'despesa', 10), l('a', '2026-05-01', 'receita', 100), l('c', '2026-05-02', 'receita', 5)]));
    const q100 = s.texto!.split('\r\n').filter((x) => x.startsWith('Q100'));
    expect(q100.map((x) => x.split('|')[6])).toEqual(['a', 'b', 'c']);
    expect(q100[0]!.split('|')[11]).toBe('10000'); // saldo após a receita de 100,00
  });

  it('só entra o ano pedido (31/12 à noite em Brasília é 2025; 01/01 02h UTC ainda é 2025)', () => {
    const s = gerarLcdpr(
      base([
        { ...l('velho', '2025-12-31', 'receita', 100), data: new Date('2026-01-01T02:00:00Z') }, // 31/12/2025 23h em Brasília
        l('novo', '2026-01-02', 'receita', 100),
      ]),
    );
    expect(s.resumo.lancamentos).toBe(1);
  });
});

describe('pendências que BLOQUEIAM o arquivo', () => {
  const codigos = (s: ReturnType<typeof gerarLcdpr>) => s.pendencias.filter((p) => p.gravidade === 'bloqueio').map((p) => p.codigo);

  it('sem contribuinte', () => {
    const s = gerarLcdpr(base([l('r', '2026-01-02', 'receita', 100)], { contribuinte: null }));
    expect(s.pronto).toBe(false);
    expect(s.texto).toBeNull();
    expect(codigos(s)).toContain('contribuinte_ausente');
  });

  it('contribuinte com CPF inválido, CEP curto, e-mail ruim', () => {
    const s = gerarLcdpr(base([l('r', '2026-01-02', 'receita', 100)], { contribuinte: { ...contribuinte, cpf: '111.111.111-11', cep: '123', email: 'x' } }));
    expect(codigos(s)).toEqual(['contribuinte_invalido']);
    const msg = s.pendencias[0]!.mensagem;
    expect(msg).toContain('CPF inválido');
    expect(msg).toContain('CEP');
    expect(msg).toContain('e-mail');
  });

  it('fazenda com lançamentos mas sem dados fiscais', () => {
    const s = gerarLcdpr(base([l('r', '2026-01-02', 'receita', 100)], { imoveis: [{ fazendaId: 'f1', nomeFazenda: 'Fazenda X', uf: 'MS', fiscal: null }] }));
    expect(codigos(s)).toEqual(['imovel_ausente']);
    expect(s.pendencias[0]!.fazendaId).toBe('f1');
  });

  it('fazenda sem lançamentos e sem configuração não atrapalha', () => {
    const s = gerarLcdpr(base([l('r', '2026-01-02', 'receita', 100)], { imoveis: [imovelOk(), { fazendaId: 'f2', nomeFazenda: 'Parada', uf: 'MS', fiscal: null }] }));
    expect(s.pronto).toBe(true);
    expect(s.texto!.match(/^0040\|/gm)).toHaveLength(1);
  });

  it('imóvel sem CAFIR/CAEPF ou com CEP ruim', () => {
    const s = gerarLcdpr(base([l('r', '2026-01-02', 'receita', 100)], { imoveis: [imovelOk({ codItr: null, caepf: null, cep: '12' })] }));
    expect(codigos(s)).toEqual(['imovel_invalido']);
    expect(s.pendencias[0]!.mensagem).toMatch(/CAFIR.*CAEPF.*CEP/);
  });

  it('participação menor que 100% exige terceiros (0045); com terceiros gera o registro e avisa', () => {
    const sem = gerarLcdpr(base([l('r', '2026-01-02', 'receita', 100)], { imoveis: [imovelOk({ participacaoPct: 50, tipoExploracao: 2 })] }));
    expect(codigos(sem)).toEqual(['terceiros_ausentes']);

    const com = gerarLcdpr(
      base([l('r', '2026-01-02', 'receita', 100)], {
        imoveis: [imovelOk({ participacaoPct: 50, tipoExploracao: 2, contrapartes: [{ tipo: 1, documento: CPF_COMPRADOR, nome: 'João de Sousa', percentual: 50 }] })],
      }),
    );
    expect(com.pronto).toBe(true);
    expect(com.texto).toContain('\r\n0045|001|1|11144477735|João de Sousa|05000\r\n');
    expect(com.texto).toContain('|2|05000\r\n'); // 0040: condomínio, 50%
    expect(com.pendencias.some((p) => p.codigo === 'participacao')).toBe(true);
  });

  it('terceiro com CPF inválido', () => {
    const s = gerarLcdpr(
      base([l('r', '2026-01-02', 'receita', 100)], {
        imoveis: [imovelOk({ participacaoPct: 50, tipoExploracao: 2, contrapartes: [{ tipo: 1, documento: '123', nome: 'X', percentual: 50 }] })],
      }),
    );
    expect(codigos(s)).toContain('terceiro_invalido');
  });

  it('lançamento sem CPF/CNPJ de quem pagou/recebeu — nunca inventa', () => {
    const s = gerarLcdpr(base([l('compra de adubo', '2026-01-02', 'despesa', 100, { contraparteDoc: null })]));
    expect(codigos(s)).toEqual(['sem_participante']);
    expect(s.pendencias[0]!.lancamentoId).toBe('compra de adubo');
    expect(s.texto).toBeNull();
  });

  it('CPF/CNPJ inválido do participante também bloqueia', () => {
    const s = gerarLcdpr(base([l('x', '2026-01-02', 'despesa', 100, { contraparteDoc: '11.222.333/0001-82' })]));
    expect(codigos(s)).toEqual(['sem_participante']);
  });

  it('mão de obra sem CPF usa o do produtor (permitido pelo manual)', () => {
    const s = gerarLcdpr(base([l('salários', '2026-01-02', 'despesa', 3000, { categoria: 'mao_de_obra', contraparteDoc: null, documentoTipo: 5 })]));
    expect(s.pronto).toBe(true);
    expect(s.texto).toContain('|salários|52998224725|2|0|300000|');
  });

  it('receita sem categoria: o produtor precisa classificar (não vira receita rural por padrão)', () => {
    const s = gerarLcdpr(base([l('entrada misteriosa', '2026-01-02', 'receita', 100, { categoria: null })]));
    expect(codigos(s)).toEqual(['receita_sem_categoria']);
  });

  it('conta bancária com agência/banco inválidos', () => {
    const s = gerarLcdpr(base([l('r', '2026-01-02', 'receita', 100)], { contas: [{ ...conta, agencia: '12', banco: '1' }] }));
    expect(codigos(s)).toEqual(['conta_invalida']);
  });
});

describe('avisos e exclusões (não bloqueiam)', () => {
  it('receitas que não são da atividade rural ficam FORA, listadas e avisadas', () => {
    const s = gerarLcdpr(
      base([
        l('venda', '2026-01-02', 'receita', 1000),
        l('aluguel de pasto', '2026-01-03', 'receita', 500, { categoria: 'arrendamento_recebido' }),
        l('conserto de terceiros', '2026-01-04', 'receita', 300, { categoria: 'servicos' }),
      ]),
    );
    expect(s.pronto).toBe(true);
    expect(s.excluidos.map((x) => x.id)).toEqual(['aluguel de pasto', 'conserto de terceiros']);
    expect(s.resumo.receitas).toBe(1000);
    expect(s.pendencias.some((p) => p.codigo === 'receitas_fora')).toBe(true);
  });

  it('sem conta: registra como espécie (000) e avisa; sem tipo de documento: "Outros" (6)', () => {
    const s = gerarLcdpr(base([l('r', '2026-01-02', 'receita', 100, { contaBancariaId: null, documentoTipo: null })]));
    expect(s.pronto).toBe(true);
    expect(s.texto).toContain('Q100|02012026|001|000||6|r|');
    expect(s.texto).not.toMatch(/^0050\|/m); // nenhuma conta usada
    expect(s.pendencias.map((p) => p.codigo)).toEqual(expect.arrayContaining(['sem_conta', 'sem_tipo_documento']));
  });

  it('só as contas realmente usadas entram no 0050, renumeradas', () => {
    const s = gerarLcdpr(
      base([l('r', '2026-01-02', 'receita', 100, { contaBancariaId: 'c2' })], {
        contas: [conta, { ...conta, id: 'c2', banco: '237', nomeBanco: 'Bradesco', agencia: '4321', numeroConta: '99999' }],
      }),
    );
    expect(s.texto).toContain('0050|001|BR|237|Bradesco|4321|0000000000099999');
    expect(s.texto).not.toContain('Banco do Brasil');
    expect(s.texto).toContain('Q100|02012026|001|001|');
  });

  it('valores zerados ou negativos saem do livro', () => {
    const s = gerarLcdpr(base([l('zero', '2026-01-02', 'receita', 0), l('ok', '2026-01-03', 'receita', 10)]));
    expect(s.resumo.lancamentos).toBe(1);
    expect(s.excluidos[0]).toMatchObject({ id: 'zero' });
  });

  it('histórico com "|" e quebra de linha não corrompe o arquivo', () => {
    const s = gerarLcdpr(base([l('x', '2026-01-02', 'receita', 100, { descricao: 'Venda | milho\nsafra' })]));
    const q = s.texto!.split('\r\n').find((x) => x.startsWith('Q100'))!;
    expect(q.split('|')).toHaveLength(13);
    expect(q).toContain('Venda milho safra');
  });

  it('ano sem lançamentos: pronto, mas avisa', () => {
    const s = gerarLcdpr(base([]));
    expect(s.pronto).toBe(true);
    expect(s.pendencias.some((p) => p.codigo === 'sem_lancamentos')).toBe(true);
  });

  it('contador (quando informado) vai no 9999', () => {
    const s = gerarLcdpr(
      base([l('r', '2026-01-02', 'receita', 100)], {
        contribuinte: { ...contribuinte, contador: { nome: 'JOSE DE SOUZA', doc: '111.444.777-35', crc: 'AL123456O', email: 'c@c.com', fone: '(61) 3333-3333' } },
      }),
    );
    const ult = s.texto!.split('\r\n').filter(Boolean).pop()!;
    expect(ult).toMatch(/^9999\|JOSE DE SOUZA\|11144477735\|AL123456O\|c@c\.com\|6133333333\|\d+$/);
  });
});
