// Geometria do monitoramento por satélite: validar o perímetro, medir a área e
// converter para o GeoJSON que o provedor espera. Puro (sem rede, sem banco).

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Acima disto o custo de processamento cresce sem ganho para o produtor; recusa. */
export const AREA_MAXIMA_HA = 5000;
export const MAX_PONTOS = 200;

const EPS = 1e-9;
const ehNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const iguais = (a: LatLng, b: LatLng) => Math.abs(a.latitude - b.latitude) < EPS && Math.abs(a.longitude - b.longitude) < EPS;

/**
 * Lê o JSON guardado no banco ([{latitude, longitude}]) e devolve o anel limpo:
 * sem pontos inválidos, sem repetição consecutiva e sem ponto de fechamento repetido.
 * null = não é um perímetro utilizável (menos de 3 pontos ou fora das faixas).
 */
export function normalizarPoligono(bruto: unknown): LatLng[] | null {
  if (!Array.isArray(bruto)) return null;
  const pontos: LatLng[] = [];
  for (const p of bruto as any[]) {
    const latitude = Number(p?.latitude);
    const longitude = Number(p?.longitude);
    if (!ehNum(latitude) || !ehNum(longitude)) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    const ult = pontos[pontos.length - 1];
    if (!ult || !iguais(ult, { latitude, longitude })) pontos.push({ latitude, longitude });
  }
  if (pontos.length > 1 && iguais(pontos[0]!, pontos[pontos.length - 1]!)) pontos.pop();
  return pontos.length >= 3 ? pontos : null;
}

/** Área em hectares (projeção equirretangular em torno do centroide: precisa em escala de fazenda). */
export function areaEmHectares(p: LatLng[]): number {
  if (p.length < 3) return 0;
  const lat0 = (p.reduce((s, x) => s + x.latitude, 0) / p.length) * (Math.PI / 180);
  const R = 6_371_008.8;
  const xy = p.map((x) => ({
    x: R * (x.longitude * (Math.PI / 180)) * Math.cos(lat0),
    y: R * (x.latitude * (Math.PI / 180)),
  }));
  let soma = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i]!;
    const b = xy[(i + 1) % xy.length]!;
    soma += a.x * b.y - b.x * a.y;
  }
  return Math.abs(soma / 2) / 10_000;
}

/** Orientação do anel: positivo = anti-horário (como o GeoJSON pede para o contorno externo). */
function areaOrientada(p: LatLng[]): number {
  let soma = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % p.length]!;
    soma += a.longitude * b.latitude - b.longitude * a.latitude;
  }
  return soma / 2;
}

/** Reduz o número de pontos mantendo a forma (amostragem uniforme; perímetros importados vêm com milhares). */
export function limitarPontos(p: LatLng[], max = MAX_PONTOS): LatLng[] {
  if (p.length <= max) return p;
  const passo = p.length / max;
  return Array.from({ length: max }, (_, i) => p[Math.floor(i * passo)]!);
}

export interface PoligonoGeoJson {
  type: 'Polygon';
  coordinates: number[][][];
}

/** GeoJSON [lon, lat], anel fechado e anti-horário. */
export function paraGeoJson(p: LatLng[]): PoligonoGeoJson {
  const anel = areaOrientada(p) >= 0 ? [...p] : [...p].reverse();
  const coords = anel.map((x) => [x.longitude, x.latitude]);
  coords.push([...coords[0]!]);
  return { type: 'Polygon', coordinates: [coords] };
}

/**
 * Tamanho do pixel em GRAUS (o provedor recebe a geometria em EPSG:4326):
 * 10 m para áreas até 100 ha, 20 m acima. Corrige a longitude pela latitude para o pixel ficar quadrado.
 */
export function resolucaoEmGraus(p: LatLng[], areaHa: number): { resx: number; resy: number } {
  const metros = areaHa <= 100 ? 10 : 20;
  const lat = (p.reduce((s, x) => s + x.latitude, 0) / p.length) * (Math.PI / 180);
  return {
    resx: Number((metros / (111_320 * Math.cos(lat))).toPrecision(6)),
    resy: Number((metros / 110_574).toPrecision(6)),
  };
}
