// Regras da central de alertas. Puras: recebem dados já lidos e devolvem alertas.
// Os limites abaixo espelham o app (utils/ferramentas/pecuaria.ts): GMD < 0,4 é
// "ganho baixo" e a lotação segue a capacidade de suporte padrão de 1,5 UA/ha.

export const PESAGEM_ATRASADA_DIAS = 60;
export const GMD_BAIXO = 0.3; // kg/dia (mais conservador que o 0,4 da tela, para não alarmar à toa)
export const INTERVALO_MIN_GMD_DIAS = 7; // pesagens muito próximas dão GMD ruidoso
export const KG_POR_UA = 450;
export const CAPACIDADE_UA_HA = 1.5;
export const VACINA_AVISO_DIAS = 7;
export const MAX_ANIMAIS_LISTADOS = 20;

export type Severidade = 'alta' | 'media' | 'info';
export type TipoAlerta =
  | 'vacina_vencida'
  | 'vacina_proxima'
  | 'perda_peso'
  | 'gmd_baixo'
  | 'pesagem_atrasada'
  | 'superlotacao'
  | 'lotacao_atencao';

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  severidade: Severidade;
  titulo: string;
  detalhe: string;
  quantidade: number;
  animais?: { id: string; brinco: string }[];
  invernada?: { id: string; nome: string };
}

const DIA = 86_400_000;
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
const lista = (xs: { brinco: string }[]) => {
  const nomes = xs.slice(0, 5).map((a) => a.brinco).join(', ');
  return xs.length > 5 ? `${nomes} e mais ${xs.length - 5}` : nomes;
};

// ------------------------------------------------------------------ pesagem

export interface AnimalParaPesagem {
  id: string;
  brinco: string;
  criadoEm: Date;
  ultimaPesagem: Date | null;
}

export function alertaPesagemAtrasada(animais: AnimalParaPesagem[], agora: Date): Alerta | null {
  const atrasados = animais.filter((a) => {
    const ref = a.ultimaPesagem ?? a.criadoEm;
    return (agora.getTime() - ref.getTime()) / DIA > PESAGEM_ATRASADA_DIAS;
  });
  if (atrasados.length === 0) return null;
  return {
    id: 'pesagem_atrasada',
    tipo: 'pesagem_atrasada',
    severidade: 'info',
    titulo: `${plural(atrasados.length, 'animal', 'animais')} sem pesagem há mais de ${PESAGEM_ATRASADA_DIAS} dias`,
    detalhe: `Sem pesar não dá para saber o ganho de peso. ${lista(atrasados)}.`,
    quantidade: atrasados.length,
    animais: atrasados.slice(0, MAX_ANIMAIS_LISTADOS).map(({ id, brinco }) => ({ id, brinco })),
  };
}

// -------------------------------------------------------------- ganho de peso

export interface AnimalParaGanho {
  id: string;
  brinco: string;
  /** As duas pesagens mais recentes, em qualquer ordem. */
  pesagens: { data: Date; pesoKg: number }[];
}

export function alertasDeGanho(animais: AnimalParaGanho[]): Alerta[] {
  const perdas: AnimalParaGanho[] = [];
  const baixos: AnimalParaGanho[] = [];

  for (const a of animais) {
    if (a.pesagens.length < 2) continue;
    const [ant, ult] = [...a.pesagens].sort((x, y) => x.data.getTime() - y.data.getTime()).slice(-2) as [
      { data: Date; pesoKg: number },
      { data: Date; pesoKg: number },
    ];
    const dias = (ult.data.getTime() - ant.data.getTime()) / DIA;
    if (dias < INTERVALO_MIN_GMD_DIAS) continue;
    const gmd = (ult.pesoKg - ant.pesoKg) / dias;
    if (gmd < 0) perdas.push(a);
    else if (gmd < GMD_BAIXO) baixos.push(a);
  }

  const out: Alerta[] = [];
  if (perdas.length) {
    out.push({
      id: 'perda_peso',
      tipo: 'perda_peso',
      severidade: 'alta',
      titulo: `${plural(perdas.length, 'animal perdeu', 'animais perderam')} peso na última pesagem`,
      detalhe: `Pode indicar doença, parasitas ou falta de pasto/suplemento. ${lista(perdas)}.`,
      quantidade: perdas.length,
      animais: perdas.slice(0, MAX_ANIMAIS_LISTADOS).map(({ id, brinco }) => ({ id, brinco })),
    });
  }
  if (baixos.length) {
    out.push({
      id: 'gmd_baixo',
      tipo: 'gmd_baixo',
      severidade: 'media',
      titulo: `${plural(baixos.length, 'animal com', 'animais com')} ganho de peso abaixo de ${GMD_BAIXO.toLocaleString('pt-BR')} kg/dia`,
      detalhe: `Vale revisar pasto e suplementação. ${lista(baixos)}.`,
      quantidade: baixos.length,
      animais: baixos.slice(0, MAX_ANIMAIS_LISTADOS).map(({ id, brinco }) => ({ id, brinco })),
    });
  }
  return out;
}

