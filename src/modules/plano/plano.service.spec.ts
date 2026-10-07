import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PlanoService } from './plano.service';
import { PrismaService } from 'src/prisma.service';
import { chaveConfere } from './plano.controller';

const USER = 'user-1';
const DIA = 86_400_000;

function makePrisma() {
  return {
    usuario: { findUnique: jest.fn(), update: jest.fn() },
    fazendaUsuario: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    invernada: { count: jest.fn().mockResolvedValue(0) },
    lavoura: { count: jest.fn().mockResolvedValue(0) },
    animal: { count: jest.fn().mockResolvedValue(0) },
  } as any;
}

describe('PlanoService', () => {
  let service: PlanoService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const m: TestingModule = await Test.createTestingModule({
      providers: [PlanoService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = m.get(PlanoService);
  });

  const comPlano = (plano: string, ateEm: Date | null = null) =>
    prisma.usuario.findUnique.mockResolvedValue({ plano, planoAteEm: ateEm });

  describe('plano em vigor', () => {
    it('vencido vale como básico', async () => {
      comPlano('avancado', new Date(Date.now() - DIA));
      await expect(service.planoDoUsuario(USER)).resolves.toBe('basico');
    });

    it('vigente é respeitado', async () => {
      comPlano('intermediario', new Date(Date.now() + DIA));
      await expect(service.planoDoUsuario(USER)).resolves.toBe('intermediario');
    });

    it('usuário inexistente', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(service.planoDoUsuario(USER)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('assertLimite', () => {
    it('básico com 99 animais: o 100º devolve 402 PLANO_LIMITE sugerindo o upgrade', async () => {
      comPlano('basico');
      prisma.animal.count.mockResolvedValue(99);
      await expect(service.assertLimite(USER, 'animais')).rejects.toMatchObject({
        status: 402,
        response: expect.objectContaining({
          code: 'PLANO_LIMITE', recurso: 'animais', limite: 99, usado: 99, plano: 'basico', sugerido: 'intermediario',
        }),
      });
    });

    it('básico com 98: ainda cabe um', async () => {
      comPlano('basico');
      prisma.animal.count.mockResolvedValue(98);
      await expect(service.assertLimite(USER, 'animais')).resolves.toBeUndefined();
    });

    it('invernadas e lavouras ativas somam no mesmo limite de áreas', async () => {
      comPlano('basico');
      prisma.invernada.count.mockResolvedValue(2);
      prisma.lavoura.count.mockResolvedValue(1);
      await expect(service.assertLimite(USER, 'areas')).rejects.toMatchObject({ status: 402 });
      // só lavouras ATIVAS contam; animais só os ATIVOS
      expect(prisma.lavoura.count.mock.calls[0][0].where.status).toBe('ativo');
      expect(prisma.animal.count.mock.calls[0][0].where.status).toBe('ativo');
    });

    it('uma segunda propriedade no básico é bloqueada', async () => {
      comPlano('basico');
      prisma.fazendaUsuario.count.mockResolvedValue(1);
      await expect(service.assertLimite(USER, 'fazendas')).rejects.toMatchObject({
        response: expect.objectContaining({ recurso: 'fazendas', limite: 1 }),
      });
    });

    it('o uso conta só as fazendas que o usuário ADMINISTRA (colaborador não consome o plano dele)', async () => {
      comPlano('basico');
      await service.assertLimite(USER, 'animais');
      const where = prisma.animal.count.mock.calls[0][0].where;
      expect(where.fazenda).toEqual({ usuarios: { some: { usuarioId: USER, papel: 'administrador' } } });
    });

    it('plano avançado não bloqueia nem consulta além do necessário', async () => {
      comPlano('avancado', new Date(Date.now() + DIA));
      prisma.animal.count.mockResolvedValue(50_000);
      await expect(service.assertLimite(USER, 'animais')).resolves.toBeUndefined();
    });

    it('adicionar vários de uma vez respeita o limite (importação em lote)', async () => {
      comPlano('basico');
      prisma.invernada.count.mockResolvedValue(1);
      await expect(service.assertLimite(USER, 'areas', 2)).resolves.toBeUndefined();
      await expect(service.assertLimite(USER, 'areas', 3)).rejects.toMatchObject({ status: 402 });
    });
  });

  describe('assertRecurso', () => {
    it('recurso fora do plano devolve 402 PLANO_RECURSO com o plano necessário', async () => {
      comPlano('basico');
      await expect(service.assertRecurso(USER, 'equipe')).rejects.toMatchObject({
        status: 402,
        response: expect.objectContaining({ code: 'PLANO_RECURSO', recurso: 'equipe', sugerido: 'avancado' }),
      });
    });

    it('libera quando o plano tem', async () => {
      comPlano('avancado');
      await expect(service.assertRecurso(USER, 'equipe')).resolves.toBeUndefined();
    });
  });

  describe('donoDaFazenda', () => {
    it('é o administrador mais antigo', async () => {
      prisma.fazendaUsuario.findFirst.mockResolvedValue({ usuarioId: 'dono' });
      await expect(service.donoDaFazenda('f1')).resolves.toBe('dono');
      expect(prisma.fazendaUsuario.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { fazendaId: 'f1', papel: 'administrador' }, orderBy: { criadoEm: 'asc' } }),
      );
    });

    it('sem administrador', async () => {
      prisma.fazendaUsuario.findFirst.mockResolvedValue(null);
      await expect(service.donoDaFazenda('f1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resumo', () => {
    it('em teste: mostra dias restantes e plano completo', async () => {
      comPlano('avancado', new Date(Date.now() + 10 * DIA - 1000));
      const r = await service.resumo(USER);
      expect(r.plano).toBe('avancado');
      expect(r.emTeste).toBe(true);
      expect(r.diasRestantes).toBe(10);
      expect(r.limites.animais.limite).toBeNull(); // ilimitado
      expect(r.planos).toHaveLength(3);
    });

    it('teste vencido: volta ao básico e avisa que expirou', async () => {
      comPlano('avancado', new Date(Date.now() - DIA));
      const r = await service.resumo(USER);
      expect(r.plano).toBe('basico');
      expect(r.expirou).toBe(true);
      expect(r.limites.animais).toEqual({ usado: 0, limite: 99 });
    });

    it('básico: sem vencimento nem teste', async () => {
      comPlano('basico');
      const r = await service.resumo(USER);
      expect(r).toMatchObject({ plano: 'basico', expirou: false, emTeste: false, diasRestantes: null });
    });
  });

  describe('definirPlano / teste gratuito', () => {
    it('básico limpa o vencimento', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ id: USER });
      prisma.usuario.update.mockResolvedValue({});
      await service.definirPlano('A@B.com ', 'basico', new Date());
      expect(prisma.usuario.findUnique.mock.calls[0][0].where.email).toBe('a@b.com');
      expect(prisma.usuario.update.mock.calls[0][0].data).toEqual({ plano: 'basico', planoAteEm: null });
    });

    it('teste gratuito: padrão 14 dias no avançado; TRIAL_DIAS=0 desliga', () => {
      const agora = new Date('2026-10-01T00:00:00Z');
      expect(PlanoService.dadosDoTeste({}, agora)).toEqual({ plano: 'avancado', planoAteEm: new Date('2026-10-15T00:00:00Z') });
      expect(PlanoService.dadosDoTeste({ TRIAL_DIAS: '7' } as any, agora).planoAteEm).toEqual(new Date('2026-10-08T00:00:00Z'));
      expect(PlanoService.dadosDoTeste({ TRIAL_DIAS: '0' } as any, agora)).toEqual({});
      expect(PlanoService.dadosDoTeste({ TRIAL_DIAS: 'x' } as any, agora)).toEqual({});
    });
  });
});

describe('chaveConfere (admin)', () => {
  it('só aceita a chave exata', () => {
    expect(chaveConfere('segredo', 'segredo')).toBe(true);
    expect(chaveConfere('segredo2', 'segredo')).toBe(false);
    expect(chaveConfere('segred', 'segredo')).toBe(false);
  });

  it('sem chave no servidor ou no pedido, nunca confere', () => {
    expect(chaveConfere('x', undefined)).toBe(false);
    expect(chaveConfere(undefined, 'x')).toBe(false);
    expect(chaveConfere('', '')).toBe(false);
  });
});
