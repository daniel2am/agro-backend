// src/modules/financeiro/financeiro.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateFinanceiroDto } from './dto/create-financeiro.dto';
import { UpdateFinanceiroDto } from './dto/update-financeiro.dto';
import { Prisma } from '@prisma/client';

function toDateOrNull(v: unknown): Date | null {
  if (v == null || v === '') return null;
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
export class FinanceiroService {
  private readonly logger = new Logger(FinanceiroService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===== Helpers =====
  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log (ignorado): ${String(e)}`);
    }
  }

  private async getFazendaDoUsuario(usuarioId: string) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: { usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!fazenda) throw new ForbiddenException('Fazenda não encontrada ou acesso negado');
    return fazenda;
  }

  private async assertAcessoRegistro(id: string, usuarioId: string) {
    const reg = await this.prisma.financeiro.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
    });
    if (!reg) throw new ForbiddenException('Acesso negado');
    return reg;
  }

  // ===== CRUD =====
  async create(dto: CreateFinanceiroDto, usuarioId: string) {
    const fazenda = await this.getFazendaDoUsuario(usuarioId);

    const dataReg = toDateOrNull(dto.data);
    if (!dataReg) throw new BadRequestException('Data inválida');

    const registro = await this.prisma.financeiro.create({
      data: {
        descricao: dto.descricao ?? null,
        tipo: dto.tipo, // 'receita' | 'despesa'
        valor: Number(dto.valor),
        data: dataReg,
        fazendaId: fazenda.id,
      },
    });

    await this.safeLog(
      usuarioId,
      `financeiro_criado: id=${registro.id} tipo=${registro.tipo} valor=${registro.valor} data=${dataReg.toISOString()} desc="${registro.descricao ?? ''}"`
    );

    return registro;
  }

  async findAll(usuarioId: string, query: any = {}) {
    const fazenda = await this.getFazendaDoUsuario(usuarioId);

    const {
      take = 10,
      skip = 0,
      search,         // busca na descrição
      tipo,           // 'receita' | 'despesa'
      inicio,         // ISO
      fim,            // ISO
      min,            // valor mínimo
      max,            // valor máximo
    } = query;

    const where: Prisma.FinanceiroWhereInput = {
      fazendaId: fazenda.id,
      ...(search ? { descricao: { contains: String(search), mode: Prisma.QueryMode.insensitive } } : {}),
      ...(tipo ? { tipo: String(tipo) as any } : {}),
      ...((inicio || fim) && {
        data: {
          ...(inicio ? { gte: toDateOrNull(inicio) ?? undefined } : {}),
          ...(fim ? { lte: toDateOrNull(fim) ?? undefined } : {}),
        },
      }),
      ...((min || max) && {
        valor: {
          ...(min ? { gte: Number(min) } : {}),
          ...(max ? { lte: Number(max) } : {}),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeiro.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { data: 'desc' },
      }),
      this.prisma.financeiro.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, usuarioId: string) {
    const reg = await this.prisma.financeiro.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId } } } },
    });
    if (!reg) throw new NotFoundException('Registro não encontrado');
    return reg;
  }

  async update(id: string, dto: UpdateFinanceiroDto, usuarioId: string) {
    const current = await this.assertAcessoRegistro(id, usuarioId);

    const novaData = dto.data !== undefined ? toDateOrNull(dto.data) : undefined;
    if (dto.data !== undefined && !novaData) throw new BadRequestException('Data inválida');

    const dataUpdate: Prisma.FinanceiroUpdateInput = {
      ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
      ...(dto.tipo !== undefined ? { tipo: dto.tipo as any } : {}),
      ...(dto.valor !== undefined ? { valor: Number(dto.valor) } : {}),
      ...(novaData !== undefined ? { data: novaData } : {}),
    };

    const changes = diffChanges(
      { descricao: current.descricao, tipo: current.tipo, valor: current.valor, data: current.data },
      { descricao: dto.descricao, tipo: dto.tipo, valor: dto.valor != null ? Number(dto.valor) : undefined, data: novaData },
      ['descricao', 'tipo', 'valor', 'data']
    );

    const atualizado = await this.prisma.financeiro.update({
      where: { id },
      data: dataUpdate,
    });

    await this.safeLog(
      usuarioId,
      `financeiro_atualizado: id=${id} tipo=${atualizado.tipo} valor=${atualizado.valor} changes=${changes.join(',')}`
    );

    return atualizado;
  }

  async remove(id: string, usuarioId: string) {
    const exists = await this.assertAcessoRegistro(id, usuarioId);

    await this.prisma.financeiro.delete({ where: { id } });

    await this.safeLog(
      usuarioId,
      `financeiro_excluido: id=${id} desc="${exists.descricao ?? ''}" valor=${exists.valor}`
    );

    return { message: 'Removido com sucesso' };
  }
}