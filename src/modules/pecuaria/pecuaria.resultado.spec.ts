import { calcularResultadoPecuaria, simularPreco, EntradaResultado } from './pecuaria.resultado';

const d = (s: string) => new Date(`${s}T12:00:00Z`);

function base(over: Partial<EntradaResultado> = {}): EntradaResultado {
  return { despesas: [], pesagens: [], vendas: [], animaisAtivos: 0, rateioGeraisPct: 100, ...over };
}

describe('calcularResultadoPecuaria', () => {
  it('conta feita à mão: custo por arroba produzida', () => {
    // 2 bois: 400→460 e 380→450 em 90 dias  => ganho 130 kg
    // @ produzidas = 130 × 52% / 15 = 4,5067
    // custo operacional = ração 3.000 + sanidade 500 = 3.500 => 776,63/@
    const r = calcularResultadoPecuaria(
      base({
        despesas: [
          { categoria: 'racao', valor: 3000 },
          { categoria: 'sanidade', valor: 500 },
        ],
        pesagens: [
          { animalId: 'a', data: d('2026-01-01'), pesoKg: 400 },
          { animalId: 'a', data: d('2026-04-01'), pesoKg: 460 },
          { animalId: 'b', data: d('2026-01-01'), pesoKg: 380 },
          { animalId: 'b', data: d('2026-04-01'), pesoKg: 450 },
        ],
        animaisAtivos: 2,
      }),
    );
    expect(r.producao.ganhoKg).toBe(130);
    expect(r.producao.arrobasProduzidas).toBe(4.51);
    expect(r.custos.operacional).toBe(3500);
    expect(r.custoPorArroba).toBe(776.63);
    expect(r.pontoEquilibrio.precoMinimoArroba).toBe(776.63);
    expect(r.cobertura).toEqual({ animaisPesados: 2, animaisAtivos: 2 });
  });

  it('compra de animais, insumos/sementes e custo de lavoura NÃO entram no custo por arroba', () => {
    const r = calcularResultadoPecuaria(
      base({
        despesas: [
          { categoria: 'racao', valor: 1000 },
          { categoria: 'compra_animais', valor: 50_000 },
          { categoria: 'insumos', valor: 9_000 },
          { categoria: 'sementes', valor: 4_000 },
          { categoria: 'combustivel', valor: 800, custoLavouraId: 'lav1' },
        ],
      }),
    );
    expect(r.custos.operacional).toBe(1000);
    expect(r.custos.compraAnimais).toBe(50_000);
  });

  it('custos gerais são rateados e despesa sem categoria não some', () => {
    const r = calcularResultadoPecuaria(
      base({
        despesas: [
          { categoria: 'mao_de_obra', valor: 4000 },
          { categoria: null, valor: 1000 },
          { categoria: 'racao', valor: 2000 },
        ],
        rateioGeraisPct: 60,
      }),
    );
    expect(r.custos.geraisBrutos).toBe(5000);
    expect(r.custos.geraisRateados).toBe(3000);
    expect(r.custos.operacional).toBe(5000);
  });

  it('rateio é limitado a 0–100%', () => {
    const r = calcularResultadoPecuaria(base({ despesas: [{ categoria: 'energia', valor: 100 }], rateioGeraisPct: 250 }));
    expect(r.premissas.rateioGeraisPct).toBe(100);
    expect(r.custos.geraisRateados).toBe(100);
  });

  it('sem 2 pesagens por animal não inventa arrobas: custo por arroba fica nulo', () => {
    const r = calcularResultadoPecuaria(
      base({
        despesas: [{ categoria: 'racao', valor: 1000 }],
        pesagens: [{ animalId: 'a', data: d('2026-01-01'), pesoKg: 400 }],
        animaisAtivos: 5,
      }),
    );
    expect(r.custoPorArroba).toBeNull();
    expect(r.pontoEquilibrio.precoMinimoArroba).toBeNull();
    expect(r.cobertura.animaisPesados).toBe(0);
  });

  it('animal que perdeu peso reduz o ganho total (não é escondido)', () => {
    const r = calcularResultadoPecuaria(
      base({
        pesagens: [
          { animalId: 'a', data: d('2026-01-01'), pesoKg: 400 },
          { animalId: 'a', data: d('2026-03-01'), pesoKg: 460 },
          { animalId: 'b', data: d('2026-01-01'), pesoKg: 400 },
          { animalId: 'b', data: d('2026-03-01'), pesoKg: 380 },
        ],
      }),
    );
    expect(r.producao.ganhoKg).toBe(40);
  });

  it('pesagens no mesmo dia não formam ganho', () => {
    const r = calcularResultadoPecuaria(
      base({
        pesagens: [
          { animalId: 'a', data: d('2026-01-01'), pesoKg: 400 },
          { animalId: 'a', data: d('2026-01-01'), pesoKg: 420 },
        ],
      }),
    );
    expect(r.producao.ganhoKg).toBe(0);
    expect(r.cobertura.animaisPesados).toBe(0);
  });

  it('vendas: preço médio por arroba só sobre quem tem peso conhecido', () => {
    // 540 kg × 52% / 15 = 18,72 @ ; vendido por R$ 17.000  => 908,12 R$/@
    const r = calcularResultadoPecuaria(
      base({
        vendas: [
          { valor: 17_000, data: d('2026-05-01'), animalId: 'a', pesoKg: 540 },
          { valor: 8_000, data: d('2026-05-02'), animalId: 'b', pesoKg: null },
        ],
      }),
    );
    expect(r.vendas.cabecas).toBe(2);
    expect(r.vendas.cabecasComPeso).toBe(1);
    expect(r.vendas.receita).toBe(25_000);
    expect(r.vendas.arrobasVendidas).toBe(18.72);
    expect(r.vendas.precoMedioArroba).toBe(908.12);
  });

  it('resultado líquido e margem por arroba', () => {
    const r = calcularResultadoPecuaria(
      base({
        despesas: [
          { categoria: 'racao', valor: 3000 },
          { categoria: 'compra_animais', valor: 10_000 },
        ],
        pesagens: [
          { animalId: 'a', data: d('2026-01-01'), pesoKg: 400 },
          { animalId: 'a', data: d('2026-04-01'), pesoKg: 530 },
        ],
        vendas: [{ valor: 20_000, data: d('2026-05-01'), animalId: 'a', pesoKg: 530 }],
      }),
    );
    // ganho 130 kg => 4,5067 @ ; custo/@ = 3000/4,5067 = 665,68
    // vende 530 kg => 18,3733 @ ; preço = 20000/18,3733 = 1088,53
    expect(r.custoPorArroba).toBe(665.68);
    expect(r.vendas.precoMedioArroba).toBe(1088.53);
    expect(r.resultado.margemPorArroba).toBe(422.85);
    expect(r.resultado.liquido).toBe(7000); // 20.000 − 3.000 − 10.000
  });

  it('rendimento de carcaça configurável muda as arrobas', () => {
    const entrada = base({
      pesagens: [
        { animalId: 'a', data: d('2026-01-01'), pesoKg: 300 },
        { animalId: 'a', data: d('2026-04-01'), pesoKg: 400 },
      ],
    });
    expect(calcularResultadoPecuaria({ ...entrada, rendimentoPct: 50 }).producao.arrobasProduzidas).toBe(3.33);
    expect(calcularResultadoPecuaria({ ...entrada, rendimentoPct: 54 }).producao.arrobasProduzidas).toBe(3.6);
  });
});

describe('simularPreco', () => {
  it('margem por arroba e total a um preço hipotético', () => {
    expect(simularPreco(700, 100, 750)).toEqual({ precoArroba: 750, margemPorArroba: 50, margemTotal: 5000 });
    expect(simularPreco(700, 100, 650).margemTotal).toBe(-5000);
  });
});
