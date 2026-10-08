// Regras do índice de vegetação (NDVI): grade de intervalos, leitura da resposta do
// provedor, classificação e tendência. Puro.
//
// Cuidado de interpretação: NDVI depende da cultura, do estágio e da estação. Uma queda
// na seca é normal em pasto; por isso a tendência é sempre apresentada como sinal para
// olhar a área, e comparada com a própria história da área, nunca com uma tabela fixa.

export const DIAS_INTERVALO = 10;
/** Abaixo disto o intervalo é "nublado": não entra em tendência nem em classificação. */
export const COBERTURA_MINIMA = 0.3;
/** Queda relativa que merece um alerta. */
export const QUEDA_ALERTA = 0.15;

const DIA_MS = 86_400_000;

export type TipoAlvo = 'invernada' | 'lavoura';

export interface PontoNdvi {
  inicio: string; // AAAA-MM-DD
  fim: string;
  media: number | null;
  minimo: number | null;
  maximo: number | null;
  desvio: number | null;
  /** 0 a 1: fração de pixels úteis. */
  cobertura: number;
}

// --------------------------------------------------------------------- grade

const diaIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const tDe = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Início do intervalo (grade fixa de 10 dias contados desde 1970) que contém o dia. */
export function inicioDaGrade(data: Date | string): string {
  const t = typeof data === 'string' ? tDe(data.slice(0, 10)) : Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  const dias = Math.floor(t / DIA_MS);
  return diaIso(Math.floor(dias / DIAS_INTERVALO) * DIAS_INTERVALO * DIA_MS);
}

/** Intervalos de 10 dias, alinhados à grade, cobrindo [de, ate]. */
export function intervalosDaGrade(de: Date, ate: Date): { inicio: string; fim: string }[] {
  const out: { inicio: string; fim: string }[] = [];
  let t = tDe(inicioDaGrade(de));
  const limite = Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), ate.getUTCDate());
  while (t <= limite) {
    out.push({ inicio: diaIso(t), fim: diaIso(t + DIAS_INTERVALO * DIA_MS) });
    t += DIAS_INTERVALO * DIA_MS;
  }
  return out;
}

// ------------------------------------------------------------ resposta do provedor

const numeroOuNull = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const arred = (n: number | null, c = 4) => (n === null ? null : Number(n.toFixed(c)));

/**
 * Converte a resposta da Statistical API (data[].interval + outputs.ndvi.bands.B0.stats)
 * em pontos. Intervalo sem pixel válido (tudo nuvem) vira ponto com média nula e
 * cobertura 0: assim o app sabe que "foi consultado e estava nublado".
 */
export function interpretarEstatisticas(resposta: any, idSaida = 'ndvi'): PontoNdvi[] {
  const lista: any[] = Array.isArray(resposta?.data) ? resposta.data : [];
  const pontos: PontoNdvi[] = [];
  for (const item of lista) {
    const de = String(item?.interval?.from ?? '').slice(0, 10);
    const ate = String(item?.interval?.to ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) continue;
    const st = item?.outputs?.[idSaida]?.bands?.B0?.stats;
    const total = numeroOuNull(st?.sampleCount) ?? 0;
    const semDado = numeroOuNull(st?.noDataCount) ?? 0;
    const validos = Math.max(0, total - semDado);
    const cobertura = total > 0 ? validos / total : 0;
    const media = validos > 0 ? numeroOuNull(st?.mean) : null;
    pontos.push({
      inicio: inicioDaGrade(de),
      fim: ate,
      media: arred(media),
      minimo: media === null ? null : arred(numeroOuNull(st?.min)),
      maximo: media === null ? null : arred(numeroOuNull(st?.max)),
      desvio: media === null ? null : arred(numeroOuNull(st?.stDev)),
      cobertura: Number(cobertura.toFixed(3)),
    });
  }
  return pontos;
}

// ------------------------------------------------------------- classificação

export type NivelVigor = 'critico' | 'baixo' | 'moderado' | 'bom' | 'excelente';

export interface Classificacao {
  nivel: NivelVigor;
  rotulo: string;
  dica: string;
}

/**
 * Faixas gerais de referência. Pasto tropical a campo costuma ficar entre 0,4 e 0,75;
 * lavoura em pleno desenvolvimento passa de 0,7. Servem de leitura rápida, não de laudo.
 */
