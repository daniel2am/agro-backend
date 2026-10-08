import {
  alertaPesagemAtrasada,
  alertasDeGanho,
  alertasDeLotacao,
  alertasDeVacina,
  ordenarAlertas,
} from './alertas.regras';

const agora = new Date('2026-10-08T12:00:00');
const dias = (n: number) => new Date(agora.getTime() - n * 86_400_000);

describe('pesagem atrasada', () => {
  it('conta quem passou de 60 dias; nunca pesado usa a data de cadastro', () => {
    const a = alertaPesagemAtrasada(
      [
        { id: '1', brinco: 'A1', criadoEm: dias(200), ultimaPesagem: dias(30) }, // ok
        { id: '2', brinco: 'A2', criadoEm: dias(200), ultimaPesagem: dias(61) }, // atrasado
        { id: '3', brinco: 'A3', criadoEm: dias(90), ultimaPesagem: null }, // nunca pesado, antigo
        { id: '4', brinco: 'A4', criadoEm: dias(5), ultimaPesagem: null }, // recém-cadastrado
      ],
      agora,
    )!;
    expect(a.quantidade).toBe(2);
    expect(a.animais!.map((x) => x.brinco)).toEqual(['A2', 'A3']);
    expect(a.severidade).toBe('info');
  });
  it('sem atrasados não gera alerta', () => {
    expect(alertaPesagemAtrasada([{ id: '1', brinco: 'A', criadoEm: dias(10), ultimaPesagem: dias(10) }], agora)).toBeNull();
  });
  it('lista só 5 brincos no texto mas guarda até 20 para o app', () => {
    const muitos = Array.from({ length: 30 }, (_, i) => ({ id: `${i}`, brinco: `B${i}`, criadoEm: dias(300), ultimaPesagem: null }));
    const a = alertaPesagemAtrasada(muitos, agora)!;
    expect(a.quantidade).toBe(30);
    expect(a.animais).toHaveLength(20);
    expect(a.detalhe).toContain('e mais 25');
  });
});

describe('ganho de peso', () => {
  const pes = (kgAnt: number, diasAnt: number, kgUlt: number, diasUlt: number) => [
    { data: dias(diasAnt), pesoKg: kgAnt },
    { data: dias(diasUlt), pesoKg: kgUlt },
  ];

  it('separa perda de peso (alta) de ganho baixo (média) e ignora quem vai bem', () => {
    const r = alertasDeGanho([
      { id: '1', brinco: 'perdeu', pesagens: pes(400, 60, 380, 30) }, // -0,67 kg/dia
      { id: '2', brinco: 'lento', pesagens: pes(400, 60, 406, 30) }, //  0,2 kg/dia
      { id: '3', brinco: 'bom', pesagens: pes(400, 60, 430, 30) }, //  1,0 kg/dia
    ]);
    expect(r.map((a) => a.tipo)).toEqual(['perda_peso', 'gmd_baixo']);
    expect(r[0]!.severidade).toBe('alta');
    expect(r[0]!.animais![0]!.brinco).toBe('perdeu');
    expect(r[1]!.animais![0]!.brinco).toBe('lento');
  });

  it('pesagens com menos de 7 dias de intervalo não geram alerta (GMD ruidoso)', () => {
    expect(alertasDeGanho([{ id: '1', brinco: 'x', pesagens: pes(400, 5, 380, 1) }])).toEqual([]);
  });

  it('com menos de 2 pesagens não há como avaliar', () => {
    expect(alertasDeGanho([{ id: '1', brinco: 'x', pesagens: [{ data: dias(10), pesoKg: 300 }] }])).toEqual([]);
  });

  it('a ordem das pesagens recebidas não importa', () => {
    const r = alertasDeGanho([{ id: '1', brinco: 'x', pesagens: pes(400, 60, 380, 30).reverse() }]);
    expect(r[0]!.tipo).toBe('perda_peso');
  });
});

describe('lotação', () => {
  // 450 kg = 1 UA; capacidade 1,5 UA/ha
  const inv = (n: number, kg: number | null, area: number) => ({
    id: 'i1', nome: 'Pasto Sul', areaHa: area, pesos: Array(n).fill(kg) as (number | null)[],
  });

  it('dentro da capacidade: sem alerta', () => {
    expect(alertasDeLotacao([inv(30, 450, 25)])).toEqual([]); // 1,2 UA/ha = 80%
  });
  it('100–120%: atenção (média)', () => {
    const r = alertasDeLotacao([inv(33, 450, 20)]); // 1,65 UA/ha = 110%
    expect(r[0]!.tipo).toBe('lotacao_atencao');
    expect(r[0]!.severidade).toBe('media');
  });
  it('acima de 120%: superlotada (alta)', () => {
    const r = alertasDeLotacao([inv(40, 450, 20)]); // 2,0 UA/ha = 133%
    expect(r[0]!.tipo).toBe('superlotacao');
    expect(r[0]!.severidade).toBe('alta');
    expect(r[0]!.titulo).toContain('133%');
  });
  it('sem peso, sem área ou sem animais: não alerta (não inventa)', () => {
    expect(alertasDeLotacao([inv(50, null, 10), inv(0, 450, 10), inv(50, 450, 0)])).toEqual([]);
  });
});

describe('vacinas', () => {
  const med = (nome: string, quando: Date, brinco = 'B1') => ({ id: nome, nome, proximaAplicacao: quando, animalId: `a-${brinco}`, brinco });
  const futuro = (n: number) => new Date(agora.getTime() + n * 86_400_000);

  it('separa vencidas, próximas (7 dias) e ignora as distantes', () => {
    const r = alertasDeVacina([med('Aftosa', dias(3)), med('Brucelose', futuro(2)), med('Raiva', futuro(20))], agora);
    expect(r.map((a) => a.tipo)).toEqual(['vacina_vencida', 'vacina_proxima']);
    expect(r[0]!.severidade).toBe('alta');
    expect(r[1]!.detalhe).toContain('Brucelose');
    expect(r[1]!.detalhe).not.toContain('Raiva');
  });
  it('o que vence hoje é "próxima", não "vencida"', () => {
    const r = alertasDeVacina([med('Hoje', new Date(2026, 9, 8, 0, 0, 0))], agora);
    expect(r.map((a) => a.tipo)).toEqual(['vacina_proxima']);
  });
});

describe('ordenarAlertas', () => {
  it('alta antes de média antes de info, estável', () => {
    const mk = (id: string, s: 'alta' | 'media' | 'info') => ({ id, tipo: 'gmd_baixo' as const, severidade: s, titulo: id, detalhe: '', quantidade: 1 });
    expect(ordenarAlertas([mk('i', 'info'), mk('m1', 'media'), mk('a', 'alta'), mk('m2', 'media')]).map((x) => x.id)).toEqual(['a', 'm1', 'm2', 'i']);
  });
});
