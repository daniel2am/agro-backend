import { Test, TestingModule } from '@nestjs/testing';
import { NotificacaoService } from './notificacao.service';
import { PrismaService } from 'src/prisma.service';

const USER_ID = 'user-1';

const DIA = 24 * 60 * 60 * 1000;

describe('NotificacaoService', () => {
  let service: NotificacaoService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { medicamento: { findMany: jest.fn().mockResolvedValue([]) } };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [NotificacaoService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(NotificacaoService);
  });

  it('restringe os alertas às fazendas do usuário e só a lembretes ativos', async () => {
    await service.listar(USER_ID);

    const where = prisma.medicamento.findMany.mock.calls[0][0].where;
    expect(where.lembreteAtivo).toBe(true);
    expect(where.animal).toEqual({
      fazenda: { usuarios: { some: { usuarioId: USER_ID } } },
    });
    // só traz reforços dentro da janela (exclui nulos e datas distantes)
    expect(where.proximaAplicacao.lte).toBeInstanceOf(Date);
  });

  it('marca como vencida a aplicação cuja data já passou', async () => {
    prisma.medicamento.findMany.mockResolvedValue([
      {
        id: 'm1',
        nome: 'Aftosa',
        proximaAplicacao: new Date(Date.now() - 2 * DIA),
        animal: { brinco: '0231', nome: null },
      },
    ]);

    const [alerta] = await service.listar(USER_ID);

    expect(alerta!.vencida).toBe(true);
    expect(alerta!.titulo).toContain('vencido');
    expect(alerta!.brinco).toBe('0231');
  });

  it('marca como próxima a aplicação futura dentro da janela', async () => {
    prisma.medicamento.findMany.mockResolvedValue([
      {
        id: 'm2',
        nome: 'Vermífugo',
        proximaAplicacao: new Date(Date.now() + 5 * DIA),
        animal: { brinco: '0188', nome: null },
      },
    ]);

    const [alerta] = await service.listar(USER_ID);

    expect(alerta!.vencida).toBe(false);
    expect(alerta!.titulo).toContain('aproximando');
  });
});