// ------------------------------------------------------------------ lotação

export interface InvernadaParaLotacao {
  id: string;
  nome: string;
  areaHa: number;
  /** Pesos dos animais ativos (null = sem peso cadastrado). */
  pesos: (number | null)[];
}

export function alertasDeLotacao(invernadas: InvernadaParaLotacao[]): Alerta[] {
  const out: Alerta[] = [];
  for (const inv of invernadas) {
    const conhecidos = inv.pesos.filter((p): p is number => p !== null && p > 0);
    if (!(inv.areaHa > 0) || inv.pesos.length === 0 || conhecidos.length === 0) continue;
    const pesoMedio = conhecidos.reduce((s, p) => s + p, 0) / conhecidos.length;
    const uaHa = (inv.pesos.length * pesoMedio) / KG_POR_UA / inv.areaHa;
    const usoPct = (uaHa / CAPACIDADE_UA_HA) * 100;
    if (usoPct <= 100) continue;

    const superlotada = usoPct > 120;
    out.push({
      id: `lotacao:${inv.id}`,
      tipo: superlotada ? 'superlotacao' : 'lotacao_atencao',
      severidade: superlotada ? 'alta' : 'media',
      titulo: `${inv.nome}: ${superlotada ? 'superlotada' : 'acima da capacidade'} (${Math.round(usoPct)}%)`,
      detalhe: `${uaHa.toFixed(2).replace('.', ',')} UA/ha para uma capacidade de ${CAPACIDADE_UA_HA.toString().replace('.', ',')} UA/ha. Considere dividir o lote ou rodar de pasto.`,
      quantidade: inv.pesos.length,
      invernada: { id: inv.id, nome: inv.nome },
    });
  }
  return out;
}

// ------------------------------------------------------------------- vacinas

export interface MedicamentoParaAlerta {
  id: string;
  nome: string;
  proximaAplicacao: Date;
  animalId: string | null;
  brinco: string | null;
}

export function alertasDeVacina(meds: MedicamentoParaAlerta[], agora: Date): Alerta[] {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const vencidas = meds.filter((m) => m.proximaAplicacao.getTime() < hoje);
  const proximas = meds.filter((m) => {
    const t = m.proximaAplicacao.getTime();
    return t >= hoje && t <= hoje + VACINA_AVISO_DIAS * DIA;
  });
  const animaisDe = (ms: MedicamentoParaAlerta[]) =>
    ms.filter((m) => m.animalId && m.brinco).map((m) => ({ id: m.animalId as string, brinco: m.brinco as string }));
  const nomes = (ms: MedicamentoParaAlerta[]) => [...new Set(ms.map((m) => m.nome))].slice(0, 3).join(', ');

  const out: Alerta[] = [];
  if (vencidas.length) {
    out.push({
      id: 'vacina_vencida',
      tipo: 'vacina_vencida',
      severidade: 'alta',
      titulo: `${plural(vencidas.length, 'aplicação em atraso', 'aplicações em atraso')}`,
      detalhe: `${nomes(vencidas)}. Reforço vencido reduz a proteção do rebanho.`,
      quantidade: vencidas.length,
      animais: animaisDe(vencidas).slice(0, MAX_ANIMAIS_LISTADOS),
    });
  }
  if (proximas.length) {
    out.push({
      id: 'vacina_proxima',
      tipo: 'vacina_proxima',
      severidade: 'media',
      titulo: `${plural(proximas.length, 'aplicação', 'aplicações')} nos próximos ${VACINA_AVISO_DIAS} dias`,
      detalhe: `${nomes(proximas)}. Programe o manejo e a compra do produto.`,
      quantidade: proximas.length,
      animais: animaisDe(proximas).slice(0, MAX_ANIMAIS_LISTADOS),
    });
  }
  return out;
}

const PESO: Record<Severidade, number> = { alta: 0, media: 1, info: 2 };

/** Mais grave primeiro; dentro da severidade, mantém a ordem de entrada. */
export const ordenarAlertas = (alertas: Alerta[]) =>
  alertas.map((a, i) => ({ a, i })).sort((x, y) => PESO[x.a.severidade] - PESO[y.a.severidade] || x.i - y.i).map((x) => x.a);
