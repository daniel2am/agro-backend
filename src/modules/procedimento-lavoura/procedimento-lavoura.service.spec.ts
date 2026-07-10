import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProcedimentoLavouraService } from './procedimento-lavoura.service';
import { PrismaService } from 'src/prisma.service';

const USER_ID = 'user-1';
const LAVOURA_ID = 'lav-1';

describe('ProcedimentoLavouraService', () => {
  let service: ProcedimentoLavouraService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      lavoura: { findFirst: jest.fn() },
      procedimentoLavoura: {
        create: jest.fn().mockResolvedValue({ id: 'p1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [ProcedimentoLavouraService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ProcedimentoLavouraService);
  });

  it('nega criar procedimento em lavoura de outra fazenda', async () => {
    prisma.lavoura.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ lavouraId: LAVOURA_ID, tipo: 'defensivo', data: '2026-01-01' } as any, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.procedimentoLavoura.create).not.toHaveBeenCalled();
  });

  it('cria quando a lavoura é do usuário', async () => {
    prisma.lavoura.findFirst.mockResolvedValue({ id: LAVOURA_ID });
    await service.create(
      { lavouraId: LAVOURA_ID, tipo: 'irrigação', data: '2026-02-10', produto: 'água' } as any,
      USER_ID,
    );
    expect(prisma.procedimentoLavoura.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lavouraId: LAVOURA_ID, tipo: 'irrigação' }),
      }),
    );
  });

  it('findByLavoura restringe pela lavoura do usuário', async () => {
    prisma.lavoura.findFirst.mockResolvedValue({ id: LAVOURA_ID });
    await service.findByLavoura(LAVOURA_ID, USER_ID);
    const where = prisma.procedimentoLavoura.findMany.mock.calls[0][0].where;
    expect(where.lavouraId).toBe(LAVOURA_ID);
  });

  it('remove nega procedimento de outra fazenda', async () => {
    prisma.procedimentoLavoura.findFirst.mockResolvedValue(null);
    await expect(service.remove('p1', USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
