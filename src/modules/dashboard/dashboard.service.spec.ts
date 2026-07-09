import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from 'src/prisma.service';

const USER_ID = 'user-1';
const FAZENDA_ID = 'faz-1';

/**
 * O dashboard recebe fazendaId direto da query string. O guard de acesso
 * (fazendaUsuario.findFirst) é o que impede um usuário de ler os números de
 * uma fazenda alheia — estes testes travam esse guard.
 */
describe('DashboardService — controle de acesso à fazenda', () => {
  let service: DashboardService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      fazendaUsuario: { findFirst: jest.fn() },
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(DashboardService);
  });

  it('getResumoDaFazenda nega acesso a fazenda que não é do usuário', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue(null);
    await expect(
      service.getResumoDaFazenda(FAZENDA_ID, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getHistoricoRecentes nega acesso a fazenda que não é do usuário', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue(null);
    await expect(
      service.getHistoricoRecentes(FAZENDA_ID, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('verifica a posse com o par (fazendaId, usuarioId)', async () => {
    prisma.fazendaUsuario.findFirst.mockResolvedValue(null);
    await service.getResumoDaFazenda(FAZENDA_ID, USER_ID).catch(() => undefined);

    expect(prisma.fazendaUsuario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fazendaId: FAZENDA_ID, usuarioId: USER_ID },
      }),
    );
  });
});
