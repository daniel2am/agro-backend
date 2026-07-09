import { Test, TestingModule } from '@nestjs/testing';
import { UsuarioService } from './usuario.service';
import { PrismaService } from 'src/prisma.service';

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

  beforeEach(async () => {
    prisma = {
      usuario: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' }),
        update: jest.fn().mockResolvedValue({ id: 'u1' }),
        delete: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [UsuarioService, { provide: PrismaService, useValue: prisma }],
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
});
