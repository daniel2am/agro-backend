import {
  DadosDaFazenda, ESCOPOS, decidirPatrocinio, escoposConcedidos, gerarCodigo, gmdMedio, limparEscopos, montarCartao,
  normalizarCodigo, situacaoDoConvite,
} from './parceiro.regras';

const agora = new Date('2026-10-08T12:00:00Z');
const dados: DadosDaFazenda = {
  animaisAtivos: 120, gmdMedioKgDia: 0.7234, animaisAvaliados: 80, areaHa: 850.456, invernadas: 6, lavouras: 2,
  cidade: 'Campo Grande', estado: 'MS', produtorNome: 'Daniel', produtorEmail: 'd@x.com',
};

describe('escopos', () => {
  it('só os da lista fechada, sem repetição, em ordem canônica', () => {
    expect(limparEscopos(['contato', 'rebanho', 'rebanho', 'financeiro', 'cpf', 42])).toEqual(['rebanho', 'contato']);
    expect(limparEscopos(null)).toEqual([]);
    expect(limparEscopos('rebanho')).toEqual([]);
  });
  it('a lista fechada não tem nada financeiro nem de documento', () => {
    expect(ESCOPOS.join(',')).not.toMatch(/financ|cpf|cnpj|\bconta\b|lancamento|banco/i);
  });
  it('o produtor concede no máximo o que foi pedido', () => {
    expect(escoposConcedidos(['rebanho', 'area'], ['rebanho', 'area', 'contato', 'localizacao'])).toEqual(['rebanho', 'area']);
    expect(escoposConcedidos(['rebanho', 'area'], ['area'])).toEqual(['area']);
    expect(escoposConcedidos(['rebanho'], [])).toEqual([]);
  });
});

describe('código do convite', () => {
  it('formato XXXX-XXXX sem caracteres ambíguos', () => {
    for (let i = 0; i < 200; i++) expect(gerarCodigo()).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(gerarCodigo(() => 0)).toBe('AAAA-AAAA');
  });
  it('aceita o código digitado de qualquer jeito', () => {
    expect(normalizarCodigo('k7m2-9qxp')).toBe('K7M2-9QXP');
    expect(normalizarCodigo(' K7M2 9QXP ')).toBe('K7M2-9QXP');
    expect(normalizarCodigo('K7M29QXP')).toBe('K7M2-9QXP');
  });
  it('recusa tamanho errado ou caractere que não existe no alfabeto', () => {
    expect(normalizarCodigo('K7M2')).toBeNull();
    expect(normalizarCodigo('K7M2-9QX0')).toBeNull(); // 0 não existe
    expect(normalizarCodigo('K7M2-9QXI')).toBeNull(); // I não existe
    expect(normalizarCodigo(undefined)).toBeNull();
  });
});

describe('situacaoDoConvite', () => {
  const base = { ativo: true, validoAte: new Date('2026-12-01'), usos: 0, usosMax: 3 };
  it('ok, desativado, vencido, esgotado (nesta ordem de precedência)', () => {
    expect(situacaoDoConvite(base, agora)).toBe('ok');
    expect(situacaoDoConvite({ ...base, ativo: false, usos: 9 }, agora)).toBe('desativado');
    expect(situacaoDoConvite({ ...base, validoAte: new Date('2026-10-08T12:00:00Z') }, agora)).toBe('vencido');
    expect(situacaoDoConvite({ ...base, usos: 3 }, agora)).toBe('esgotado');
  });
});

