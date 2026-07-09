import { Test, TestingModule } from '@nestjs/testing';
import { SanidadeService } from './sanidade.service';
import { PrismaService } from 'src/prisma.service';

const USER_ID = 'user-1';

describe('SanidadeService — isolamento multi-tenant', () => {
  let service: SanidadeService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      sanidade: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    prisma.$transaction = jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [SanidadeService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SanidadeService);
  });

  it('findAll restringe aos animais de fazendas do usuário', async () => {
    await service.findAll(USER_ID, {});

    const where = prisma.sanidade.findMany.mock.calls[0][0].where;
    expect(where.animal).toEqual({
      fazenda: { usuarios: { some: { usuarioId: USER_ID } } },
    });
  });
});
