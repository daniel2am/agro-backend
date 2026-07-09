import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnimalService } from './animal.service';
import { PrismaService } from '../../prisma.service';

/**
 * Estes testes travam a regressão que apareceu de forma sistemática no projeto:
 * consultas que deveriam ser restritas às fazendas do usuário autenticado
 * acabavam expostas a qualquer usuário. Aqui garantimos que o filtro
 * `fazenda.usuarios.some.usuarioId` está sempre presente.
 */
function makePrismaMock() {
  const mock: any = {
    animal: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    fazenda: { findFirst: jest.fn() },
  };
  mock.$transaction = jest.fn((arg: any) =>
    typeof arg === 'function' ? arg(mock) : Promise.all(arg),
  );
  return mock;
}

const USER_ID = 'user-1';

describe('AnimalService — isolamento multi-tenant', () => {
  let service: AnimalService;
  let prisma: any;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [AnimalService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AnimalService);
  });

  it('findAll filtra pelas fazendas do usuário', async () => {
    await service.findAll(USER_ID, {});

    const whereArg = prisma.animal.findMany.mock.calls[0][0].where;
    expect(whereArg.fazenda).toEqual({
      usuarios: { some: { usuarioId: USER_ID } },
    });
  });

  it('findOne exige que o animal pertença a uma fazenda do usuário', async () => {
    prisma.animal.findFirst.mockResolvedValue({ id: 'a1' });

    await service.findOne('a1', USER_ID);

    const whereArg = prisma.animal.findFirst.mock.calls[0][0].where;
    expect(whereArg.id).toBe('a1');
    expect(whereArg.fazenda).toEqual({
      usuarios: { some: { usuarioId: USER_ID } },
    });
  });

  it('findOne lança NotFound quando o animal é de outro usuário', async () => {
    prisma.animal.findFirst.mockResolvedValue(null);
    await expect(service.findOne('a1', USER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update nega acesso a animal de outra fazenda', async () => {
    prisma.animal.findFirst.mockResolvedValue(null);
    await expect(
      service.update('a1', { brinco: 'X' } as any, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
