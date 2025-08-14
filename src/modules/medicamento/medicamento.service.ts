// src/modules/medicamento/medicamento.service.ts
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

// helper simples p/ montar lista de campos alterados
function diffChanges<T extends Record<string, any>>(
  before: Partial<T>,
  proposed: Partial<T>,
  keys: (keyof T)[]
): string[] {
  const out: string[] = [];
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(proposed, k)) {
      const newVal = (proposed as any)[k];
      const oldVal = (before as any)[k];
      // Object.is evita falsos positivos entre -0/0 e NaN
      if (!Object.is(newVal, oldVal)) out.push(String(k));
    }
  }
  return out;
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

    // lembrete sem data -> desativa (ou lance erro se preferir)
    if (lembreteAtivo && !prox) {
      this.logger.warn(
        'lembreteAtivo=true, mas proximaAplicacao ausente. Lembrete será desativado.',
      );
    }

    // proximaAplicacao não pode ser antes da data do medicamento
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
      [
        `medicamento_criado`,
        `id=${novo.id}`,
        `animal=${animal.id}`,
        `brinco=${animal.brinco ?? ''}`,
        `fazenda=${animal.fazendaId}`,
        `nome=${novo.nome}`,
        `data=${novo.data.toISOString()}`,
        `proxima=${novo.proximaAplicacao ? novo.proximaAplicacao.toISOString() : ''}`,
        `lembreteAtivo=${novo.lembreteAtivo}`,
        novo.viaAplicacao ? `via=${novo.viaAplicacao}` : '',
        novo.dosagem ? `dosagem=${novo.dosagem}` : '',
      ].filter(Boolean).join(' ')
    );

    return novo;
  }

  // LIST por animal
  async listByAnimal(animalId: string, usuarioId: string) {
    await this.assertAcessoAoAnimal(animalId, usuarioId);
    return this.prisma.medicamento.findMany({
      where: { animalId },
      orderBy: [
        // primeiro quem tem lembrete mais próximo, depois pela data do medicamento
        { proximaAplicacao: 'asc' },
        { data: 'desc' },
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

    if (novaProx && (novaData ?? current.data) && novaProx < (novaData ?? current.data)) {
      throw new BadRequestException(
        'A próxima aplicação não pode ser anterior à data do medicamento',
      );
    }

    // lembrete
    let setLembreteAtivo: boolean | undefined = undefined;
    let setNotificacaoId: string | null | undefined = undefined;

    if (dto.lembreteAtivo !== undefined) {
      if (dto.lembreteAtivo === false) {
        setLembreteAtivo = false;
        setNotificacaoId = null; // desvincula
      } else {
        // true: só ativa se existir uma próxima (nova ou atual)
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

    // proposto (só chaves presentes em dto / calculadas)
    const proposed: Partial<{
      nome: string | null;
      dosagem: string | null;
      viaAplicacao: string | null;
      observacoes: string | null;
      data: Date | null;
      proximaAplicacao: Date | null;
      lembreteAtivo: boolean;
    }> = {};
    if (dto.nome !== undefined) proposed.nome = dto.nome ?? null;
    if (dto.dosagem !== undefined) proposed.dosagem = dto.dosagem ?? null;
    if (dto.viaAplicacao !== undefined) proposed.viaAplicacao = dto.viaAplicacao ?? null;
    if (dto.observacoes !== undefined) proposed.observacoes = dto.observacoes ?? null;
    if (novaData !== undefined) proposed.data = novaData ?? null;
    if (novaProx !== undefined) proposed.proximaAplicacao = novaProx ?? null;
    if (setLembreteAtivo !== undefined) proposed.lembreteAtivo = setLembreteAtivo;

    const alterados = diffChanges(
      current,
      proposed,
      ['nome', 'dosagem', 'viaAplicacao', 'observacoes', 'data', 'proximaAplicacao', 'lembreteAtivo']
    );

    const updated = await this.prisma.medicamento.update({
      where: { id },
      data: dataUpdate,
      include: { animal: true },
    });

    await this.safeLog(
      usuarioId,
      [
        `medicamento_atualizado`,
        `id=${id}`,
        `animal=${updated.animal?.id ?? current.animal.id}`,
        `fazenda=${updated.animal?.fazendaId ?? current.animal.fazendaId}`,
        alterados.length ? `changes=${alterados.join(',')}` : `changes=`,
      ].join(' ')
    );

    return updated;
  }

  // DELETE
  async remove(id: string, usuarioId: string) {
    const med = await this.findOne(id, usuarioId);

    await this.prisma.medicamento.delete({ where: { id } });

    await this.safeLog(
      usuarioId,
      `medicamento_excluido id=${id} animal=${med.animal.id} fazenda=${med.animal.fazendaId}`,
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