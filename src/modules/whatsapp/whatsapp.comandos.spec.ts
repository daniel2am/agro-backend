import {
  adivinharCategoria, extrairNumeros, hojeEmBrasilia, interpretarTexto, lerData, resumoDoComando, validarComando,
} from './whatsapp.comandos';

const HOJE = '2026-10-08';
const ok = (txt: string) => {
  const r = interpretarTexto(txt, HOJE);
  if (!('comando' in r)) throw new Error(`não interpretou: "${txt}" → ${JSON.stringify(r)}`);
  return r.comando;
};

describe('extrairNumeros', () => {
  const valores = (t: string) => extrairNumeros(t).map((n) => n.valor);
  it('formatos brasileiros', () => {
    expect(valores('R$ 1.200,50')).toEqual([1200.5]);
    expect(valores('1200')).toEqual([1200]);
    expect(valores('1.200')).toEqual([1200]); // ponto de milhar
    expect(valores('450,75')).toEqual([450.75]);
    expect(valores('25.5')).toEqual([25.5]); // ponto decimal
  });
  it('"mil" e "k"', () => {
    expect(valores('2 mil')).toEqual([2000]);
    expect(valores('1,5 mil')).toEqual([1500]);
    expect(valores('3k')).toEqual([3000]);
  });
  it('marca quem tem R$', () => {
    const n = extrairNumeros('12 bezerros a R$ 2800');
    expect(n.map((x) => x.temMoeda)).toEqual([false, true]);
  });
  it('vários números', () => {
    expect(valores('vendi 12 bezerros a 2800 cada')).toEqual([12, 2800]);
  });
});

describe('lerData', () => {
  it('hoje por padrão, ontem, anteontem', () => {
    expect(lerData('choveu 25', HOJE)).toBe('2026-10-08');
    expect(lerData('choveu ontem', HOJE)).toBe('2026-10-07');
    expect(lerData('choveu anteontem', HOJE)).toBe('2026-10-06');
  });
  it('dd/mm e dd/mm/aaaa; virada de mês', () => {
    expect(lerData('dia 03/10', HOJE)).toBe('2026-10-03');
    expect(lerData('em 15/09/2026', HOJE)).toBe('2026-09-15');
    expect(lerData('ontem', '2026-10-01')).toBe('2026-09-30');
  });
  it('data futura ou impossível vira hoje', () => {
    expect(lerData('dia 25/12', HOJE)).toBe(HOJE);
    expect(lerData('dia 31/02', HOJE)).toBe(HOJE);
  });
  it('hojeEmBrasilia usa o fuso de Brasília', () => {
    expect(hojeEmBrasilia(new Date('2026-10-08T02:00:00Z'))).toBe('2026-10-07'); // 23h do dia 7 em Brasília
    expect(hojeEmBrasilia(new Date('2026-10-08T15:00:00Z'))).toBe('2026-10-08');
  });
});

describe('despesas', () => {
  it('"gastei 450 com ração"', () => {
    expect(ok('gastei 450 com ração')).toMatchObject({ tipo: 'despesa', valor: 450, categoria: 'racao', data: HOJE });
  });
  it('"Paguei R$ 1.200,50 de combustível"', () => {
    expect(ok('Paguei R$ 1.200,50 de combustível')).toMatchObject({ tipo: 'despesa', valor: 1200.5, categoria: 'combustivel' });
  });
  it('sanidade, mão de obra, manutenção, sementes, insumos, frete, energia', () => {
    expect(ok('gastei 300 com vacina aftosa')).toMatchObject({ categoria: 'sanidade' });
    expect(ok('paguei 1800 de salário do vaqueiro')).toMatchObject({ categoria: 'mao_de_obra' });
    expect(ok('gastei 900 no conserto do trator')).toMatchObject({ categoria: 'manutencao' });
    expect(ok('comprei sementes de soja por 5 mil')).toMatchObject({ categoria: 'sementes', valor: 5000 });
    expect(ok('comprei adubo 12000')).toMatchObject({ categoria: 'insumos' });
    expect(ok('paguei o frete 650')).toMatchObject({ categoria: 'frete' });
    expect(ok('paguei a conta de energia 380')).toMatchObject({ categoria: 'energia' });
  });
  it('compra de animais não vira ração/sanidade', () => {
    expect(ok('comprei 10 bezerros por 25 mil')).toMatchObject({ tipo: 'despesa', categoria: 'compra_animais', valor: 25000 });
  });
  it('sem categoria reconhecida: segue sem (o produtor vê e confirma)', () => {
    const c: any = ok('gastei 120 com coisas da cidade');
    expect(c.tipo).toBe('despesa');
    expect(c.categoria).toBeUndefined();
  });
  it('ontem e data explícita', () => {
    expect(ok('gastei 450 com ração ontem')).toMatchObject({ data: '2026-10-07' });
    expect(ok('paguei 200 de diesel dia 03/10')).toMatchObject({ data: '2026-10-03' });
  });
  it('mantém o texto original como descrição', () => {
    expect((ok('gastei 450 com ração') as any).descricao).toBe('gastei 450 com ração');
  });
});

