import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EquipeService, PAPEIS_CONVIDAVEIS, PAPEIS_FINANCEIRO, normalizarEmail } from './equipe.service';
import { PrismaService } from 'src/prisma.service';
import { PlanoService, erroDePlano, erroDeRecurso } from '../plano/plano.service';

const F = 'faz-1';
const ADMIN = 'admin-1';
const OUTRO = 'user-2';

function makePrisma() {
  const m: any = {
    fazendaUsuario: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn().mockResolvedValue(1), create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
    conviteFazenda: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0), create: jest.fn(), deleteMany: jest.fn() },
    usuario: { findUnique: jest.fn() },
  };
  m.$transaction = jest.fn((ops: any[]) => Promise.all(ops));
  return m;
}

describe('EquipeService', () => {
  let service: EquipeService;
  let prisma: ReturnType<typeof makePrisma>;
  let planos: any;

  /** papel de cada usuário na fazenda; ausente = não é membro */
  const papeis = (mapa: Record<string, string>) =>
    prisma.fazendaUsuario.findFirst.mockImplementation(async ({ where }: any) =>
      mapa[where.usuarioId] ? { papel: mapa[where.usuarioId] } : null,
    );

  beforeEach(async () => {
    prisma = makePrisma();
    planos = {
      assertRecursoDaFazenda: jest.fn().mockResolvedValue(undefined),
      assertLimite: jest.fn().mockResolvedValue(undefined),
      donoDaFazenda: jest.fn().mockResolvedValue(ADMIN),
    };
    const m: TestingModule = await Test.createTestingModule({
      providers: [EquipeService, { provide: PrismaService, useValue: prisma }, { provide: PlanoService, useValue: planos }],
    }).compile();
    service = m.get(EquipeService);
  });

  it('regras de papel: colaborador fica fora do financeiro; só gestor/colaborador são convidáveis', () => {
    expect(PAPEIS_FINANCEIRO).toEqual(['administrador', 'gestor']);
    expect(PAPEIS_CONVIDAVEIS).toEqual(['gestor', 'colaborador']);
  });

  describe('listar', () => {
    it('quem não é da fazenda não vê nada', async () => {
      papeis({});
      await expect(service.listar(F, OUTRO)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('colaborador só descobre o próprio papel (sem lista de pessoas)', async () => {
      papeis({ [OUTRO]: 'colaborador' });
      await expect(service.listar(F, OUTRO)).resolves.toEqual({ meuPapel: 'colaborador', membros: [], convites: [] });
      expect(prisma.fazendaUsuario.findMany).not.toHaveBeenCalled();
    });

    it('gestor vê a equipe mas não os convites pendentes', async () => {
      papeis({ [OUTRO]: 'gestor' });
      prisma.fazendaUsuario.findMany.mockResolvedValue([{ usuarioId: OUTRO, papel: 'gestor', criadoEm: new Date(), usuario: { nome: 'Z', email: 'z@z.com' } }]);
      prisma.conviteFazenda.findMany.mockResolvedValue([{ id: 'c1', email: 'x@x.com', papel: 'colaborador', criadoEm: new Date() }]);
      const r = await service.listar(F, OUTRO);
      expect(r.membros[0]).toMatchObject({ email: 'z@z.com', voce: true });
      expect(r.convites).toEqual([]);
    });
  });

  describe('convidar', () => {
    it('só o administrador convida', async () => {
      papeis({ [OUTRO]: 'gestor' });
      await expect(service.convidar(F, OUTRO, 'a@b.com', 'colaborador')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('não dá para convidar como administrador', async () => {
      papeis({ [ADMIN]: 'administrador' });
      await expect(service.convidar(F, ADMIN, 'a@b.com', 'administrador')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('e-mail de quem já tem conta: entra direto na fazenda', async () => {
      papeis({ [ADMIN]: 'administrador' });
      prisma.usuario.findUnique.mockResolvedValue({ id: OUTRO });
      const r = await service.convidar(F, ADMIN, '  JOAO@Ex.com ', 'gestor');
      expect(r.resultado).toBe('adicionado');
      expect(prisma.usuario.findUnique.mock.calls[0][0].where.email).toBe('joao@ex.com');
      expect(prisma.fazendaUsuario.create).toHaveBeenCalledWith({ data: { fazendaId: F, usuarioId: OUTRO, papel: 'gestor' } });
    });

    it('e-mail sem conta: vira convite pendente', async () => {
      papeis({ [ADMIN]: 'administrador' });
      prisma.usuario.findUnique.mockResolvedValue(null);
      const r = await service.convidar(F, ADMIN, 'novo@ex.com', 'colaborador');
      expect(r.resultado).toBe('convite_pendente');
      expect(prisma.conviteFazenda.create.mock.calls[0][0].data).toMatchObject({ email: 'novo@ex.com', papel: 'colaborador', convidadoPorId: ADMIN });
    });

    it('recusa quem já é da equipe e quem já foi convidado', async () => {
      papeis({ [ADMIN]: 'administrador', [OUTRO]: 'colaborador' });
      prisma.usuario.findUnique.mockResolvedValue({ id: OUTRO });
      await expect(service.convidar(F, ADMIN, 'a@b.com', 'gestor')).rejects.toBeInstanceOf(ConflictException);

      papeis({ [ADMIN]: 'administrador' });
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.conviteFazenda.findUnique.mockResolvedValue({ id: 'c1' });
      await expect(service.convidar(F, ADMIN, 'a@b.com', 'gestor')).rejects.toBeInstanceOf(ConflictException);
    });

    it('plano sem o recurso "equipe" → 402 e nada é gravado', async () => {
      papeis({ [ADMIN]: 'administrador' });
      planos.assertRecursoDaFazenda.mockRejectedValue(erroDeRecurso('basico', 'equipe'));
      await expect(service.convidar(F, ADMIN, 'a@b.com', 'gestor')).rejects.toMatchObject({ status: 402 });
      expect(prisma.conviteFazenda.create).not.toHaveBeenCalled();
      expect(prisma.fazendaUsuario.create).not.toHaveBeenCalled();
    });

    it('limite de pessoas conta membros + convites pendentes, no plano do DONO', async () => {
      papeis({ [ADMIN]: 'administrador' });
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.fazendaUsuario.count.mockResolvedValue(2);
      prisma.conviteFazenda.count.mockResolvedValue(1);
      await service.convidar(F, ADMIN, 'a@b.com', 'gestor');
      expect(planos.assertLimite).toHaveBeenCalledWith(ADMIN, 'membros', 1, 3);

      planos.assertLimite.mockRejectedValue(erroDePlano('intermediario', 'membros', 3, 3));
      await expect(service.convidar(F, ADMIN, 'b@b.com', 'gestor')).rejects.toMatchObject({ status: 402 });
    });
  });

  describe('alterar papel e remover', () => {
    it('não altera nem remove o administrador', async () => {
      papeis({ [ADMIN]: 'administrador' });
      await expect(service.alterarPapel(F, ADMIN, ADMIN, 'gestor')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.remover(F, ADMIN, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('administrador troca o papel de um membro', async () => {
      papeis({ [ADMIN]: 'administrador', [OUTRO]: 'colaborador' });
      await service.alterarPapel(F, ADMIN, OUTRO, 'gestor');
      expect(prisma.fazendaUsuario.updateMany).toHaveBeenCalledWith({ where: { fazendaId: F, usuarioId: OUTRO }, data: { papel: 'gestor' } });
    });

    it('gestor não remove ninguém, mas qualquer um pode SAIR da equipe', async () => {
      papeis({ [ADMIN]: 'administrador', [OUTRO]: 'gestor', u3: 'colaborador' });
      await expect(service.remover(F, OUTRO, 'u3')).rejects.toBeInstanceOf(ForbiddenException);
      await service.remover(F, OUTRO, OUTRO); // sair
      expect(prisma.fazendaUsuario.deleteMany).toHaveBeenCalledWith({ where: { fazendaId: F, usuarioId: OUTRO } });
    });

    it('alvo que não é da fazenda → 404', async () => {
      papeis({ [ADMIN]: 'administrador' });
      await expect(service.remover(F, ADMIN, 'fantasma')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cancelar convite exige administrador e a fazenda certa', async () => {
      papeis({ [ADMIN]: 'administrador' });
      prisma.conviteFazenda.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.cancelarConvite(F, ADMIN, 'c1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.conviteFazenda.deleteMany).toHaveBeenCalledWith({ where: { id: 'c1', fazendaId: F } });
    });
  });

  describe('aceitarConvitesPendentes (cadastro)', () => {
    it('vira vínculo real e apaga os convites, na mesma transação', async () => {
      prisma.conviteFazenda.findMany.mockResolvedValue([
        { fazendaId: 'f1', papel: 'gestor' },
        { fazendaId: 'f2', papel: 'colaborador' },
      ]);
      const n = await service.aceitarConvitesPendentes('novo', 'NOVO@Ex.com');
      expect(n).toBe(2);
      expect(prisma.conviteFazenda.findMany.mock.calls[0][0].where.email).toBe('novo@ex.com');
      expect(prisma.fazendaUsuario.create).toHaveBeenCalledTimes(2);
      expect(prisma.fazendaUsuario.create).toHaveBeenCalledWith({ data: { fazendaId: 'f2', usuarioId: 'novo', papel: 'colaborador' } });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('sem convites não faz nada', async () => {
      expect(await service.aceitarConvitesPendentes('u', 'x@x.com')).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  it('normalizarEmail', () => {
    expect(normalizarEmail('  A@B.COM ')).toBe('a@b.com');
    expect(normalizarEmail(undefined as any)).toBe('');
  });
});
