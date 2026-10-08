import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FinanceiroService, lerDataLancamento } from './financeiro.service';
import { ddmmaaaa } from '../lcdpr/lcdpr.gerador';

// Campos fiscais do lançamento (LCDPR): conta, documento e CPF/CNPJ de quem pagou/recebeu.
describe('FinanceiroService — dados fiscais', () => {
  let prisma: any;
  let service: FinanceiroService;

  const dto = (extra: any = {}) => ({ fazendaId: 'f1', data: '2026-03-01', descricao: 'Venda de milho', valor: 1000, tipo: 'receita', categoria: 'venda_lavoura', ...extra });

  beforeEach(() => {
    prisma = {
      fazenda: { findFirst: jest.fn().mockResolvedValue({ id: 'f1' }) },
      contaBancaria: { findFirst: jest.fn().mockResolvedValue({ id: 'c1' }) },
      financeiro: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'n1', ...data })),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'n1', tipo: 'receita', ...data })),
      },
      lavoura: { findFirst: jest.fn() },
      logAcesso: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));
    service = new FinanceiroService(prisma);
  });

  it('grava os campos fiscais e guarda o CPF só com dígitos', async () => {
    await service.create(
      dto({ contaBancariaId: 'c1', documentoTipo: 3, documentoNumero: ' 123 ', contraparteDoc: '111.444.777-35', contraparteNome: 'João' }) as any,
      'u1',
    );
    const data = prisma.financeiro.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ contaBancariaId: 'c1', documentoTipo: 3, documentoNumero: '123', contraparteDoc: '11144477735', contraparteNome: 'João' });
  });

  it('CPF/CNPJ inválido é recusado (o arquivo da Receita seria rejeitado)', async () => {
    await expect(service.create(dto({ contraparteDoc: '111.111.111-11' }) as any, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(dto({ contraparteDoc: '123' }) as any, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.financeiro.create).not.toHaveBeenCalled();
  });

  it('CNPJ válido é aceito', async () => {
    await service.create(dto({ contraparteDoc: '11.222.333/0001-81' }) as any, 'u1');
    expect(prisma.financeiro.create.mock.calls[0][0].data.contraparteDoc).toBe('11222333000181');
  });

  it('a conta bancária precisa ser de um administrador DESTA fazenda', async () => {
    prisma.contaBancaria.findFirst.mockResolvedValue(null);
    await expect(service.create(dto({ contaBancariaId: '5b0a8f0e-1111-4111-8111-111111111111' }) as any, 'u1')).rejects.toBeInstanceOf(ForbiddenException);
    const where = prisma.contaBancaria.findFirst.mock.calls[0][0].where;
    expect(where.usuario.fazendas.some).toEqual({ fazendaId: 'f1', papel: 'administrador' });
  });

  it('sem campos fiscais no DTO, nada fiscal é gravado (não zera por engano)', async () => {
    await service.create(dto() as any, 'u1');
    const data = prisma.financeiro.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('contraparteDoc');
    expect(data).not.toHaveProperty('contaBancariaId');
  });

  describe('edição', () => {
    const existente = (extra: any = {}) => ({ id: 'n1', compraInsumoId: null, fazendaId: 'f1', tipo: 'receita', custoLavouraId: null, ...extra });

    it('null limpa o campo fiscal', async () => {
      prisma.financeiro.findFirst.mockResolvedValue(existente());
      await service.update('n1', { contraparteDoc: null, contaBancariaId: null } as any, 'u1');
      expect(prisma.financeiro.update.mock.calls[0][0].data).toMatchObject({ contraparteDoc: null, contaBancariaId: null });
    });

    it('espelho de compra de insumo: pode receber dados fiscais, mas não mudar valor', async () => {
      prisma.financeiro.findFirst.mockResolvedValue(existente({ compraInsumoId: 'ci1' }));
      await expect(service.update('n1', { contraparteDoc: '11.222.333/0001-81', documentoTipo: 1 } as any, 'u1')).resolves.toBeDefined();
      await expect(service.update('n1', { valor: 5 } as any, 'u1')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.update('n1', { contraparteDoc: '11.222.333/0001-81', descricao: 'x' } as any, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('data do lançamento', () => {
    it('"AAAA-MM-DD" cai no mesmo dia em Brasília (meia-noite UTC cairia no dia anterior)', () => {
      expect(ddmmaaaa(lerDataLancamento('2026-03-10'))).toBe('10032026');
      expect(ddmmaaaa(new Date('2026-03-10'))).toBe('09032026'); // o problema que isto evita
    });
    it('ISO completo é respeitado como veio', () => {
      expect(lerDataLancamento('2026-03-10T03:00:00.000Z').toISOString()).toBe('2026-03-10T03:00:00.000Z');
    });
    it('lixo continua inválido', () => {
      expect(Number.isNaN(lerDataLancamento('ontem').getTime())).toBe(true);
    });
    it('create grava meio-dia para data sem horário', async () => {
      await service.create(dto({ data: '2026-03-10' }) as any, 'u1');
      expect(prisma.financeiro.create.mock.calls[0][0].data.data.toISOString()).toBe('2026-03-10T12:00:00.000Z');
    });
  });
});
