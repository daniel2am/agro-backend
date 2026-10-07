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

  it('remove usa select sem senha', async () => {
    await service.remove('u1');
    expectSelectSemSenha(prisma.usuario.delete.mock.calls[0][0].select);
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
});
