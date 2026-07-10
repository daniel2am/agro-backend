import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { RebanhoService } from './rebanho.service';
import { PrismaService } from 'src/prisma.service';

const USER_ID = 'user-1';
const FAZENDA_ID = 'faz-1';

describe('RebanhoService', () => {
  let service: RebanhoService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      fazenda: { findFirst: jest.fn() },
      rebanho: {
        create: jest.fn().mockResolvedValue({ id: 'r1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [RebanhoService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(RebanhoService);
  });

  it('nega criar rebanho em fazenda que não é do usuário', async () => {
    prisma.fazenda.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ fazendaId: FAZENDA_ID, nome: 'Recria' } as any, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cria o rebanho quando a fazenda é do usuário', async () => {
    prisma.fazenda.findFirst.mockResolvedValue({ id: FAZENDA_ID });
    await service.create({ fazendaId: FAZENDA_ID, nome: 'Recria', tipo: 'recria' } as any, USER_ID);
    expect(prisma.rebanho.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fazendaId: FAZENDA_ID, nome: 'Recria', tipo: 'recria' }),
      }),
    );
  });

  it('findAll restringe às fazendas do usuário', async () => {
    await service.findAll(USER_ID);
    const where = prisma.rebanho.findMany.mock.calls[0][0].where;
    expect(where.fazenda).toEqual({ usuarios: { some: { usuarioId: USER_ID } } });
  });
});