describe('receitas', () => {
  it('quantidade × preço unitário ("cada")', () => {
    const c: any = ok('vendi 12 bezerros a 2800 cada');
    expect(c).toMatchObject({ tipo: 'receita', valor: 33600, categoria: 'venda_gado' });
  });
  it('o número depois de "por/a/de" é o valor, não a quantidade', () => {
    expect(ok('vendi 2 bois por 9 mil')).toMatchObject({ valor: 9000 });
    expect(ok('vendi 3 bezerros por 7500')).toMatchObject({ valor: 7500 });
    expect(ok('paguei 2 diárias de 150 cada')).toMatchObject({ valor: 300 });
    expect(ok('gastei 450 com 3 sacos de ração')).toMatchObject({ valor: 450 });
  });
  it('valor total direto', () => {
    expect(ok('vendi 3 bois por R$ 15.000')).toMatchObject({ tipo: 'receita', valor: 15000, categoria: 'venda_gado' });
    expect(ok('recebi 4500 do leite')).toMatchObject({ tipo: 'receita', valor: 4500, categoria: 'leite' });
  });
  it('lavoura', () => {
    expect(ok('vendi a soja 82000')).toMatchObject({ tipo: 'receita', categoria: 'venda_lavoura', valor: 82000 });
    expect(ok('vendi 500 sacas de milho a 55 cada')).toMatchObject({ valor: 27500, categoria: 'venda_lavoura' });
  });
  it('"vendi X para comprar Y": vale o primeiro verbo', () => {
    expect(ok('vendi 2 bois por 9 mil para comprar ração')).toMatchObject({ tipo: 'receita', valor: 9000 });
  });
});

describe('chuva', () => {
  it('formas comuns', () => {
    expect(ok('choveu 25 mm')).toEqual({ tipo: 'chuva', mm: 25, data: HOJE });
    expect(ok('chuva 12,5')).toEqual({ tipo: 'chuva', mm: 12.5, data: HOJE });
    expect(ok('choveu 30mm ontem')).toEqual({ tipo: 'chuva', mm: 30, data: '2026-10-07' });
    expect(ok('40 mm de chuva')).toMatchObject({ tipo: 'chuva', mm: 40 });
  });
  it('sem número pede o valor; valor absurdo é recusado', () => {
    expect(interpretarTexto('choveu bastante', HOJE)).toMatchObject({ erro: 'falta_valor' });
    expect(interpretarTexto('choveu 900 mm', HOJE)).toMatchObject({ erro: 'valor_invalido' });
  });
});

describe('pesagem', () => {
  it('formas comuns', () => {
    expect(ok('pesagem 1234 456 kg')).toEqual({ tipo: 'pesagem', brinco: '1234', pesoKg: 456, data: HOJE });
    expect(ok('brinco 1234 pesou 456')).toMatchObject({ brinco: '1234', pesoKg: 456 });
    expect(ok('peso BR-001 470,5')).toMatchObject({ brinco: 'BR-001', pesoKg: 470.5 });
    expect(ok('pesei a vaca 77 com 380 kg')).toMatchObject({ brinco: '77', pesoKg: 380 });
  });
  it('peso fora da faixa é recusado; sem estrutura, orienta', () => {
    expect(interpretarTexto('pesagem 1234 5 kg', HOJE)).toMatchObject({ erro: 'valor_invalido' });
    expect(interpretarTexto('pesagem 1234 9000 kg', HOJE)).toMatchObject({ erro: 'valor_invalido' });
    expect(interpretarTexto('pesagem do lote', HOJE)).toMatchObject({ erro: 'nao_entendi' });
  });
});

describe('comandos simples', () => {
  it('ajuda, resumo, fazenda', () => {
    for (const t of ['ajuda', 'Oi', 'bom dia', 'menu', '?']) expect(ok(t)).toEqual({ tipo: 'ajuda' });
    for (const t of ['resumo', 'saldo', 'Como estou']) expect(ok(t)).toEqual({ tipo: 'resumo' });
    expect(ok('fazenda Boa Vista')).toEqual({ tipo: 'fazenda', nome: 'boa vista' });
  });
});

