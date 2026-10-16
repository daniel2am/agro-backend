// src/modules/fazenda/perimetro.ts
//
// Validação do limite da propriedade enviado pelo app. O app é um cliente não confiável:
// aqui a entrada é conferida ponto a ponto antes de ir para o banco (JSONB).
//
// Formato guardado: lista de anéis, cada anel uma lista de {latitude, longitude}
// (sem repetir o primeiro ponto no fim). Vários anéis = imóvel com várias parcelas.

import { BadRequestException } from '@nestjs/common';

export interface PontoPerimetro {
  latitude: number;
  longitude: number;
}
export type AnelPerimetro = PontoPerimetro[];

export const MAX_ANEIS = 60;
export const MAX_PONTOS_ANEL = 1000;
export const MAX_PONTOS_TOTAL = 5000;
// caixa do território brasileiro (com folga para ilhas): fora dela é erro ou ataque
const LAT_MIN = -34;
const LAT_MAX = 6;
const LON_MIN = -74;
const LON_MAX = -33;

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const erro = (msg: string) => new BadRequestException(`Perímetro inválido: ${msg}`);

/**
 * Valida e normaliza o perímetro.
 * - undefined → undefined (campo não enviado, nada muda)
 * - null ou [] → null (apaga o perímetro)
 * - qualquer outra coisa fora do formato → BadRequestException
 */
export function normalizarPerimetro(entrada: unknown): AnelPerimetro[] | null | undefined {
  if (entrada === undefined) return undefined;
  if (entrada === null) return null;
  if (!Array.isArray(entrada)) throw erro('esperado uma lista de anéis.');
  if (entrada.length === 0) return null;
  if (entrada.length > MAX_ANEIS) throw erro(`no máximo ${MAX_ANEIS} anéis.`);

  let total = 0;
  const aneis: AnelPerimetro[] = [];
  for (const bruto of entrada) {
    if (!Array.isArray(bruto)) throw erro('cada anel deve ser uma lista de pontos.');
    if (bruto.length < 3) throw erro('cada anel precisa de pelo menos 3 pontos.');
    if (bruto.length > MAX_PONTOS_ANEL) throw erro(`no máximo ${MAX_PONTOS_ANEL} pontos por anel.`);
    total += bruto.length;
    if (total > MAX_PONTOS_TOTAL) throw erro(`no máximo ${MAX_PONTOS_TOTAL} pontos no total.`);

    const anel: AnelPerimetro = [];
    for (const p of bruto) {
      if (!ehObjeto(p)) throw erro('ponto fora do formato {latitude, longitude}.');
      const { latitude, longitude } = p;
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw erro('coordenadas devem ser números.');
      }
      if (latitude < LAT_MIN || latitude > LAT_MAX || longitude < LON_MIN || longitude > LON_MAX) {
        throw erro('coordenada fora do território brasileiro.');
      }
      // 6 casas decimais ≈ 11 cm; só os dois campos são guardados (nada além do esperado)
      anel.push({ latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 });
    }
    aneis.push(anel);
  }
  return aneis;
}
