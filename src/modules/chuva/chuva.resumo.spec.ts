import { dataSomente, resumirChuvas } from './chuva.resumo';

const d = (s: string) => dataSomente(s)!;

describe('dataSomente', () => {
  it('aceita AAAA-MM-DD e ISO completo, usando só o dia civil', () => {
    expect(dataSomente('2026-03-05')!.toISOString()).toBe('2026-03-05T00:00:00.000Z');
    expect(dataSomente('2026-03-05T23:30:00-03:00')!.toISOString()).toBe('2026-03-05T00:00:00.000Z');
  });
  it('rejeita lixo e datas impossíveis', () => {
    expect(dataSomente('ontem')).toBeNull();
    expect(dataSomente('2026-02-31')).toBeNull();
    expect(dataSomente(20260305)).toBeNull();
  });
});

describe('resumirChuvas', () => {
  const hoje = new Date(2026, 9, 8); // 8/out/2026 (local)
  const regs = [
    { data: d('2026-01-10'), mm: 40 },
    { data: d('2026-01-11'), mm: 25.5 },
    { data: d('2026-10-01'), mm: 12 },
    { data: d('2026-10-05'), mm: 30 },
    { data: d('2026-10-06'), mm: 0 }, // "não choveu" não conta como dia de chuva
    { data: d('2025-12-20'), mm: 99 },
  ];

  it('soma por mês, total e dias com chuva do ano pedido', () => {
    const r = resumirChuvas(regs, 2026, hoje);
    expect(r.porMes[0]).toBe(65.5);
    expect(r.porMes[9]).toBe(42);
    expect(r.totalMm).toBe(107.5);
    expect(r.diasComChuva).toBe(4);
    expect(r.maiorChuva).toEqual({ data: '2026-01-10', mm: 40 });
  });

  it('últimos 30 dias atravessam o ano e ignoram o futuro', () => {
    const r = resumirChuvas([...regs, { data: d('2026-10-20'), mm: 500 }], 2026, hoje);
    expect(r.ultimos30Dias).toBe(42);
  });

  it('dias sem chuva contam desde a última chuva real', () => {
    expect(resumirChuvas(regs, 2026, hoje).diasSemChuva).toBe(3); // 5/out → 8/out
    expect(resumirChuvas([{ data: d('2026-10-08'), mm: 5 }], 2026, hoje).diasSemChuva).toBe(0);
    expect(resumirChuvas([], 2026, hoje).diasSemChuva).toBeNull();
  });

  it('ano sem registro vem zerado', () => {
    const r = resumirChuvas(regs, 2024, hoje);
    expect(r.totalMm).toBe(0);
    expect(r.maiorChuva).toBeNull();
    expect(r.porMes).toEqual(Array(12).fill(0));
  });
});
