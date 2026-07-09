import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FinanceiroService } from './financeiro.service';
import { PrismaService } from 'src/prisma.service';
import { CreateFinanceiroDto } from './dto/create-financeiro.dto';

/**
 * PrismaService falso. $transaction executa o callback recebendo o próprio
 * mock como "tx", então tx.animal.update etc. usam os mesmos jest.fn().
 */
function makePrismaMock() {
  const mock: any = {
    fazenda: { findFirst: jest.fn() },
    animal: { findFirst: jest.fn(), update: jest.fn() },
    lavoura: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    financeiro: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    logAcesso: { create: jest.fn().mockResolvedValue({}) },
  };
  mock.$transaction = jest.fn((arg: any) =>
    typeof arg === 'function' ? arg(mock) : Promise.all(arg),
  );
  return mock;
}

const USER_ID = 'user-1';
const FAZENDA_ID = 'faz-1';

function baseDto(overrides: Partial<CreateFinanceiroDto> = {}): CreateFinanceiroDto {
  return {
    fazendaId: FAZENDA_ID,
    data: '2026-01-01',
    descricao: 'teste',
    valor: 1000,
    tipo: 'receita',
    ...overrides,
  } as CreateFinanceiroDto;
}

describe('FinanceiroService', () => {
  let service: FinanceiroService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [FinanceiroService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(FinanceiroService);

    // por padrão a fazenda pertence ao usuário
    prisma.fazenda.findFirst.mockResolvedValue({ id: FAZENDA_ID });
    prisma.financeiro.create.mockResolvedValue({ id: 'fin-1' });
  });

  describe('create — controle de acesso', () => {
    it('nega quando a fazenda não pertence ao usuário', async () => {
      prisma.fazenda.findFirst.mockResolvedValue(null);
      await expect(service.create(baseDto(), USER_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejeita informar animalId e lavouraId ao mesmo tempo', async () => {
      await expect(
        service.create(baseDto({ animalId: 'a1', lavouraId: 'l1' }), USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create — venda de gado (baixa automática)', () => {
    it('marca o animal como vendido', async () => {
      prisma.animal.findFirst.mockResolvedValue({ id: 'a1', status: 'ativo' });

      await service.create(baseDto({ animalId: 'a1' }), USER_ID);

      expect(prisma.animal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1' },
          data: expect.objectContaining({ status: 'vendido' }),
        }),
      );
      expect(prisma.financeiro.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ animalId: 'a1' }) }),
      );
    });

    it('rejeita vender um animal já baixado', async () => {
      prisma.animal.findFirst.mockResolvedValue({ id: 'a1', status: 'vendido' });
      await expect(
        service.create(baseDto({ animalId: 'a1' }), USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.animal.update).not.toHaveBeenCalled();
    });

    it('nega quando o animal não pertence à fazenda', async () => {
      prisma.animal.findFirst.mockResolvedValue(null);
      await expect(
        service.create(baseDto({ animalId: 'a1' }), USER_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('create — venda de lavoura (subtrai hectares)', () => {
    it('subtrai a área vendida da área total', async () => {
      prisma.lavoura.findFirst.mockResolvedValue({ id: 'l1', areaHa: 100 });

      await service.create(
        baseDto({ lavouraId: 'l1', areaVendidaHa: 30 }),
        USER_ID,
      );

      expect(prisma.lavoura.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'l1' },
          data: expect.objectContaining({ areaHa: 70 }),
        }),
      );
    });

    it('rejeita área vendida maior que a disponível', async () => {
      prisma.lavoura.findFirst.mockResolvedValue({ id: 'l1', areaHa: 100 });
      await expect(
        service.create(baseDto({ lavouraId: 'l1', areaVendidaHa: 150 }), USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.lavoura.update).not.toHaveBeenCalled();
    });

    it('exige a área vendida quando há lavouraId', async () => {
      prisma.lavoura.findFirst.mockResolvedValue({ id: 'l1', areaHa: 100 });
      await expect(
        service.create(baseDto({ lavouraId: 'l1' }), USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove — reverte a baixa', () => {
    it('reativa o animal ao excluir a venda', async () => {
      prisma.financeiro.findFirst.mockResolvedValue({
        id: 'fin-1',
        descricao: 'venda',
        animalId: 'a1',
        lavouraId: null,
        areaVendidaHa: null,
      });

      await service.remove('fin-1', USER_ID);

      expect(prisma.animal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1' },
          data: expect.objectContaining({ status: 'ativo' }),
        }),
      );
      expect(prisma.financeiro.delete).toHaveBeenCalledWith({ where: { id: 'fin-1' } });
    });

    it('devolve os hectares à lavoura ao excluir a venda', async () => {
      prisma.financeiro.findFirst.mockResolvedValue({
        id: 'fin-1',
        descricao: 'venda grãos',
        animalId: null,
        lavouraId: 'l1',
        areaVendidaHa: 30,
      });
      prisma.lavoura.findUnique.mockResolvedValue({ areaHa: 70 });

      await service.remove('fin-1', USER_ID);

      expect(prisma.lavoura.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'l1' },
          data: expect.objectContaining({ areaHa: 100 }),
        }),
      );
    });

    it('nega excluir lançamento de outra fazenda', async () => {
      prisma.financeiro.findFirst.mockResolvedValue(null);
      await expect(service.remove('fin-1', USER_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('findAll — isolamento multi-tenant', () => {
    it('filtra sempre pelas fazendas do usuário autenticado', async () => {
      prisma.financeiro.findMany.mockResolvedValue([]);
      prisma.financeiro.count.mockResolvedValue(0);

      await service.findAll(USER_ID);

      const whereArg = prisma.financeiro.findMany.mock.calls[0][0].where;
      expect(whereArg.fazenda).toEqual({
        usuarios: { some: { usuarioId: USER_ID } },
      });
    });
  });
});
