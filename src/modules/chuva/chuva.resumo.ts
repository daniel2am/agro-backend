// Regras puras do pluviômetro: normalização de data e resumo anual/mensal.

/** Dia civil "YYYY-MM-DD" → Date à meia-noite UTC. Aceita ISO completo (usa só a data). */
export function dataSomente(valor: unknown): Date | null {
  if (typeof valor !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // rejeita 31/02 etc. (o Date "rola" para o mês seguinte)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export const diaIso = (d: Date) => d.toISOString().slice(0, 10);

export interface RegistroChuva {
  data: Date;
  mm: number;
}

export interface ResumoChuva {
  ano: number;
  totalMm: number;
  diasComChuva: number;
  /** 12 posições, janeiro a dezembro, em mm. */
  porMes: number[];
  maiorChuva: { data: string; mm: number } | null;
  /** Soma dos últimos 30 dias até `hoje`. */
  ultimos30Dias: number;
  /** Dias seguidos sem chuva até `hoje` (0 se choveu hoje; null se nunca houve registro). */
  diasSemChuva: number | null;
}

const arred = (n: number) => Math.round(n * 10) / 10;

export function resumirChuvas(todos: RegistroChuva[], ano: number, hoje: Date = new Date()): ResumoChuva {
  const doAno = todos.filter((r) => r.data.getUTCFullYear() === ano && r.mm > 0);
  const porMes = Array<number>(12).fill(0);
  for (const r of doAno) porMes[r.data.getUTCMonth()]! += r.mm;

  const maior = doAno.reduce<RegistroChuva | null>((m, r) => (!m || r.mm > m.mm ? r : m), null);

  const fimHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const DIA = 86_400_000;
  const ultimos30 = todos
    .filter((r) => {
      const t = r.data.getTime();
      return t <= fimHoje && t > fimHoje - 30 * DIA && r.mm > 0;
    })
    .reduce((s, r) => s + r.mm, 0);

  const comChuva = todos.filter((r) => r.mm > 0 && r.data.getTime() <= fimHoje);
  const ultima = comChuva.reduce<number | null>((m, r) => (m === null || r.data.getTime() > m ? r.data.getTime() : m), null);

  return {
    ano,
    totalMm: arred(porMes.reduce((s, v) => s + v, 0)),
    diasComChuva: doAno.length,
    porMes: porMes.map(arred),
    maiorChuva: maior ? { data: diaIso(maior.data), mm: arred(maior.mm) } : null,
    ultimos30Dias: arred(ultimos30),
    diasSemChuva: ultima === null ? null : Math.round((fimHoje - ultima) / DIA),
  };
}
