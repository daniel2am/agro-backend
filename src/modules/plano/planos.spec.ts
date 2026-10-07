import {
  DEFINICOES,
  PLANOS,
  RECURSOS,
  ehIlimitado,
  mensagemLimite,
  menorPlanoComRecurso,
  planoEmVigor,
  proximoPlano,
  temRecurso,
  verificarLimite,
} from './planos';

describe('definição dos planos', () => {
  it('o plano básico segue o pedido: 1 propriedade, 3 áreas, 99 animais, sem extras', () => {
    expect(DEFINICOES.basico.limites).toEqual({ fazendas: 1, areas: 3, animais: 99, membros: 1 });
    expect(DEFINICOES.basico.recursos).toEqual([]);
  });

  it('cada plano libera tudo o que o anterior libera (escada de upgrade)', () => {
    for (let i = 1; i < PLANOS.length; i++) {
      const menor = DEFINICOES[PLANOS[i - 1]!];
      const maior = DEFINICOES[PLANOS[i]!];
      for (const r of menor.recursos) expect(maior.recursos).toContain(r);
      for (const k of ['fazendas', 'areas', 'animais', 'membros'] as const) {
        expect(maior.limites[k]).toBeGreaterThan(menor.limites[k]);
      }
    }
  });

  it('todo recurso existe em pelo menos um plano (nenhum órfão)', () => {
    for (const r of RECURSOS) expect(PLANOS.some((p) => temRecurso(p, r))).toBe(true);
  });

  it('o avançado é ilimitado', () => {
    for (const v of Object.values(DEFINICOES.avancado.limites)) expect(ehIlimitado(v)).toBe(true);
    expect(ehIlimitado(DEFINICOES.intermediario.limites.animais)).toBe(false);
  });
});

describe('planoEmVigor', () => {
  const agora = new Date('2026-10-10T12:00:00Z');

  it('vencido volta ao básico; vigente e sem vencimento mantêm', () => {
    expect(planoEmVigor('avancado', new Date('2026-10-01'), agora)).toBe('basico');
    expect(planoEmVigor('avancado', new Date('2026-10-20'), agora)).toBe('avancado');
    expect(planoEmVigor('intermediario', null, agora)).toBe('intermediario');
    expect(planoEmVigor('intermediario', undefined, agora)).toBe('intermediario');
  });

  it('vence exatamente no instante marcado (inclusive)', () => {
    expect(planoEmVigor('avancado', agora, agora)).toBe('basico');
  });

  it('básico continua básico', () => {
    expect(planoEmVigor('basico', new Date('2030-01-01'), agora)).toBe('basico');
  });
});

describe('verificarLimite', () => {
  it('permite até o limite e bloqueia o item seguinte', () => {
    expect(verificarLimite('basico', 'animais', 98).permitido).toBe(true);
    expect(verificarLimite('basico', 'animais', 99).permitido).toBe(false);
    expect(verificarLimite('basico', 'fazendas', 0).permitido).toBe(true);
    expect(verificarLimite('basico', 'fazendas', 1).permitido).toBe(false);
  });

  it('considera quantos itens serão adicionados de uma vez (ex.: importar 5 invernadas)', () => {
    expect(verificarLimite('basico', 'areas', 1, 2).permitido).toBe(true);
    expect(verificarLimite('basico', 'areas', 1, 3).permitido).toBe(false);
  });

  it('calcula o restante sem ficar negativo (após downgrade com uso acima do limite)', () => {
    const r = verificarLimite('basico', 'animais', 250);
    expect(r.permitido).toBe(false);
    expect(r.restante).toBe(0);
  });

  it('plano ilimitado sempre permite', () => {
    expect(verificarLimite('avancado', 'animais', 1_000_000).permitido).toBe(true);
  });
});

describe('upgrade', () => {
  it('próximo plano e menor plano com o recurso', () => {
    expect(proximoPlano('basico')).toBe('intermediario');
    expect(proximoPlano('intermediario')).toBe('avancado');
    expect(proximoPlano('avancado')).toBeNull();
    expect(menorPlanoComRecurso('clima')).toBe('intermediario');
    expect(menorPlanoComRecurso('equipe')).toBe('avancado');
  });

  it('mensagem cita o limite e indica o upgrade', () => {
    expect(mensagemLimite('basico', 'animais', 99)).toBe(
      'O plano Essencial permite até 99 animais. Faça upgrade para o plano Produtor para continuar.',
    );
    expect(mensagemLimite('basico', 'fazendas', 1)).toContain('1 propriedade.');
    expect(mensagemLimite('intermediario', 'areas', 20)).toContain('Pro');
  });
});
