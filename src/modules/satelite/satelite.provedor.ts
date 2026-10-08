// Provedor de NDVI: Sentinel-2 L2A via Sentinel Hub no Copernicus Data Space
// (Statistical API). Gratuito dentro da cota mensal do CDSE; em escala comercial,
// usar plano pago do provedor (a interface permite trocar sem mexer no resto).
//
// Credenciais (cliente OAuth criado em shapps.dataspace.copernicus.eu → Configurações
// do usuário → OAuth clients): CDSE_CLIENT_ID e CDSE_CLIENT_SECRET.

import { Logger } from '@nestjs/common';
import { LatLng, paraGeoJson, resolucaoEmGraus } from './satelite.geo';
import { PontoNdvi, interpretarEstatisticas } from './satelite.regras';

export const PROVEDOR_NDVI = Symbol('PROVEDOR_NDVI');

export interface PedidoNdvi {
  poligono: LatLng[];
  areaHa: number;
  /** AAAA-MM-DD, alinhado à grade de 10 dias. */
  de: string;
  ate: string;
}

export interface ProvedorNdvi {
  configurado(): boolean;
  /** true = leituras sintéticas de demonstração (o app avisa na tela). */
  demonstracao?(): boolean;
  estatisticas(p: PedidoNdvi): Promise<PontoNdvi[]>;
}

export class ProvedorIndisponivelError extends Error {
  constructor(mensagem: string, readonly status?: number) {
    super(mensagem);
  }
}

const URL_TOKEN = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const URL_STATS = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';

/**
 * NDVI = (B08 − B04) / (B08 + B04). Só entram pixels úteis: a classificação de cena (SCL)
 * descarta sem dado, saturado, área escura, sombra de nuvem, água, nuvem (média/alta),
 * cirro e neve. O `dataMask` de saída é o que faz o provedor excluir o resto da estatística.
 */
export const EVALSCRIPT_NDVI = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  var ruim = [0, 1, 2, 3, 6, 8, 9, 10, 11].indexOf(s.SCL) !== -1;
  var soma = s.B08 + s.B04;
  var util = s.dataMask === 1 && !ruim && soma > 0 ? 1 : 0;
  return { ndvi: [soma > 0 ? (s.B08 - s.B04) / soma : 0], dataMask: [util] };
}`;

export function montarPedidoEstatisticas(p: PedidoNdvi) {
  const { resx, resy } = resolucaoEmGraus(p.poligono, p.areaHa);
  return {
    input: {
      bounds: {
        geometry: paraGeoJson(p.poligono),
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { mosaickingOrder: 'leastCC' } }],
    },
    aggregation: {
      timeRange: { from: `${p.de}T00:00:00Z`, to: `${p.ate}T00:00:00Z` },
      aggregationInterval: { of: 'P10D' },
      lastIntervalBehavior: 'SHORTEN',
      evalscript: EVALSCRIPT_NDVI,
      resx,
      resy,
    },
  };
}

function expiracaoDoToken(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    if (typeof payload.exp === 'number') return payload.exp * 1000;
  } catch {
    // token opaco: assume validade curta
  }
  return Date.now() + 5 * 60_000;
}

export class CopernicusProvedor implements ProvedorNdvi {
  private readonly logger = new Logger('CopernicusProvedor');
  private token: { valor: string; expiraEm: number } | null = null;

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly http: typeof fetch = (...a) => fetch(...a),
    private readonly esperar: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  configurado(): boolean {
    return !!(this.env.CDSE_CLIENT_ID && this.env.CDSE_CLIENT_SECRET);
  }

  private async obterToken(forcar = false): Promise<string> {
    // margem de 60 s para não usar um token prestes a vencer
    if (!forcar && this.token && this.token.expiraEm - 60_000 > Date.now()) return this.token.valor;
    const corpo = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.env.CDSE_CLIENT_ID ?? '',
      client_secret: this.env.CDSE_CLIENT_SECRET ?? '',
    });
    const r = await this.http(URL_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: corpo.toString(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new ProvedorIndisponivelError(`Falha ao autenticar no Copernicus (${r.status}). Confira CDSE_CLIENT_ID/CDSE_CLIENT_SECRET.`, r.status);
    const j: any = await r.json();
    if (!j?.access_token) throw new ProvedorIndisponivelError('Resposta de autenticação sem token.');
    this.token = { valor: j.access_token, expiraEm: expiracaoDoToken(j.access_token) };
    return this.token.valor;
  }

  async estatisticas(p: PedidoNdvi): Promise<PontoNdvi[]> {
    if (!this.configurado()) throw new ProvedorIndisponivelError('Satélite não configurado no servidor.');
    const corpo = JSON.stringify(montarPedidoEstatisticas(p));

    // 1 nova tentativa: token expirado (401) ou erro passageiro (429/5xx)
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const token = await this.obterToken(tentativa > 0);
      const r = await this.http(URL_STATS, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
        body: corpo,
        signal: AbortSignal.timeout(90_000),
      });
      if (r.ok) return interpretarEstatisticas(await r.json());

      const passageiro = r.status === 401 || r.status === 429 || r.status >= 500;
      this.logger.warn(`Statistical API respondeu ${r.status} (tentativa ${tentativa + 1})`);
      if (!passageiro || tentativa === 1) {
        let detalhe = '';
        try {
          detalhe = JSON.stringify(((await r.json()) as any)?.error ?? '').slice(0, 200);
        } catch {}
        throw new ProvedorIndisponivelError(`Copernicus respondeu ${r.status}. ${detalhe}`.trim(), r.status);
      }
      await this.esperar(r.status === 429 ? 3000 : 800);
    }
    throw new ProvedorIndisponivelError('Copernicus indisponível.');
  }
}
