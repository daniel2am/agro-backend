import {
  COBERTURA_MINIMA, PontoNdvi, calcularTendencia, classificarNdvi, diasDesdeUltimaLeitura, inicioDaGrade,
  intervalosDaGrade, interpretarEstatisticas, quedaForte, textoDaTendencia,
} from './satelite.regras';

const ponto = (inicio: string, media: number | null, cobertura = 0.9): PontoNdvi => {
  const t = Date.parse(`${inicio}T00:00:00Z`) + 10 * 86_400_000;
  return { inicio, fim: new Date(t).toISOString().slice(0, 10), media, minimo: null, maximo: null, desvio: null, cobertura };
};

describe('grade de 10 dias', () => {
  it('o mesmo dia sempre cai no mesmo intervalo, e a grade é de 10 em 10 dias', () => {
    expect(inicioDaGrade('2026-10-08')).toBe(inicioDaGrade(new Date('2026-10-08T23:00:00Z')));
    const a = Date.parse(`${inicioDaGrade('2026-10-08')}T00:00:00Z`);
    const b = Date.parse(`${inicioDaGrade('2026-10-18')}T00:00:00Z`);
    expect(b - a).toBe(10 * 86_400_000);
    expect(inicioDaGrade('2026-10-08') <= '2026-10-08').toBe(true);
  });
  it('intervalos cobrem o período inteiro, sem buraco nem repetição', () => {
    const iv = intervalosDaGrade(new Date('2026-08-01'), new Date('2026-10-08'));
    expect(iv.length).toBeGreaterThanOrEqual(7);
    expect(iv[0]!.inicio <= '2026-08-01').toBe(true);
    expect(iv[iv.length - 1]!.fim >= '2026-10-08').toBe(true);
    for (let i = 1; i < iv.length; i++) expect(iv[i]!.inicio).toBe(iv[i - 1]!.fim);
  });
});

describe('interpretarEstatisticas (formato real da Statistical API)', () => {
  const stats = (mean: any, sampleCount: number, noDataCount: number) => ({
    outputs: { ndvi: { bands: { B0: { stats: { min: 0.1, max: 0.9, mean, stDev: 0.12, sampleCount, noDataCount } } } } },
  });
  const resposta = {
    status: 'OK',
    data: [
      { interval: { from: '2026-09-23T00:00:00Z', to: '2026-10-03T00:00:00Z' }, ...stats(0.61234567, 1000, 100) },
      { interval: { from: '2026-10-03T00:00:00Z', to: '2026-10-13T00:00:00Z' }, ...stats('NaN', 1000, 1000) }, // tudo nuvem
      { interval: { from: '2026-08-14T00:00:00Z', to: '2026-08-24T00:00:00Z' }, ...stats(0.4, 1000, 800) }, // pouca cobertura
    ],
  };
  const pts = interpretarEstatisticas(resposta);

  it('lê média, extremos e cobertura (fração de pixels úteis)', () => {
    expect(pts[0]).toMatchObject({ media: 0.6123, minimo: 0.1, maximo: 0.9, desvio: 0.12, cobertura: 0.9 });
  });
  it('intervalo todo nublado vira ponto com média nula e cobertura 0', () => {
    expect(pts[1]).toMatchObject({ media: null, minimo: null, cobertura: 0 });
  });
  it('mantém a cobertura baixa (decisão de usar ou não é da regra de tendência)', () => {
    expect(pts[2]!.cobertura).toBe(0.2);
    expect(pts[2]!.cobertura).toBeLessThan(COBERTURA_MINIMA);
  });
  it('resposta vazia, malformada ou com intervalo inválido não quebra', () => {
    expect(interpretarEstatisticas(null)).toEqual([]);
    expect(interpretarEstatisticas({})).toEqual([]);
    expect(interpretarEstatisticas({ data: [{ interval: { from: 'x', to: 'y' } }] })).toEqual([]);
    expect(interpretarEstatisticas({ data: [{ interval: { from: '2026-10-03T00:00:00Z', to: '2026-10-13T00:00:00Z' } }] })[0]).toMatchObject({ media: null, cobertura: 0 });
  });
});

