import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChuvaService } from './chuva.service';

describe('ChuvaService', () => {
  let prisma: any;
  let service: ChuvaService;
  const dto = { fazendaId: 'f1', data: '2026-10-05', mm: 22 };

  beforeEach(() => {
    prisma = {
      fazendaUsuario: { findFirst: jest.fn().mockResolvedValue({ id: 'v' }) },
      chuva: {
        upsert: jest.fn().mockImplementation(async ({ create }: any) => ({ id: 'c1', ...create })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new ChuvaService(prisma);
  });

  it('registrar usa upsert por (fazenda, dia): reenviar o mesmo dia não duplica', async () => {
    await service.registrar(dto, 'u1');
    await service.registrar({ ...dto, mm: 30 }, 'u1');
    const where = prisma.chuva.upsert.mock.calls[0][0].where;
    expect(where.fazendaId_data.fazendaId).toBe('f1');
    expect(where.fazendaId_data.data.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(prisma.chuva.upsert.mock.calls[1][0].update.mm).toBe(30);
  });

  it('quem não é da fazenda não registra nem lê', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue(null);
    await expect(service.registrar(dto, 'intruso')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.resumo('f1', 'intruso')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chuva.upsert).not.toHaveBeenCalled();
  });

  it('rejeita data inválida e data no futuro', async () => {
    await expect(service.registrar({ ...dto, data: 'xx' }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.registrar({ ...dto, data: '2099-01-01' }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remover só apaga registro de fazenda do usuário', async () => {
    prisma.chuva.findFirst.mockResolvedValue(null);
    await expect(service.remover('c9', 'u1')).rejects.toThrow('Registro não encontrado');
    expect(prisma.chuva.findFirst.mock.calls[0][0].where.fazenda.usuarios.some.usuarioId).toBe('u1');
    expect(prisma.chuva.delete).not.toHaveBeenCalled();
  });
});
