import { CopernicusProvedor, EVALSCRIPT_NDVI, ProvedorIndisponivelError, montarPedidoEstatisticas } from './satelite.provedor';

const poligono = [
  { latitude: -20.45, longitude: -54.6 },
  { latitude: -20.45, longitude: -54.59 },
  { latitude: -20.44, longitude: -54.59 },
  { latitude: -20.44, longitude: -54.6 },
];

const respostaOk = {
  status: 'OK',
  data: [
    {
      interval: { from: '2026-09-23T00:00:00Z', to: '2026-10-03T00:00:00Z' },
      outputs: { ndvi: { bands: { B0: { stats: { min: 0.2, max: 0.9, mean: 0.55, stDev: 0.1, sampleCount: 100, noDataCount: 10 } } } } },
    },
  ],
};

// JWT de teste que expira em 1 hora
const jwt = (expEmSegundos: number) =>
  `h.${Buffer.from(JSON.stringify({ exp: expEmSegundos })).toString('base64url')}.s`;
const tokenValido = () => jwt(Math.floor(Date.now() / 1000) + 3600);

function resp(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as any;
}

describe('CopernicusProvedor', () => {
  const env = { CDSE_CLIENT_ID: 'id', CDSE_CLIENT_SECRET: 'segredo' } as any;
  const pedido = { poligono, areaHa: 120, de: '2026-09-23', ate: '2026-10-08' };
  const sem = async () => undefined;

  it('sem credenciais: não configurado e recusa chamar', async () => {
    const http = jest.fn();
    const p = new CopernicusProvedor({} as any, http as any, sem);
    expect(p.configurado()).toBe(false);
    await expect(p.estatisticas(pedido)).rejects.toBeInstanceOf(ProvedorIndisponivelError);
    expect(http).not.toHaveBeenCalled();
  });

  it('pede o token por client_credentials e consulta a Statistical API do Copernicus', async () => {
    const http = jest.fn().mockResolvedValueOnce(resp(200, { access_token: tokenValido() })).mockResolvedValueOnce(resp(200, respostaOk));
    const pontos = await new CopernicusProvedor(env, http as any, sem).estatisticas(pedido);

    const [urlToken, optToken] = http.mock.calls[0]!;
    expect(urlToken).toBe('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token');
    expect(optToken.headers['content-type']).toBe('application/x-www-form-urlencoded');
    const form = new URLSearchParams(optToken.body);
    expect(form.get('grant_type')).toBe('client_credentials');
    expect(form.get('client_id')).toBe('id');
    expect(form.get('client_secret')).toBe('segredo');

    const [urlStats, optStats] = http.mock.calls[1]!;
    expect(urlStats).toBe('https://sh.dataspace.copernicus.eu/api/v1/statistics');
    expect(optStats.headers.authorization).toMatch(/^Bearer h\./);
    expect(pontos[0]).toMatchObject({ media: 0.55, cobertura: 0.9 });
  });

  it('reaproveita o token enquanto vale', async () => {
    const http = jest
      .fn()
      .mockResolvedValueOnce(resp(200, { access_token: tokenValido() }))
      .mockResolvedValue(resp(200, respostaOk));
    const p = new CopernicusProvedor(env, http as any, sem);
    await p.estatisticas(pedido);
    await p.estatisticas(pedido);
    const urls = http.mock.calls.map((c) => c[0]);
    expect(urls.filter((u) => String(u).includes('openid-connect/token'))).toHaveLength(1);
  });

  it('401 (token vencido): renova o token e tenta de novo', async () => {
    const http = jest
      .fn()
      .mockResolvedValueOnce(resp(200, { access_token: tokenValido() }))
      .mockResolvedValueOnce(resp(401, { error: 'expired' }))
      .mockResolvedValueOnce(resp(200, { access_token: tokenValido() }))
      .mockResolvedValueOnce(resp(200, respostaOk));
    const pontos = await new CopernicusProvedor(env, http as any, sem).estatisticas(pedido);
    expect(pontos).toHaveLength(1);
    expect(http).toHaveBeenCalledTimes(4);
  });

  it('429 e 5xx têm uma nova tentativa; 400 não', async () => {
    const tok = resp(200, { access_token: tokenValido() });
    const http429 = jest.fn().mockResolvedValueOnce(tok).mockResolvedValueOnce(resp(429, {})).mockResolvedValueOnce(tok).mockResolvedValueOnce(resp(200, respostaOk));
    await expect(new CopernicusProvedor(env, http429 as any, sem).estatisticas(pedido)).resolves.toHaveLength(1);

    const http400 = jest.fn().mockResolvedValueOnce(tok).mockResolvedValueOnce(resp(400, { error: { message: 'evalscript ruim' } }));
    await expect(new CopernicusProvedor(env, http400 as any, sem).estatisticas(pedido)).rejects.toMatchObject({ status: 400 });
    expect(http400).toHaveBeenCalledTimes(2);
  });

  it('falha persistente vira ProvedorIndisponivelError com o status', async () => {
    const http = jest.fn().mockResolvedValue(resp(503, {}));
    http.mockResolvedValueOnce(resp(200, { access_token: tokenValido() }));
    await expect(new CopernicusProvedor(env, http as any, sem).estatisticas(pedido)).rejects.toMatchObject({ status: 503 });
  });

  it('credenciais erradas: mensagem que diz o que conferir', async () => {
    const http = jest.fn().mockResolvedValue(resp(401, {}));
    await expect(new CopernicusProvedor(env, http as any, sem).estatisticas(pedido)).rejects.toThrow('CDSE_CLIENT_ID');
  });
});