describe('o que NÃO entende', () => {
  it('conversa solta e mensagem vazia', () => {
    expect(interpretarTexto('', HOJE)).toMatchObject({ erro: 'nao_entendi' });
    expect(interpretarTexto('qual a previsão do tempo amanhã?', HOJE)).toMatchObject({ erro: 'nao_entendi' });
  });
  it('financeiro sem valor', () => {
    expect(interpretarTexto('gastei com ração', HOJE)).toMatchObject({ erro: 'falta_valor' });
  });
  it('valor zero ou gigante é recusado', () => {
    expect(interpretarTexto('gastei 0 com ração', HOJE)).toMatchObject({ erro: 'valor_invalido' });
    expect(interpretarTexto('vendi tudo por 99999999999', HOJE)).toMatchObject({ erro: 'valor_invalido' });
  });
});

describe('validarComando (saída da IA não é confiável)', () => {
  it('aceita um comando correto e limpa o texto', () => {
    expect(validarComando({ tipo: 'despesa', valor: 450, descricao: 'Ração | sal\nmineral', categoria: 'racao', data: '2026-10-05' }, HOJE)).toEqual({
      tipo: 'despesa', valor: 450, descricao: 'Ração sal mineral', categoria: 'racao', data: '2026-10-05',
    });
  });
  it('categoria fora da lista (ou de outro tipo) é descartada', () => {
    expect((validarComando({ tipo: 'despesa', valor: 10, descricao: 'x', categoria: 'inventada' }, HOJE) as any).categoria).toBeUndefined();
    expect((validarComando({ tipo: 'receita', valor: 10, descricao: 'x', categoria: 'racao' }, HOJE) as any).categoria).toBeUndefined();
  });
  it('data futura ou malformada vira hoje', () => {
    expect((validarComando({ tipo: 'chuva', mm: 10, data: '2030-01-01' }, HOJE) as any).data).toBe(HOJE);
    expect((validarComando({ tipo: 'chuva', mm: 10, data: 'ontem' }, HOJE) as any).data).toBe(HOJE);
  });
  it('recusa valor negativo, texto, NaN, tipo desconhecido e objeto vazio', () => {
    expect(validarComando({ tipo: 'despesa', valor: -5, descricao: 'x' }, HOJE)).toBeNull();
    expect(validarComando({ tipo: 'despesa', valor: '450', descricao: 'x' }, HOJE)).toBeNull();
    expect(validarComando({ tipo: 'despesa', valor: NaN, descricao: 'x' }, HOJE)).toBeNull();
    expect(validarComando({ tipo: 'despesa', valor: 1e9, descricao: 'x' }, HOJE)).toBeNull();
    expect(validarComando({ tipo: 'apagar_tudo' }, HOJE)).toBeNull();
    expect(validarComando(null, HOJE)).toBeNull();
    expect(validarComando('texto', HOJE)).toBeNull();
  });
  it('pesagem: brinco limpo e peso na faixa; chuva na faixa', () => {
    expect(validarComando({ tipo: 'pesagem', brinco: ' br-001!! ', pesoKg: 450 }, HOJE)).toMatchObject({ brinco: 'BR-001' });
    expect(validarComando({ tipo: 'pesagem', brinco: '1', pesoKg: 5 }, HOJE)).toBeNull();
    expect(validarComando({ tipo: 'chuva', mm: 600 }, HOJE)).toBeNull();
  });
  it('a IA não consegue criar comandos de resumo/ajuda/fazenda (só registros)', () => {
    expect(validarComando({ tipo: 'resumo' }, HOJE)).toBeNull();
    expect(validarComando({ tipo: 'fazenda', nome: 'x' }, HOJE)).toBeNull();
  });
});

describe('resumoDoComando / adivinharCategoria', () => {
  it('texto de confirmação com valor em reais, categoria, data e fazenda', () => {
    const t = resumoDoComando({ tipo: 'receita', valor: 33600, descricao: 'vendi 12 bezerros', categoria: 'venda_gado', data: HOJE }, 'Boa Vista');
    expect(t).toContain('Receita');
    expect(t).toMatch(/R\$\s*33\.600,00/);
    expect(t).toContain('Venda de gado');
    expect(t).toContain('08/10/2026');
    expect(t).toContain('Boa Vista');
  });
  it('chuva e pesagem', () => {
    expect(resumoDoComando({ tipo: 'chuva', mm: 12.5, data: HOJE }, 'F')).toContain('12,5 mm');
    expect(resumoDoComando({ tipo: 'pesagem', brinco: '77', pesoKg: 380, data: HOJE }, 'F')).toContain('brinco 77');
  });
  it('categoria por palavra-chave, sem depender de acento', () => {
    expect(adivinharCategoria('despesa', 'racao do gado')).toBe('racao');
    expect(adivinharCategoria('receita', 'venda do leite')).toBe('leite');
    expect(adivinharCategoria('despesa', 'xyz')).toBeUndefined();
  });
});
