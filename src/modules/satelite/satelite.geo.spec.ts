import { AREA_MAXIMA_HA, areaEmHectares, limitarPontos, normalizarPoligono, paraGeoJson, resolucaoEmGraus } from './satelite.geo';

// quadrado de ~1 km × 1 km (100 ha) perto de Campo Grande/MS
const lat0 = -20.45;
const lon0 = -54.6;
const dLat = 1000 / 110_574;
const dLon = 1000 / (111_320 * Math.cos((lat0 * Math.PI) / 180));
const quadrado = [
  { latitude: lat0, longitude: lon0 },
  { latitude: lat0, longitude: lon0 + dLon },
  { latitude: lat0 + dLat, longitude: lon0 + dLon },
  { latitude: lat0 + dLat, longitude: lon0 },
];

describe('normalizarPoligono', () => {
  it('aceita o formato guardado e remove o ponto de fechamento repetido', () => {
    const fechado = [...quadrado, quadrado[0]];
    expect(normalizarPoligono(fechado)).toHaveLength(4);
  });
  it('remove repetidos consecutivos', () => {
    const p = [quadrado[0], quadrado[0], quadrado[1], quadrado[2], quadrado[3]];
    expect(normalizarPoligono(p)).toHaveLength(4);
  });
  it('recusa menos de 3 pontos, lixo e coordenadas fora da faixa', () => {
    expect(normalizarPoligono([quadrado[0], quadrado[1]])).toBeNull();
    expect(normalizarPoligono('x')).toBeNull();
    expect(normalizarPoligono(null)).toBeNull();
    expect(normalizarPoligono([{ latitude: 95, longitude: 0 }, { latitude: 1, longitude: 1 }, { latitude: 2, longitude: 2 }])).toBeNull();
    expect(normalizarPoligono([{ latitude: 'a', longitude: 0 }, quadrado[1], quadrado[2]])).toBeNull();
  });
  it('aceita números vindos como texto (JSON de importações antigas)', () => {
    const p = quadrado.map((x) => ({ latitude: String(x.latitude), longitude: String(x.longitude) }));
    expect(normalizarPoligono(p)).toHaveLength(4);
  });
});

describe('areaEmHectares', () => {
  it('quadrado de 1 km de lado ≈ 100 ha', () => {
    expect(areaEmHectares(quadrado)).toBeGreaterThan(99);
    expect(areaEmHectares(quadrado)).toBeLessThan(101);
  });
  it('não depende da ordem horária/anti-horária', () => {
    expect(areaEmHectares([...quadrado].reverse())).toBeCloseTo(areaEmHectares(quadrado), 6);
  });
  it('menos de 3 pontos: zero', () => {
    expect(areaEmHectares(quadrado.slice(0, 2))).toBe(0);
  });
  it('o limite de área é generoso para fazendas comuns', () => {
    expect(AREA_MAXIMA_HA).toBeGreaterThanOrEqual(1000);
  });
});

describe('paraGeoJson', () => {
  it('[lon, lat], anel fechado e anti-horário, qualquer que seja a orientação de entrada', () => {
    for (const entrada of [quadrado, [...quadrado].reverse()]) {
      const g = paraGeoJson(entrada);
      const anel = g.coordinates[0]!;
      expect(g.type).toBe('Polygon');
      expect(anel[0]).toEqual(anel[anel.length - 1]);
      expect(anel).toHaveLength(5);
      expect(anel[0]![0]).toBeCloseTo(lon0, 5); // longitude primeiro
      // anti-horário: área orientada positiva (fórmula do cadarço)
      let s = 0;
      for (let i = 0; i < anel.length - 1; i++) s += anel[i]![0]! * anel[i + 1]![1]! - anel[i + 1]![0]! * anel[i]![1]!;
      expect(s).toBeGreaterThan(0);
    }
  });
});

describe('limitarPontos / resolucaoEmGraus', () => {
  it('reduz perímetros enormes sem passar do limite', () => {
    const muitos = Array.from({ length: 5000 }, (_, i) => ({ latitude: -20 + i * 1e-5, longitude: -54 + Math.sin(i) * 1e-3 }));
    expect(limitarPontos(muitos, 200)).toHaveLength(200);
    expect(limitarPontos(quadrado, 200)).toHaveLength(4);
  });
  it('10 m até 100 ha e 20 m acima; pixel em graus coerente com o metro', () => {
    const pequeno = resolucaoEmGraus(quadrado, 50);
    const grande = resolucaoEmGraus(quadrado, 400);
    expect(grande.resy / pequeno.resy).toBeCloseTo(2, 2);
    expect(pequeno.resy).toBeCloseTo(10 / 110_574, 6);
    // na latitude −20,45 um grau de longitude é menor que o de latitude: resx > resy
    expect(pequeno.resx).toBeGreaterThan(pequeno.resy);
  });
});
