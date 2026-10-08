// Provedor de DEMONSTRAÇÃO: gera leituras de NDVI sintéticas e determinísticas (sazonalidade
// de chuva/seca do Centro-Oeste, com algumas semanas "nubladas"). Serve para mostrar a função a
// parceiros e para testes, sem credenciais. Só liga com SATELITE_MODO_DEMO=1 e o app avisa
// "dados de demonstração" na tela: NUNCA deve ficar ligado para clientes reais.

import { PedidoNdvi, ProvedorNdvi } from './satelite.provedor';
import { PontoNdvi, inicioDaGrade } from './satelite.regras';

const DIA_MS = 86_400_000;

/** Hash estável (0–1) a partir de um texto: mesma área, mesma "personalidade". */
function hash01(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

export class SateliteDemoProvedor implements ProvedorNdvi {
  configurado() {
    return true;
  }

  demonstracao() {
    return true;
  }

  async estatisticas(p: PedidoNdvi): Promise<PontoNdvi[]> {
    const lat = p.poligono.reduce((s, x) => s + x.latitude, 0) / p.poligono.length;
    const lon = p.poligono.reduce((s, x) => s + x.longitude, 0) / p.poligono.length;
    const semente = hash01(`${lat.toFixed(4)}:${lon.toFixed(4)}`);
    const base = 0.5 + semente * 0.2; // 0,50–0,70 de vigor médio da área

    const pontos: PontoNdvi[] = [];
    let t = Date.parse(`${inicioDaGrade(p.de)}T00:00:00Z`);
    const limite = Date.parse(`${p.ate}T00:00:00Z`);
    for (; t <= limite; t += 10 * DIA_MS) {
      const inicio = new Date(t).toISOString().slice(0, 10);
      const mes = new Date(t).getUTCMonth(); // 0 = jan
      // chuvas de outubro a março: mais verde; seca de junho a setembro: pasto cai
      const sazonal = Math.cos(((mes - 1.5) / 12) * 2 * Math.PI) * 0.14;
      const ruido = (hash01(`${semente}:${inicio}`) - 0.5) * 0.06;
      const nublado = hash01(`nuvem:${semente}:${inicio}`) < (mes >= 10 || mes <= 3 ? 0.35 : 0.1);
      const media = Math.max(0.12, Math.min(0.88, base + sazonal + ruido));
      pontos.push({
        inicio,
        // o último intervalo é parcial: termina hoje, como na resposta real (lastIntervalBehavior SHORTEN)
        fim: new Date(Math.min(t + 10 * DIA_MS, limite)).toISOString().slice(0, 10),
        media: nublado ? null : Number(media.toFixed(4)),
        minimo: nublado ? null : Number((media - 0.2).toFixed(4)),
        maximo: nublado ? null : Number(Math.min(0.92, media + 0.18).toFixed(4)),
        desvio: nublado ? null : 0.09,
        cobertura: nublado ? 0 : Number((0.7 + hash01(`cob:${inicio}`) * 0.28).toFixed(3)),
      });
    }
    return pontos;
  }
}
