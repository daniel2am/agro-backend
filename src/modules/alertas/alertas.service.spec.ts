import { ForbiddenException } from '@nestjs/common';
import { AlertasService } from './alertas.service';

describe('AlertasService', () => {
  let prisma: any;
  let planos: any;
  let service: AlertasService;
  const agora = new Date('2026-10-08T12:00:00');

  beforeEach(() => {
    prisma = {
      fazendaUsuario: { findFirst: jest.fn().mockResolvedValue({ id: 'v' }) },
      animal: { findMany: jest.fn().mockResolvedValue([]) },
      invernada: { findMany: jest.fn().mockResolvedValue([]) },
      medicamento: { findMany: jest.fn().mockResolvedValue([]) },
    };
    planos = { assertRecursoDaFazenda: jest.fn().mockResolvedValue(undefined) };
    service = new AlertasService(prisma, planos);
  });

  it('quem não é da fazenda não vê alertas', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue(null);
    await expect(service.listar('f1', 'intruso', agora)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.animal.findMany).not.toHaveBeenCalled();
  });

  it('exige o recurso alertas_inteligentes', async () => {
    await service.listar('f1', 'u1', agora);
    expect(planos.assertRecursoDaFazenda).toHaveBeenCalledWith('f1', 'alertas_inteligentes');
  });

  it('as três consultas ficam restritas à fazenda', async () => {
    await service.listar('f1', 'u1', agora);
    expect(prisma.animal.findMany.mock.calls[0][0].where.fazendaId).toBe('f1');
    expect(prisma.invernada.findMany.mock.calls[0][0].where.fazendaId).toBe('f1');
    expect(prisma.medicamento.findMany.mock.calls[0][0].where.animal.fazendaId).toBe('f1');
  });

  it('junta tudo ordenado por gravidade', async () => {
    prisma.animal.findMany.mockResolvedValue([
      { id: 'a1', brinco: 'X1', criadoEm: new Date('2026-01-01'), pesagens: [
        { data: new Date('2026-09-20'), pesoKg: 380 },
        { data: new Date('2026-08-20'), pesoKg: 400 },
      ] },
      { id: 'a2', brinco: 'X2', criadoEm: new Date('2026-01-01'), pesagens: [] }, // nunca pesado
    ]);
    prisma.medicamento.findMany.mockResolvedValue([
      { id: 'm1', nome: 'Aftosa', proximaAplicacao: new Date('2026-10-01'), animalId: 'a1', animal: { brinco: 'X1' } },
    ]);
    const r = await service.listar('f1', 'u1', agora);
    expect(r.alertas.map((a) => a.tipo)).toEqual(['vacina_vencida', 'perda_peso', 'pesagem_atrasada']);
    expect(r.total).toBe(3);
  });
});
