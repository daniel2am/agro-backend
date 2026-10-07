import { Test, TestingModule } from '@nestjs/testing';
import { UsuarioService } from './usuario.service';
import { PrismaService } from 'src/prisma.service';
import { EquipeService } from '../equipe/equipe.service';

/**
 * Garante que consultas de usuário nunca projetam o hash da senha para fora
 * do service — a origem do vazamento corrigido nesta rodada.
 */
function expectSelectSemSenha(select: any) {
  expect(select).toBeDefined();
  expect(select.senha).toBeUndefined();
  expect(select.email).toBe(true);
}

describe('UsuarioService — não vaza a senha', () => {
  let service: UsuarioService;
  let prisma: any;
  let equipe: { aceitarConvitesPendentes: jest.Mock };

  beforeEach(async () => {
    equipe = { aceitarConvitesPendentes: jest.fn().mockResolvedValue(0) };
    prisma = {
      usuario: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'novo', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' }),
        update: jest.fn().mockResolvedValue({ id: 'u1' }),
        delete: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
      fazendaUsuario: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      fazenda: { delete: jest.fn() },
      compraInsumo: { updateMany: jest.fn() },
      leituraDispositivo: { updateMany: jest.fn() },
      conviteFazenda: { updateMany: jest.fn(), deleteMany: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsuarioService,
        { provide: PrismaService, useValue: prisma },
        { provide: EquipeService, useValue: equipe },
      ],
    }).compile();
    service = moduleRef.get(UsuarioService);
  });

  it('findAll usa select sem senha', async () => {
    await service.findAll();
    expectSelectSemSenha(prisma.usuario.findMany.mock.calls[0][0].select);
  });

  it('findOne usa select sem senha', async () => {
    await service.findOne('u1');
    expectSelectSemSenha(prisma.usuario.findUnique.mock.calls[0][0].select);
  });

  it('update usa select sem senha', async () => {
    await service.update('u1', { nome: 'Novo' } as any);
    expectSelectSemSenha(prisma.usuario.update.mock.calls[0][0].select);
  });

  it('remove não devolve o hash da senha', async () => {
    const r: any = await service.remove('u1');
    expect(r.senha).toBeUndefined();
  });

  describe('create — plano e convites', () => {
    const dto: any = { nome: 'Ana', email: 'ana@ex.com', senha: 'Abc@12345' };

    it('novo usuário ganha o teste gratuito do plano completo', async () => {
      await service.create(dto);
      const data = prisma.usuario.create.mock.calls[0][0].data;
      expect(data.plano).toBe('avancado');
      expect(data.planoAteEm.getTime()).toBeGreaterThan(Date.now());
      expect(data.senha).not.toBe(dto.senha); // guarda o hash, não a senha
    });

    it('aceita convites pendentes do e-mail logo após criar a conta', async () => {
      await service.create(dto);
      expect(equipe.aceitarConvitesPendentes).toHaveBeenCalledWith('novo', 'ana@ex.com');
    });

    it('se aceitar o convite falhar, o cadastro NÃO falha', async () => {
      equipe.aceitarConvitesPendentes.mockRejectedValue(new Error('db fora'));
      await expect(service.create(dto)).resolves.toMatchObject({ id: 'novo' });
    });
  });

  describe('exclusão de conta', () => {
    // vínculos do usuário que está saindo ('u1') e, por fazenda, os que ficam
    function montar(meus: any[], outrosPorFazenda: Record<string, any[]>) {
      prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      prisma.fazendaUsuario.findMany.mockImplementation(async ({ where }: any) =>
        where.usuarioId === 'u1' ? meus : outrosPorFazenda[where.fazendaId] ?? [],
      );
    }

    it('fazenda só dele é apagada junto', async () => {
      montar([{ fazendaId: 'f1', papel: 'administrador' }], { f1: [] });
      const r = await service.remove('u1');
      expect(prisma.fazenda.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
      expect(prisma.usuario.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
      expect(r).toEqual({ removido: true, fazendasExcluidas: 1, fazendasTransferidas: 0 });
    });

    it('fazenda com equipe fica: gestor mais antigo vira administrador e herda os registros', async () => {
      montar([{ fazendaId: 'f1', papel: 'administrador' }], {
        f1: [
          { id: 'v2', usuarioId: 'col', papel: 'colaborador' },
          { id: 'v3', usuarioId: 'ges', papel: 'gestor' },
        ],
      });
      const r = await service.remove('u1');
      expect(prisma.fazenda.delete).not.toHaveBeenCalled();
      expect(prisma.fazendaUsuario.update).toHaveBeenCalledWith({ where: { id: 'v3' }, data: { papel: 'administrador' } });
      expect(prisma.compraInsumo.updateMany).toHaveBeenCalledWith({ where: { fazendaId: 'f1', usuarioId: 'u1' }, data: { usuarioId: 'ges' } });
      expect(prisma.leituraDispositivo.updateMany).toHaveBeenCalledWith({ where: { fazendaId: 'f1', usuarioId: 'u1' }, data: { usuarioId: 'ges' } });
      expect(r.fazendasTransferidas).toBe(1);
    });

    it('já existe outro administrador: ninguém é promovido, ele herda', async () => {
      montar([{ fazendaId: 'f1', papel: 'administrador' }], {
        f1: [{ id: 'v2', usuarioId: 'adm2', papel: 'administrador' }],
      });
      await service.remove('u1');
      expect(prisma.fazendaUsuario.update).not.toHaveBeenCalled();
      expect(prisma.compraInsumo.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { usuarioId: 'adm2' } }));
    });

    it('quem saiu sendo colaborador não promove ninguém', async () => {
      montar([{ fazendaId: 'f1', papel: 'colaborador' }], {
        f1: [{ id: 'v2', usuarioId: 'adm2', papel: 'administrador' }],
      });
      await service.remove('u1');
      expect(prisma.fazendaUsuario.update).not.toHaveBeenCalled();
    });

    it('apaga convites que esperavam o e-mail dele', async () => {
      montar([], {});
      await service.remove('u1');
      expect(prisma.conviteFazenda.deleteMany).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
    });

    it('conta com senha: sem senha ou senha errada não exclui', async () => {
      const bcrypt = await import('bcryptjs');
      prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', senha: await bcrypt.hash('certa123', 4) });
      await expect(service.excluirConta('u1')).rejects.toThrow('Senha incorreta');
      await expect(service.excluirConta('u1', 'errada')).rejects.toThrow('Senha incorreta');
      expect(prisma.usuario.delete).not.toHaveBeenCalled();
      await expect(service.excluirConta('u1', 'certa123')).resolves.toMatchObject({ removido: true });
    });

    it('conta Google/Apple não precisa de senha', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', senha: 'x', appleId: 'ap' });
      await expect(service.excluirConta('u1')).resolves.toMatchObject({ removido: true });
    });
  });
});