export function classificarNdvi(media: number, tipo: TipoAlvo): Classificacao {
  const lim = tipo === 'lavoura' ? [0.2, 0.4, 0.6, 0.75] : [0.25, 0.4, 0.55, 0.7];
  if (media < lim[0]!) {
    return { nivel: 'critico', rotulo: 'Solo exposto ou muito ralo', dica: tipo === 'lavoura' ? 'Pode ser pré-plantio, falha de stand ou colheita.' : 'Pasto degradado, queimado ou em seca severa. Vale conferir a área.' };
  }
  if (media < lim[1]!) {
    return { nivel: 'baixo', rotulo: 'Vegetação fraca', dica: tipo === 'lavoura' ? 'Início de ciclo, déficit hídrico ou nutricional?' : 'Pasto ralo ou em seca. Avalie lotação e descanso.' };
  }
  if (media < lim[2]!) return { nivel: 'moderado', rotulo: 'Vigor moderado', dica: 'Dentro do esperado para muitas situações; compare com o histórico da área.' };
  if (media < lim[3]!) return { nivel: 'bom', rotulo: 'Bom vigor', dica: 'Vegetação saudável e densa.' };
  return { nivel: 'excelente', rotulo: 'Vigor excelente', dica: 'Cobertura vegetal muito densa e ativa.' };
}

// ------------------------------------------------------------------ tendência

export interface Tendencia {
  sentido: 'subindo' | 'estavel' | 'caindo' | 'sem_dados';
  /** Variação relativa do último ponto útil frente ao anterior (ex.: -0.18 = caiu 18%). */
  variacao: number | null;
  /** Variação frente ao mesmo período do ano anterior, quando há dado. */
  frenteAoAnoPassado: number | null;
}

const util = (p: PontoNdvi): p is PontoNdvi & { media: number } => p.media !== null && p.cobertura >= COBERTURA_MINIMA;

export function calcularTendencia(pontos: PontoNdvi[]): Tendencia {
  const uteis = pontos.filter(util).sort((a, b) => tDe(a.inicio) - tDe(b.inicio));
  const ultimo = uteis[uteis.length - 1];
  if (!ultimo) return { sentido: 'sem_dados', variacao: null, frenteAoAnoPassado: null };

  // anterior: o ponto útil mais recente que seja de ao menos 8 dias antes (evita comparar o mesmo intervalo)
  const anterior = [...uteis].reverse().find((p) => tDe(ultimo.inicio) - tDe(p.inicio) >= 8 * DIA_MS && p !== ultimo);
  let variacao: number | null = null;
  let sentido: Tendencia['sentido'] = 'estavel';
  if (anterior && anterior.media > 0.05) {
    variacao = (ultimo.media - anterior.media) / anterior.media;
    sentido = variacao >= 0.05 ? 'subindo' : variacao <= -0.05 ? 'caindo' : 'estavel';
  }

  // mesmo período do ano anterior: ponto útil a 365 ± 20 dias
  const alvo = tDe(ultimo.inicio) - 365 * DIA_MS;
  const doAnoPassado = uteis
    .filter((p) => Math.abs(tDe(p.inicio) - alvo) <= 20 * DIA_MS)
    .sort((a, b) => Math.abs(tDe(a.inicio) - alvo) - Math.abs(tDe(b.inicio) - alvo))[0];
  const frenteAoAnoPassado = doAnoPassado && doAnoPassado.media > 0.05 ? (ultimo.media - doAnoPassado.media) / doAnoPassado.media : null;

  return {
    sentido,
    variacao: variacao === null ? null : Number(variacao.toFixed(3)),
    frenteAoAnoPassado: frenteAoAnoPassado === null ? null : Number(frenteAoAnoPassado.toFixed(3)),
  };
}

/** Texto curto da tendência para o app. */
export function textoDaTendencia(t: Tendencia): string {
  const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
  if (t.sentido === 'sem_dados') return 'Sem imagem útil recente (nuvens).';
  const partes: string[] = [];
  if (t.variacao !== null) {
    partes.push(t.sentido === 'estavel' ? 'Estável' : t.sentido === 'subindo' ? `Melhorando (${pct(t.variacao)})` : `Caindo (${pct(t.variacao)})`);
  } else partes.push('Primeira leitura');
  if (t.frenteAoAnoPassado !== null) partes.push(`${pct(t.frenteAoAnoPassado)} vs. mesma época do ano passado`);
  return partes.join(' · ');
}

/** Queda forte entre duas leituras úteis: merece atenção do produtor. */
export const quedaForte = (t: Tendencia) => t.variacao !== null && t.variacao <= -QUEDA_ALERTA;

/** Dias desde a última leitura útil (null = nunca). */
export function diasDesdeUltimaLeitura(pontos: PontoNdvi[], hoje: Date = new Date()): number | null {
  const ult = pontos.filter(util).map((p) => tDe(p.fim)).sort((a, b) => b - a)[0];
  if (ult === undefined) return null;
  return Math.max(0, Math.round((Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()) - ult) / DIA_MS));
}
