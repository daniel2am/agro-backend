// src/modules/sanidade/sanidade.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateSanidadeDto } from './dto/create-sanidade.dto';
import { UpdateSanidadeDto } from './dto/update-sanidade.dto';
import { Prisma } from '@prisma/client';

function toDateOrNull(v: unknown): Date | null {
  if (v == null || v === '') return null;
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

// compara “o que veio para trocar” com “o que já existe” e retorna nomes dos campos alterados
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
      if (!Object.is(newVal, oldVal)) out.push(String(k));
    }
  }
  return out;
}

@Injectable()
export class SanidadeService {
  private readonly logger = new Logger(SanidadeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== helpers =====
  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log: ${String(e)}`);
    }
  }

  private async assertAcessoAoAnimal(animalId: string, usuarioId: string) {
    const animal = await this.prisma.animal.findFirst({
      where: { id: animalId, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true, fazendaId: true, brinco: true },
    });
    if (!animal) throw new ForbiddenException('Acesso negado ao animal');
    return animal;
  }

  private async assertAcessoASanidade(id: string, usuarioId: string) {
    const s = await this.prisma.sanidade.findFirst({
      where: { id, animal: { fazenda: { usuarios: { some: { usuarioId } } } } },
      include: { animal: { select: { id: true, brinco: true, fazendaId: true } } },
    });
    if (!s) throw new NotFoundException('Registro de sanidade não encontrado ou acesso negado');
    return s;
  }

  // ===== create =====
  async create(dto: CreateSanidadeDto, usuarioId: string) {
    const animal = await this.assertAcessoAoAnimal(dto.animalId, usuarioId);

    const dataSan = toDateOrNull(dto.data);
    if (!dataSan) throw new BadRequestException('Data inválida');

    const novo = await this.prisma.sanidade.create({
      data: {
        data: dataSan,
        tipo: dto.tipo,
        observacoes: dto.observacoes ?? null,
        animalId: animal.id,
      },
      include: { animal: true },
    });

    await this.safeLog(
      usuarioId,
      `sanidade_criada: animal=${animal.brinco} tipo=${novo.tipo} data=${dataSan.toISOString()}`
    );

    return novo;
  }

  // ===== list (com filtros opcionais) =====
  async findAll(usuarioId: string, params: any = {}) {
    const {
      take = 10,
      skip = 0,
      search,
      animalId,
      inicio, // ISO
      fim,    // ISO
    } = params;

    const where: Prisma.SanidadeWhereInput = {
      animal: { fazenda: { usuarios: { some: { usuarioId } } } },
      ...(animalId ? { animalId } : {}),
      ...(search
        ? { tipo: { contains: String(search), mode: Prisma.QueryMode.insensitive } }
        : {}),
      ...((inicio || fim) && {
        data: {
          ...(inicio ? { gte: toDateOrNull(inicio) ?? undefined } : {}),
          ...(fim ? { lte: toDateOrNull(fim) ?? undefined } : {}),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.sanidade.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { data: 'desc' },
        include: { animal: true },
      }),
      this.prisma.sanidade.count({ where }),
    ]);

    return { data, total };
  }

  // ===== get one =====
  async findOne(id: string, usuarioId: string) {
    const sanidade = await this.assertAcessoASanidade(id, usuarioId);
    return sanidade;
  }

  // ===== update =====
  async update(id: string, dto: UpdateSanidadeDto, usuarioId: string) {
    const current = await this.assertAcessoASanidade(id, usuarioId);

    const novaData = dto.data !== undefined ? toDateOrNull(dto.data) : undefined;
    if (dto.data !== undefined && !novaData) {
      throw new BadRequestException('Data inválida');
    }

    // monta o update respeitando campos opcionais
    const dataUpdate: Prisma.SanidadeUpdateInput = {
      ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
      ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes } : {}),
      ...(novaData !== undefined ? { data: novaData } : {}),
    };

    // lista de campos alterados p/ log
    const changes = diffChanges(
      { tipo: current.tipo, observacoes: current.observacoes, data: current.data },
      { tipo: dto.tipo, observacoes: dto.observacoes, data: novaData },
      ['tipo', 'observacoes', 'data']
    );

    const atualizado = await this.prisma.sanidade.update({
      where: { id },
      data: dataUpdate,
      include: { animal: true },
    });

    await this.safeLog(
      usuarioId,
      `sanidade_atualizada: animal=${current.animal.brinco} tipo=${atualizado.tipo} changes=${changes.join(',')}`
    );

    return atualizado;
  }

  // ===== remove =====
  async remove(id: string, usuarioId: string) {
    const registro = await this.assertAcessoASanidade(id, usuarioId);

    await this.prisma.sanidade.delete({ where: { id } });

    await this.safeLog(
      usuarioId,
      `sanidade_excluida: animal=${registro.animal.brinco} tipo=${registro.tipo}`
    );

    return { message: 'Registro removido com sucesso' };
  }
}