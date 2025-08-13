import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateMedicamentoDto {
  animalId: string;
  nome: string;
  data: Date | string;
  dosagem?: string;
  viaAplicacao?: string;
  observacoes?: string;
  proximaAplicacao?: Date | string | null;
  lembreteAtivo?: boolean;
}

export interface UpdateMedicamentoDto {
  nome?: string;
  data?: Date | string;
  dosagem?: string | null;
  viaAplicacao?: string | null;
  observacoes?: string | null;
  proximaAplicacao?: Date | string | null;
  lembreteAtivo?: boolean;
}

function toDateOrNull(v: unknown): Date | null {
  if (v == null || v === '') return null;
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class MedicamentoService {
  private readonly logger = new Logger(MedicamentoService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async assertAcessoAoAnimal(animalId: string, usuarioId: string) {
    const animal = await this.prisma.animal.findFirst({
      where: {
        id: animalId,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
      select: { id: true, fazendaId: true, brinco: true },
    });
    if (!animal) throw new ForbiddenException('Acesso negado ao animal');
    return animal;
  }

  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log: ${String(e)}`);
    }
  }

  // CREATE
  async create(dto: CreateMedicamentoDto, usuarioId: string) {
    const animal = await this.assertAcessoAoAnimal(dto.animalId, usuarioId);

    const dataMedic = toDateOrNull(dto.data);
    if (!dataMedic) throw new BadRequestException('Data inválida');

    let prox = toDateOrNull(dto.proximaAplicacao);
    const lembreteAtivo = !!dto.lembreteAtivo;

    // regra: lembrete sem data -> desativa
    if (lembreteAtivo && !prox) {
      // opcional: lançar erro em vez de desativar
      // throw new BadRequestException('Para ativar lembrete, informe proximaAplicacao');
      // comportamento adotado: desativa
      this.logger.warn(
        'lembreteAtivo=true, mas proximaAplicacao ausente. Lembrete será desativado.',
      );
    }

    // regra opcional: proximaAplicacao não pode ser antes da data do medicamento
    if (prox && prox < dataMedic) {
      throw new BadRequestException(
        'A próxima aplicação não pode ser anterior à data do medicamento',
      );
    }

    const novo = await this.prisma.medicamento.create({
      data: {
        animalId: dto.animalId,
        nome: dto.nome,
        data: dataMedic,
        dosagem: dto.dosagem ?? null,
        viaAplicacao: dto.viaAplicacao ?? null,
        observacoes: dto.observacoes ?? null,
        proximaAplicacao: prox,
        lembreteAtivo: !!(lembreteAtivo && prox),
        // notificacaoId: null // preencher quando integrar push/scheduler
      },
      include: { animal: true },
    });

    await this.safeLog(
      usuarioId,
      `medicamento_criado: animal=${animal.brinco} nome=${novo.nome} data=${novo.data.toISOString()}`,
    );

    return novo;
  }

  // LIST por animal
  async listByAnimal(animalId: string, usuarioId: string) {
    await this.assertAcessoAoAnimal(animalId, usuarioId);
    return this.prisma.medicamento.findMany({
      where: { animalId },
      orderBy: [
        // primeiro quem tem lembrete e mais próximo, depois pela data do medicamento
        { proximaAplicacao: 'asc' as const },
        { data: 'desc' as const },
      ],
    });
  }

  // GET ONE
  async findOne(id: string, usuarioId: string) {
    const med = await this.prisma.medicamento.findFirst({
      where: {
        id,
        animal: {
          fazenda: { usuarios: { some: { usuarioId } } },
        },
      },
      include: { animal: true },
    });
    if (!med) throw new NotFoundException('Medicamento não encontrado');
    return med;
  }

  // UPDATE
  async update(id: string, dto: UpdateMedicamentoDto, usuarioId: string) {
    const current = await this.findOne(id, usuarioId);

    const novaData = dto.data !== undefined ? toDateOrNull(dto.data) : undefined;
    if (dto.data !== undefined && !novaData) {
      throw new BadRequestException('Data inválida');
    }

    const novaProx =
      dto.proximaAplicacao !== undefined ? toDateOrNull(dto.proximaAplicacao) : undefined;

    // regra opcional: proximaAplicacao não pode ser anterior à data
    if (novaProx && (novaData ?? current.data) && novaProx < (novaData ?? current.data)) {
      throw new BadRequestException(
        'A próxima aplicação não pode ser anterior à data do medicamento',
      );
    }

    // lógica de lembrete:
    // - Se lembreteAtivo=false => zera notificacaoId e mantém proximaAplicacao como veio (ou nula)
    // - Se lembreteAtivo=true mas sem proximaAplicacao (novaProx===null/undefined e current.proximaAplicacao null) => força false
    let setLembreteAtivo: boolean | undefined = undefined;
    let setNotificacaoId: string | null | undefined = undefined;

    if (dto.lembreteAtivo !== undefined) {
      if (dto.lembreteAtivo === false) {
        setLembreteAtivo = false;
        setNotificacaoId = null; // desvincula
      } else {
        // true: só mantém se houver (novaProx ?? current.proximaAplicacao)
        const validaProx = novaProx !== undefined ? novaProx : current.proximaAplicacao;
        setLembreteAtivo = !!validaProx;
        if (!validaProx) {
          this.logger.warn(
            'lembreteAtivo=true sem proximaAplicacao. Lembrete permanecerá desativado.',
          );
          setLembreteAtivo = false;
          setNotificacaoId = null;
        }
      }
    }

    const dataUpdate: Prisma.MedicamentoUpdateInput = {
      ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
      ...(dto.dosagem !== undefined ? { dosagem: dto.dosagem } : {}),
      ...(dto.viaAplicacao !== undefined ? { viaAplicacao: dto.viaAplicacao } : {}),
      ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes } : {}),
      ...(novaData !== undefined ? { data: novaData } : {}),
      ...(novaProx !== undefined ? { proximaAplicacao: novaProx } : {}),
      ...(setLembreteAtivo !== undefined ? { lembreteAtivo: setLembreteAtivo } : {}),
      ...(setNotificacaoId !== undefined ? { notificacaoId: setNotificacaoId } : {}),
    };

    const updated = await this.prisma.medicamento.update({
      where: { id },
      data: dataUpdate,
      include: { animal: true },
    });

    await this.safeLog(
      usuarioId,
      `medicamento_atualizado: animal=${updated.animal?.brinco ?? current.animal.brinco} nome=${updated.nome}`,
    );

    return updated;
  }

  // DELETE
  async remove(id: string, usuarioId: string) {
    const med = await this.findOne(id, usuarioId);

    await this.prisma.medicamento.delete({ where: { id } });

    await this.safeLog(
      usuarioId,
      `medicamento_excluido: animal=${med.animal?.brinco ?? ''} nome=${med.nome}`,
    );

    return { message: 'Medicamento removido com sucesso' };
  }

  // (Opcional) Buscar lembretes próximos — útil para CRON/worker
  async listarLembretesPendentes(ate: Date) {
    return this.prisma.medicamento.findMany({
      where: {
        lembreteAtivo: true,
        proximaAplicacao: { lte: ate },
      },
      include: { animal: true },
      orderBy: { proximaAplicacao: 'asc' },
    });
  }
}