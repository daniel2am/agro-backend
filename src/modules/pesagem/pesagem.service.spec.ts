import { Test, TestingModule } from '@nestjs/testing';
import { PesagemService } from './pesagem.service';
import { PrismaService } from 'src/prisma.service';

describe('PesagemService.findAll', () => {
  let service: PesagemService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      pesagem: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    prisma.$transaction = jest.fn((ops: any[]) => Promise.all(ops));
    const m: TestingModule = await Test.createTestingModule({
      providers: [PesagemService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = m.get(PesagemService);
  });

  it('sempre restringe às fazendas do usuário', async () => {
    await service.findAll('u1', {});
    expect(prisma.pesagem.findMany.mock.calls[0][0].where.animal.fazenda).toEqual({ usuarios: { some: { usuarioId: 'u1' } } });
  });

  it('filtro por fazendaId se soma à trava de acesso (não a substitui)', async () => {
    await service.findAll('u1', { fazendaId: 'f9' });
    const animal = prisma.pesagem.findMany.mock.calls[0][0].where.animal;
    expect(animal.fazendaId).toBe('f9');
    expect(animal.fazenda).toEqual({ usuarios: { some: { usuarioId: 'u1' } } });
  });

  it('sem fazendaId, não filtra por fazenda', async () => {
    await service.findAll('u1', { animalId: 'a1' });
    expect(prisma.pesagem.findMany.mock.calls[0][0].where.animal.fazendaId).toBeUndefined();
  });
});