describe('decidirPatrocinio', () => {
  const oferta = { plano: 'intermediario' as const, meses: 12 };
  it('básico → recebe o plano por N meses', () => {
    const d = decidirPatrocinio({ plano: 'basico', planoAteEm: null }, oferta, agora);
    expect(d).toMatchObject({ conceder: true, plano: 'intermediario' });
    expect(d.ateEm!.toISOString().slice(0, 10)).toBe('2027-10-08');
  });
  it('sem plano na oferta (ou 0 meses) não patrocina', () => {
    expect(decidirPatrocinio({ plano: 'basico', planoAteEm: null }, { plano: 'basico', meses: 12 }, agora).motivo).toBe('sem_patrocinio');
    expect(decidirPatrocinio({ plano: 'basico', planoAteEm: null }, { plano: 'avancado', meses: 0 }, agora).conceder).toBe(false);
  });
  it('NUNCA rebaixa: quem tem plano melhor em vigor (inclusive teste) fica como está', () => {
    const teste = decidirPatrocinio({ plano: 'avancado', planoAteEm: new Date('2026-10-20') }, oferta, agora);
    expect(teste).toMatchObject({ conceder: false, motivo: 'plano_atual_igual_ou_melhor' });
  });
  it('plano melhor VENCIDO conta como básico: o patrocínio vale', () => {
    expect(decidirPatrocinio({ plano: 'avancado', planoAteEm: new Date('2026-09-01') }, oferta, agora).conceder).toBe(true);
  });
  it('mesmo plano: só estende se o patrocínio vence depois; plano sem vencimento nunca é trocado', () => {
    expect(decidirPatrocinio({ plano: 'intermediario', planoAteEm: new Date('2026-12-01') }, oferta, agora).conceder).toBe(true);
    expect(decidirPatrocinio({ plano: 'intermediario', planoAteEm: new Date('2028-01-01') }, oferta, agora).conceder).toBe(false);
    expect(decidirPatrocinio({ plano: 'intermediario', planoAteEm: null }, oferta, agora).conceder).toBe(false);
  });
  it('plano menor em vigor é elevado', () => {
    expect(decidirPatrocinio({ plano: 'intermediario', planoAteEm: new Date('2026-12-01') }, { plano: 'avancado', meses: 6 }, agora).conceder).toBe(true);
  });
});

describe('montarCartao', () => {
  it('só os blocos autorizados', () => {
    expect(montarCartao(['rebanho'], dados)).toEqual({ rebanho: { animaisAtivos: 120 } });
    expect(Object.keys(montarCartao(['rebanho', 'desempenho', 'area', 'localizacao', 'contato'], dados))).toEqual(['rebanho', 'desempenho', 'area', 'localizacao', 'contato']);
  });
  it('sem escopo, cartão vazio: nem o contato vaza', () => {
    expect(montarCartao([], dados)).toEqual({});
  });
  it('escopo inventado ou sensível é ignorado e não adiciona campos', () => {
    const c: any = montarCartao(['financeiro', 'cpf', 'rebanho'], dados);
    expect(Object.keys(c)).toEqual(['rebanho']);
    expect(JSON.stringify(c)).not.toMatch(/produtor|@|cpf|valor/i);
  });
  it('arredonda GMD e área; GMD nulo continua nulo', () => {
    const c = montarCartao(['desempenho', 'area'], dados);
    expect(c.desempenho).toEqual({ gmdMedioKgDia: 0.72, animaisAvaliados: 80 });
    expect(c.area).toEqual({ areaHa: 850.46, invernadas: 6, lavouras: 2 });
    expect(montarCartao(['desempenho'], { ...dados, gmdMedioKgDia: null }).desempenho!.gmdMedioKgDia).toBeNull();
  });
});

describe('gmdMedio', () => {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  it('média entre animais com 2+ pesagens em dias diferentes', () => {
    const r = gmdMedio([
      { animalId: 'a', data: d('2026-01-01'), pesoKg: 400 }, { animalId: 'a', data: d('2026-04-11'), pesoKg: 500 }, // 1,0
      { animalId: 'b', data: d('2026-01-01'), pesoKg: 300 }, { animalId: 'b', data: d('2026-04-11'), pesoKg: 330 }, // 0,3
      { animalId: 'c', data: d('2026-01-01'), pesoKg: 300 }, // 1 pesagem: ignora
    ]);
    expect(r.avaliados).toBe(2);
    expect(r.gmd).toBeCloseTo(0.65, 5);
  });
  it('sem dados suficientes: nulo', () => {
    expect(gmdMedio([])).toEqual({ gmd: null, avaliados: 0 });
    expect(gmdMedio([{ animalId: 'a', data: d('2026-01-01'), pesoKg: 400 }, { animalId: 'a', data: d('2026-01-01'), pesoKg: 410 }]).gmd).toBeNull();
  });
});
