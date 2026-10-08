import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FiscalService } from './fiscal.service';

describe('FiscalService', () => {
  let prisma: any;
  let planos: any;
  let service: FiscalService;

  const contribuinte = {
    cpf: '529.982.247-25', nome: 'José', endereco: 'Rua A', numero: '10', bairro: 'Centro', uf: 'ms',
    codMunicipio: '5002704', cep: '79.000-000', email: 'j@x.com',
  };
  const imovel = (extra: any = {}) => ({
    codItr: '12.345.678', caepf: '12345678901234', endereco: 'Rod', bairro: 'Rural', cep: '79000000',
    codMunicipio: '5002704', tipoExploracao: 1, participacaoPct: 100, contrapartes: [], ...extra,
  });

  beforeEach(() => {
    prisma = {
      contribuinteRural: { findUnique: jest.fn(), upsert: jest.fn().mockImplementation(async ({ create }: any) => create) },
      fazenda: { findMany: jest.fn().mockResolvedValue([]) },
      fazendaUsuario: { findFirst: jest.fn().mockResolvedValue({ id: 'v' }) },
      imovelRural: { upsert: jest.fn().mockResolvedValue({ id: 'i1' }), findUnique: jest.fn().mockResolvedValue({ id: 'i1' }) },
      contraparteImovel: { deleteMany: jest.fn(), createMany: jest.fn() },
      contaBancaria: {
        findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn(),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data })),
      },
    };
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));
    planos = { assertRecurso: jest.fn().mockResolvedValue(undefined) };
    service = new FiscalService(prisma, planos);
  });

  it('tudo exige o recurso lcdpr do plano do próprio usuário', async () => {
    await service.obterContribuinte('u1');
    await service.listarContas('u1');
    await service.listarImoveis('u1');
    expect(planos.assertRecurso).toHaveBeenCalledTimes(3);
    expect(planos.assertRecurso).toHaveBeenCalledWith('u1', 'lcdpr');
  });

  it('sem o plano, nada é lido nem gravado', async () => {
    planos.assertRecurso.mockRejectedValue(new Error('402'));
    await expect(service.salvarContribuinte('u1', contribuinte as any)).rejects.toThrow('402');
    expect(prisma.contribuinteRural.upsert).not.toHaveBeenCalled();
  });

  describe('contribuinte', () => {
    it('normaliza: só dígitos em CPF/CEP, UF em maiúsculas', async () => {
      const r: any = await service.salvarContribuinte('u1', contribuinte as any);
      expect(r).toMatchObject({ usuarioId: 'u1', cpf: '52998224725', cep: '79000000', uf: 'MS' });
    });
    it('recusa CPF inválido, CEP curto e município errado numa só mensagem', async () => {
      const p = service.salvarContribuinte('u1', { ...contribuinte, cpf: '111.111.111-11', cep: '12', codMunicipio: '12' } as any);
      await expect(p).rejects.toBeInstanceOf(BadRequestException);
      await expect(p).rejects.toThrow(/CPF inválido.*CEP.*Município|CPF inválido.*Município.*CEP/);
    });
    it('CPF/CNPJ do contador, quando informado, é validado', async () => {
      await expect(service.salvarContribuinte('u1', { ...contribuinte, contadorDoc: '123' } as any)).rejects.toThrow('contador');
    });
  });

  describe('imóvel', () => {
    it('só o administrador da fazenda edita', async () => {
      prisma.fazendaUsuario.findFirst.mockResolvedValue(null);
      await expect(service.salvarImovel('u1', 'f1', imovel() as any)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.fazendaUsuario.findFirst.mock.calls[0][0].where).toMatchObject({ fazendaId: 'f1', usuarioId: 'u1', papel: 'administrador' });
    });
    it('normaliza o CAFIR e substitui a lista de terceiros', async () => {
      await service.salvarImovel('u1', 'f1', imovel({
        participacaoPct: 50, tipoExploracao: 2,
        contrapartes: [{ tipo: 1, documento: '111.444.777-35', nome: ' João ', percentual: 50 }],
      }) as any);
      expect(prisma.imovelRural.upsert.mock.calls[0][0].create.codItr).toBe('12345678');
      expect(prisma.contraparteImovel.deleteMany).toHaveBeenCalledWith({ where: { imovelId: 'i1' } });
      expect(prisma.contraparteImovel.createMany.mock.calls[0][0].data[0]).toMatchObject({ documento: '11144477735', nome: 'João', percentual: 50 });
    });
    it('participação + terceiros não pode passar de 100%', async () => {
      await expect(
        service.salvarImovel('u1', 'f1', imovel({ participacaoPct: 80, contrapartes: [{ tipo: 1, documento: '11144477735', nome: 'X', percentual: 40 }] }) as any),
      ).rejects.toThrow('100%');
    });
    it('CAFIR com tamanho errado e CPF de terceiro inválido', async () => {
      await expect(service.salvarImovel('u1', 'f1', imovel({ codItr: '123' }) as any)).rejects.toThrow('CAFIR');
      await expect(
        service.salvarImovel('u1', 'f1', imovel({ participacaoPct: 50, contrapartes: [{ tipo: 1, documento: '1', nome: 'X', percentual: 50 }] }) as any),
      ).rejects.toThrow('terceiro 1');
    });
    it('listagem traz só fazendas administradas pelo usuário', async () => {
      await service.listarImoveis('u1');
      expect(prisma.fazenda.findMany.mock.calls[0][0].where.usuarios.some).toEqual({ usuarioId: 'u1', papel: 'administrador' });
    });
  });

  describe('contas', () => {
    it('valida banco, agência e conta', async () => {
      await expect(service.criarConta('u1', { banco: '1', nomeBanco: 'X', agencia: '12', numeroConta: '' })).rejects.toThrow(/banco.*Agência.*conta/is);
    });
    it('cria só com dígitos', async () => {
      const r: any = await service.criarConta('u1', { banco: '001', nomeBanco: ' Banco do Brasil ', agencia: '1234', numeroConta: '12.345-6' });
      expect(r).toMatchObject({ usuarioId: 'u1', agencia: '1234', numeroConta: '123456', nomeBanco: 'Banco do Brasil' });
    });
    it('só apaga conta própria', async () => {
      prisma.contaBancaria.findFirst.mockResolvedValue(null);
      await expect(service.removerConta('u1', 'c9')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.contaBancaria.findFirst.mock.calls[0][0].where).toEqual({ id: 'c9', usuarioId: 'u1' });
      expect(prisma.contaBancaria.delete).not.toHaveBeenCalled();
    });
  });
});
