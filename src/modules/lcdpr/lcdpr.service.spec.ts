import { BadRequestException } from '@nestjs/common';
import { LcdprService, lerAnoLcdpr } from './lcdpr.service';

describe('lerAnoLcdpr', () => {
  const hoje = new Date('2026-10-08');
  it('padrão: ano anterior', () => expect(lerAnoLcdpr(undefined, hoje)).toBe(2025));
  it('aceita 2019 em diante, até o ano que vem', () => {
    expect(lerAnoLcdpr('2019', hoje)).toBe(2019);
    expect(lerAnoLcdpr('2027', hoje)).toBe(2027);
  });
  it('rejeita fora da faixa e lixo', () => {
    for (const v of ['2018', '2099', 'abc', '2025.5']) expect(() => lerAnoLcdpr(v, hoje)).toThrow(BadRequestException);
  });
});

describe('LcdprService', () => {
  let prisma: any;
  let planos: any;
  let service: LcdprService;

  beforeEach(() => {
    prisma = {
      contribuinteRural: {
        findUnique: jest.fn().mockResolvedValue({
          cpf: '52998224725', nome: 'José', endereco: 'Rua A', numero: '1', complemento: null, bairro: 'Centro', uf: 'MS',
          codMunicipio: '5002704', cep: '79000000', telefone: null, email: 'j@x.com',
        }),
      },
      fazenda: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'f1', nome: 'Faz', estado: 'MS',
            imovelRural: {
              codItr: '12345678', caepf: '12345678901234', inscricaoEstadual: null, endereco: 'Rod', numero: null, complemento: null,
              bairro: 'Rural', cep: '79000000', codMunicipio: '5002704', tipoExploracao: 1, participacaoPct: 100, contrapartes: [],
            },
          },
        ]),
      },
      contaBancaria: { findMany: jest.fn().mockResolvedValue([]) },
      financeiro: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'l1', fazendaId: 'f1', data: new Date('2025-05-10T12:00:00Z'), descricao: 'Venda de soja', valor: 5000, tipo: 'receita',
            categoria: 'venda_lavoura', contaBancariaId: null, documentoTipo: 3, documentoNumero: '9', contraparteDoc: '11144477735',
          },
        ]),
      },
    };
    planos = { assertRecurso: jest.fn().mockResolvedValue(undefined) };
    service = new LcdprService(prisma, planos);
  });

  it('exige o plano e monta o arquivo com os dados reais', async () => {
    const s = await service.gerar('u1', 2025);
    expect(planos.assertRecurso).toHaveBeenCalledWith('u1', 'lcdpr');
    expect(s.pronto).toBe(true);
    expect(s.texto).toContain('Q100|10052025|001|000|9|3|Venda de soja|11144477735|1|500000|0|500000|P');
  });

  it('só entram fazendas que o usuário administra; lançamentos só dessas fazendas', async () => {
    await service.gerar('u1', 2025);
    expect(prisma.fazenda.findMany.mock.calls[0][0].where.usuarios.some).toEqual({ usuarioId: 'u1', papel: 'administrador' });
    expect(prisma.financeiro.findMany.mock.calls[0][0].where.fazendaId).toEqual({ in: ['f1'] });
  });

  it('contas bancárias lidas são só as do próprio usuário', async () => {
    await service.gerar('u1', 2025);
    expect(prisma.contaBancaria.findMany.mock.calls[0][0].where).toEqual({ usuarioId: 'u1' });
  });

  it('verificar não devolve o texto do arquivo', async () => {
    const v: any = await service.verificar('u1', 2025);
    expect(v.texto).toBeUndefined();
    expect(v.pronto).toBe(true);
  });

  it('sem fazenda administrada não consulta lançamentos', async () => {
    prisma.fazenda.findMany.mockResolvedValue([]);
    await service.gerar('u1', 2025);
    expect(prisma.financeiro.findMany).not.toHaveBeenCalled();
  });

  it('sem o plano, nada é lido', async () => {
    planos.assertRecurso.mockRejectedValue(new Error('402'));
    await expect(service.verificar('u1', 2025)).rejects.toThrow('402');
    expect(prisma.contribuinteRural.findUnique).not.toHaveBeenCalled();
  });
});