describe('montarPedidoEstatisticas (formato da Statistical API)', () => {
  const body: any = montarPedidoEstatisticas({ poligono, areaHa: 120, de: '2026-09-23', ate: '2026-10-08' });

  it('geometria em GeoJSON/EPSG:4326, Sentinel-2 L2A e mosaico de menor nuvem', () => {
    expect(body.input.bounds.geometry.type).toBe('Polygon');
    expect(body.input.bounds.properties.crs).toBe('http://www.opengis.net/def/crs/EPSG/0/4326');
    expect(body.input.data).toEqual([{ type: 'sentinel-2-l2a', dataFilter: { mosaickingOrder: 'leastCC' } }]);
  });
  it('agregação de 10 dias com evalscript e resolução dentro de "aggregation"', () => {
    expect(body.aggregation.timeRange).toEqual({ from: '2026-09-23T00:00:00Z', to: '2026-10-08T00:00:00Z' });
    expect(body.aggregation.aggregationInterval).toEqual({ of: 'P10D' });
    expect(body.aggregation.lastIntervalBehavior).toBe('SHORTEN');
    expect(body.aggregation.evalscript).toBe(EVALSCRIPT_NDVI);
    expect(body.aggregation.resx).toBeGreaterThan(0);
    expect(body.aggregation.resy).toBeGreaterThan(0);
    expect(body).not.toHaveProperty('calculations');
  });
  it('o evalscript produz "ndvi" e "dataMask" e descarta nuvem, sombra e água pela SCL', () => {
    expect(EVALSCRIPT_NDVI).toContain('//VERSION=3');
    expect(EVALSCRIPT_NDVI).toContain('id: "ndvi"');
    expect(EVALSCRIPT_NDVI).toContain('id: "dataMask"');
    expect(EVALSCRIPT_NDVI).toContain('"SCL"');
    for (const classe of [3, 6, 8, 9, 10]) expect(EVALSCRIPT_NDVI).toMatch(new RegExp(`\\b${classe}\\b`));
  });
  it('o evalscript é JavaScript válido e calcula (B08−B04)/(B08+B04) só nos pixels úteis', () => {
    // executa o script como o provedor faria
    const fabrica = new Function(`${EVALSCRIPT_NDVI}\nreturn { setup, evaluatePixel };`);
    const { setup, evaluatePixel } = fabrica();
    expect(setup().output.map((o: any) => o.id)).toEqual(['ndvi', 'dataMask']);
    const util = evaluatePixel({ B04: 0.1, B08: 0.5, SCL: 4, dataMask: 1 });
    expect(util.ndvi[0]).toBeCloseTo(0.6667, 3);
    expect(util.dataMask[0]).toBe(1);
    expect(evaluatePixel({ B04: 0.1, B08: 0.5, SCL: 9, dataMask: 1 }).dataMask[0]).toBe(0); // nuvem
    expect(evaluatePixel({ B04: 0.1, B08: 0.5, SCL: 3, dataMask: 1 }).dataMask[0]).toBe(0); // sombra
    expect(evaluatePixel({ B04: 0.1, B08: 0.5, SCL: 6, dataMask: 1 }).dataMask[0]).toBe(0); // água
    expect(evaluatePixel({ B04: 0.1, B08: 0.5, SCL: 4, dataMask: 0 }).dataMask[0]).toBe(0); // fora da cena
    expect(evaluatePixel({ B04: 0, B08: 0, SCL: 4, dataMask: 1 }).dataMask[0]).toBe(0); // sem reflectância
  });
});
