import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnimalService } from './animal.service';
import { PrismaService } from '../../prisma.service';
import { PlanoService, erroDePlano } from '../plano/plano.service';

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
  let planos: { assertLimiteDaFazenda: jest.Mock };

  beforeEach(async () => {
    prisma = makePrismaMock();
    planos = { assertLimiteDaFazenda: jest.fn().mockResolvedValue(undefined) };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AnimalService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlanoService, useValue: planos },
      ],
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
  describe('create — limite do plano', () => {
    const dto: any = { brinco: 'BR-1', fazendaId: 'faz-1' };

    it('checa o limite de animais da fazenda ANTES de gravar', async () => {
      prisma.fazenda.findFirst.mockResolvedValue({ id: 'faz-1' });
      prisma.animal.create = jest.fn().mockResolvedValue({ id: 'a1', brinco: 'BR-1', fazendaId: 'faz-1' });
      prisma.logAcesso = { create: jest.fn().mockResolvedValue({}) };

      await service.create(dto, USER_ID);

      expect(planos.assertLimiteDaFazenda).toHaveBeenCalledWith('faz-1', 'animais');
      expect(planos.assertLimiteDaFazenda.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.animal.create.mock.invocationCallOrder[0],
      );
    });

    it('estourou o plano: devolve 402 e não cria o animal', async () => {
      prisma.fazenda.findFirst.mockResolvedValue({ id: 'faz-1' });
      prisma.animal.create = jest.fn();
      planos.assertLimiteDaFazenda.mockRejectedValue(erroDePlano('basico', 'animais', 99, 99));

      await expect(service.create(dto, USER_ID)).rejects.toMatchObject({
        status: 402,
        response: expect.objectContaining({ code: 'PLANO_LIMITE', recurso: 'animais', limite: 99 }),
      });
      expect(prisma.animal.create).not.toHaveBeenCalled();
    });
  });

  describe('exportações', () => {
    // O PDF vinha quebrando em produção: `import * as PDFDocument` + esModuleInterop
    // vira um objeto e `new PDFDocument()` lançava TypeError.
    it('exportPDF gera um PDF de verdade', async () => {
      prisma.animal.findMany.mockResolvedValue([
        { brinco: 'BR-1', sexo: 'M', raca: 'Nelore', idade: 24, unidadeIdade: 'meses', peso: 420, lote: '1',
          fazenda: { nome: 'F' }, invernada: { nome: 'Norte' }, rebanho: null },
      ]);
      const { buffer, filename } = await service.exportPDF(USER_ID);
      expect(buffer!.subarray(0, 5).toString()).toBe('%PDF-');
      expect(filename).toMatch(/^animais-\d{4}-\d{2}-\d{2}\.pdf$/);
      expect(prisma.animal.findMany.mock.calls[0][0].where.fazenda).toEqual({
        usuarios: { some: { usuarioId: USER_ID } },
      });
    });
  });
});