describe('classificarNdvi', () => {
  it('pasto: faixas de solo exposto a vigor excelente', () => {
    expect(classificarNdvi(0.1, 'invernada').nivel).toBe('critico');
    expect(classificarNdvi(0.3, 'invernada').nivel).toBe('baixo');
    expect(classificarNdvi(0.5, 'invernada').nivel).toBe('moderado');
    expect(classificarNdvi(0.6, 'invernada').nivel).toBe('bom');
    expect(classificarNdvi(0.8, 'invernada').nivel).toBe('excelente');
  });
  it('lavoura exige mais para o mesmo rótulo', () => {
    expect(classificarNdvi(0.6, 'lavoura').nivel).toBe('bom');
    expect(classificarNdvi(0.55, 'lavoura').nivel).toBe('moderado');
    expect(classificarNdvi(0.55, 'invernada').nivel).toBe('bom');
  });
  it('todo nível traz rótulo e dica', () => {
    for (const v of [0.05, 0.3, 0.5, 0.65, 0.9]) {
      const c = classificarNdvi(v, 'invernada');
      expect(c.rotulo.length).toBeGreaterThan(3);
      expect(c.dica.length).toBeGreaterThan(10);
    }
  });
});

describe('calcularTendencia', () => {
  it('caindo: último útil frente ao anterior', () => {
    const t = calcularTendencia([ponto('2026-08-20', 0.7), ponto('2026-09-09', 0.55)]);
    expect(t.sentido).toBe('caindo');
    expect(t.variacao).toBeCloseTo(-0.214, 3);
    expect(quedaForte(t)).toBe(true);
  });
  it('subindo e estável', () => {
    expect(calcularTendencia([ponto('2026-08-20', 0.4), ponto('2026-09-09', 0.5)]).sentido).toBe('subindo');
    const est = calcularTendencia([ponto('2026-08-20', 0.5), ponto('2026-09-09', 0.51)]);
    expect(est.sentido).toBe('estavel');
    expect(quedaForte(est)).toBe(false);
  });
  it('ignora intervalos nublados: não compara com leitura sem pixel útil', () => {
    const t = calcularTendencia([ponto('2026-08-10', 0.7), ponto('2026-08-30', null, 0), ponto('2026-09-09', 0.6, 0.1), ponto('2026-09-19', 0.56)]);
    expect(t.variacao).toBeCloseTo((0.56 - 0.7) / 0.7, 3);
  });
  it('um ponto só: primeira leitura (sem variação)', () => {
    const t = calcularTendencia([ponto('2026-09-09', 0.6)]);
    expect(t.sentido).toBe('estavel');
    expect(t.variacao).toBeNull();
  });
  it('tudo nublado: sem dados', () => {
    expect(calcularTendencia([ponto('2026-09-09', null, 0)]).sentido).toBe('sem_dados');
    expect(calcularTendencia([]).sentido).toBe('sem_dados');
  });
  it('compara com a mesma época do ano passado quando há dado', () => {
    const t = calcularTendencia([ponto('2025-09-12', 0.7), ponto('2026-08-30', 0.6), ponto('2026-09-09', 0.56)]);
    expect(t.frenteAoAnoPassado).toBeCloseTo((0.56 - 0.7) / 0.7, 2);
  });
});

describe('textoDaTendencia e diasDesdeUltimaLeitura', () => {
  it('textos em português', () => {
    expect(textoDaTendencia({ sentido: 'sem_dados', variacao: null, frenteAoAnoPassado: null })).toContain('nuvens');
    expect(textoDaTendencia({ sentido: 'caindo', variacao: -0.21, frenteAoAnoPassado: -0.1 })).toBe('Caindo (-21%) · -10% vs. mesma época do ano passado');
    expect(textoDaTendencia({ sentido: 'subindo', variacao: 0.12, frenteAoAnoPassado: null })).toBe('Melhorando (+12%)');
    expect(textoDaTendencia({ sentido: 'estavel', variacao: null, frenteAoAnoPassado: null })).toBe('Primeira leitura');
  });
  it('dias desde a última leitura útil', () => {
    const hoje = new Date('2026-10-20T12:00:00Z');
    expect(diasDesdeUltimaLeitura([ponto('2026-09-29', 0.5)], hoje)).toBe(11); // intervalo termina em 09/10: 11 dias até 20/10
    expect(diasDesdeUltimaLeitura([ponto('2026-09-29', null, 0)], hoje)).toBeNull();
    expect(diasDesdeUltimaLeitura([], hoje)).toBeNull();
  });
});
