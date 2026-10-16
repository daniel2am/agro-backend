import { BadRequestException } from '@nestjs/common';
import { MAX_ANEIS, MAX_PONTOS_ANEL, normalizarPerimetro } from './perimetro';

const quad = (lon = -57.2, lat = -21.98, d = 0.01) => [
  { latitude: lat, longitude: lon },
  { latitude: lat + d, longitude: lon },
  { latitude: lat + d, longitude: lon + d },
  { latitude: lat, longitude: lon + d },
];

describe('normalizarPerimetro', () => {
  it('não enviado → undefined (nada muda); null ou lista vazia → null (apaga)', () => {
    expect(normalizarPerimetro(undefined)).toBeUndefined();
    expect(normalizarPerimetro(null)).toBeNull();
    expect(normalizarPerimetro([])).toBeNull();
  });

  it('aceita um ou vários anéis e arredonda a 6 casas', () => {
    const r = normalizarPerimetro([[{ latitude: -21.98123456789, longitude: -57.2 }, ...quad().slice(1)], quad(-57.1, -21.9)])!;
    expect(r).toHaveLength(2);
    expect(r[0]![0]).toEqual({ latitude: -21.981235, longitude: -57.2 });
  });

  it('guarda só latitude e longitude (campos extras são descartados)', () => {
    const suspeito = quad().map((p) => ({ ...p, accuracy: 3, __proto__: { x: 1 }, evil: '<script>' }));
    const r = normalizarPerimetro([suspeito])!;
    expect(Object.keys(r[0]![0]!).sort()).toEqual(['latitude', 'longitude']);
  });

  it.each([
    ['não é lista', { latitude: 1 }],
    ['texto', 'abc'],
    ['anel não é lista', [{ latitude: -21, longitude: -57 }]],
    ['anel com 2 pontos', [quad().slice(0, 2)]],
    ['ponto não é objeto', [[[-57, -21], [-57, -21.1], [-56.9, -21.1]]]],
    ['coordenada como texto', [[...quad().slice(0, 2), { latitude: '-21', longitude: -57 }]]],
    ['NaN', [[...quad().slice(0, 2), { latitude: NaN, longitude: -57 }]]],
    ['Infinity', [[...quad().slice(0, 2), { latitude: -21, longitude: Infinity }]]],
    ['fora do Brasil', [quad(10, 50)]],
    ['lat e lon trocadas', [quad(-21.98, -57.2)]],
  ])('recusa: %s', (_nome, entrada) => {
    expect(() => normalizarPerimetro(entrada)).toThrow(BadRequestException);
  });

  it('recusa excesso de anéis e de pontos', () => {
    expect(() => normalizarPerimetro(Array.from({ length: MAX_ANEIS + 1 }, () => quad()))).toThrow(BadRequestException);
    const grande = Array.from({ length: MAX_PONTOS_ANEL + 1 }, (_, i) => ({ latitude: -21 - i * 1e-6, longitude: -57 }));
    expect(() => normalizarPerimetro([grande])).toThrow(BadRequestException);
    // 6 anéis de 1000 pontos = 6000 > teto total de 5000
    const mil = Array.from({ length: MAX_PONTOS_ANEL }, (_, i) => ({ latitude: -21 - i * 1e-6, longitude: -57 }));
    expect(() => normalizarPerimetro(Array.from({ length: 6 }, () => mil))).toThrow(BadRequestException);
  });
});
