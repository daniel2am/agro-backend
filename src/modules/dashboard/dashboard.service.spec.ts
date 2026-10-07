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

/**
 * Histórico: as linhas de log de auditoria viram itens legíveis. Travam os
 * dois bugs que apareciam na tela — `brinco=BR-0001 id` (id engolido pelo
 * parser) e log de pesagem exibido cru — e o vazamento de logs entre fazendas.
 */
describe('DashboardService — histórico a partir dos logs', () => {
  let service: DashboardService;
  let prisma: any;

  const vazio = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
  });

  beforeEach(async () => {
    prisma = {
      fazendaUsuario: { findFirst: jest.fn().mockResolvedValue({ id: 'acesso' }) },
      animal: vazio(),
      lavoura: vazio(),
      invernada: vazio(),
      manejo: vazio(),
      compraInsumo: vazio(),
      financeiro: vazio(),
      sanidade: vazio(),
      medicamento: vazio(),
      ocorrencia: vazio(),
      pesagem: vazio(),
      logAcesso: vazio(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(DashboardService);
  });

  const comLogs = (...acoes: string[]) =>
    prisma.logAcesso.findMany.mockResolvedValue(
      acoes.map((acao, i) => ({ acao, data: new Date(2026, 9, 7, 10, i) })),
    );

  it('animal_criado: brinco limpo e id do animal preservado', async () => {
    comLogs(`animal_criado brinco=BR-0001 id=animal-1 fazenda=${FAZENDA_ID}`);
    const [item] = await service.getHistoricoRecentes(FAZENDA_ID, USER_ID);

    expect(item.descricao).toBe('✅ Criou animal — brinco BR-0001');
    expect(item.meta.animal.brinco).toBe('BR-0001');
    expect(item.meta.ids.animalId).toBe('animal-1');
  });

  it('pesagem_registrada vira texto legível, não a linha crua', async () => {
    comLogs(
      `pesagem_registrada animal=animal-1 brinco=BR-0001 pesoKg=420 fazenda=${FAZENDA_ID}`,
    );
    const [item] = await service.getHistoricoRecentes(FAZENDA_ID, USER_ID);

    expect(item.descricao).toBe('⚖️ Registrou pesagem — brinco BR-0001 (420 kg)');
    expect(item.descricao).not.toContain('animal=');
    expect(item.meta.ids.animalId).toBe('animal-1');
  });

  it('não mostra logs de OUTRA fazenda do mesmo usuário', async () => {
    comLogs(
      `animal_criado brinco=DESTA id=a1 fazenda=${FAZENDA_ID}`,
      'animal_criado brinco=OUTRA id=a2 fazenda=faz-de-outra',
    );
    const itens = await service.getHistoricoRecentes(FAZENDA_ID, USER_ID);

    expect(itens.map((i: any) => i.descricao).join('|')).toContain('DESTA');
    expect(itens.map((i: any) => i.descricao).join('|')).not.toContain('OUTRA');
  });

  it('mantém logs sem fazenda identificada (ex.: ações da conta)', async () => {
    comLogs('manejo_criado');
    const itens = await service.getHistoricoRecentes(FAZENDA_ID, USER_ID);
    expect(itens).toHaveLength(1);
  });
});
