import { SateliteDemoProvedor } from './satelite.demo';

const quadrado = [
  { latitude: -20.45, longitude: -54.6 }, { latitude: -20.45, longitude: -54.59 },
  { latitude: -20.44, longitude: -54.59 }, { latitude: -20.44, longitude: -54.6 },
];

describe('SateliteDemoProvedor', () => {
  const p = new SateliteDemoProvedor();
  const pedido = { poligono: quadrado, areaHa: 100, de: '2025-09-01', ate: '2026-10-08' };

  it('declara-se demonstração e configurado', () => {
    expect(p.demonstracao()).toBe(true);
    expect(p.configurado()).toBe(true);
  });
  it('é determinístico: a mesma área e período dão sempre a mesma série', async () => {
    expect(await p.estatisticas(pedido)).toEqual(await p.estatisticas(pedido));
  });
  it('áreas diferentes têm séries diferentes', async () => {
    const outra = quadrado.map((x) => ({ ...x, latitude: x.latitude + 0.2 }));
    expect(await p.estatisticas({ ...pedido, poligono: outra })).not.toEqual(await p.estatisticas(pedido));
  });
  it('intervalos contíguos de 10 dias, valores plausíveis e algumas leituras nubladas', async () => {
    const s = await p.estatisticas(pedido);
    expect(s.length).toBeGreaterThan(35);
    for (let i = 1; i < s.length - 1; i++) expect(s[i]!.inicio).toBe(s[i - 1]!.fim);
    expect(s[s.length - 1]!.fim <= '2026-10-08').toBe(true); // o último intervalo termina hoje, nunca no futuro
    const validos = s.filter((x) => x.media !== null);
    expect(validos.length).toBeGreaterThan(s.length / 2);
    expect(validos.some((x) => x.media === null)).toBe(false);
    for (const x of validos) expect(x.media!).toBeGreaterThanOrEqual(0.12), expect(x.media!).toBeLessThanOrEqual(0.88);
    expect(s.some((x) => x.media === null && x.cobertura === 0)).toBe(true);
  });
  it('a seca (jul–set) fica abaixo da época das águas (jan–mar)', async () => {
    const s = (await p.estatisticas(pedido)).filter((x) => x.media !== null);
    const media = (meses: number[]) => {
      const v = s.filter((x) => meses.includes(new Date(x.inicio).getUTCMonth())).map((x) => x.media as number);
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    expect(media([0, 1, 2])).toBeGreaterThan(media([6, 7, 8]));
  });
});
