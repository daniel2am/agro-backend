// src/modules/fazenda/fazenda.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';
import { PapelUsuarioFazenda, Prisma } from '@prisma/client';

@Injectable()
export class FazendaService {
  private readonly logger = new Logger(FazendaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // log que não quebra o fluxo
  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log (fazenda): ${String(e)}`);
    }
  }

  async create(data: CreateFazendaDto, usuarioId: string) {
    if (!usuarioId) throw new BadRequestException('Usuário não autenticado');

    try {
      const fazenda = await this.prisma.fazenda.create({
        data: {
          ...data,
          usuarios: {
            create: [
              {
                usuarioId,
                papel: PapelUsuarioFazenda.administrador,
              },
            ],
          },
        },
      });

      await this.safeLog(
        usuarioId,
        `fazenda_criada id=${fazenda.id} nome="${(fazenda as any).nome ?? ''}"`
      );

      return fazenda;
    } catch (error: any) {
      // violações de unicidade (ex.: cadastroIncra)
      if (error?.code === 'P2002') {
        throw new ConflictException('Já existe uma fazenda com esses dados únicos (ex.: INCRA).');
      }
      this.logger.error('Erro ao criar fazenda', error?.stack || error?.message);
      throw error;
    }
  }

  /**
   * Lista fazendas do usuário com paginação.
   * Aceita tanto {page, pageSize} quanto {take, skip} (para compat).
   */
  async findAll(usuarioId: string, params: any = {}) {
    const page =
      params.page && Number(params.page) > 0 ? Number(params.page) : undefined;
    const pageSize =
      params.pageSize && Number(params.pageSize) > 0 ? Number(params.pageSize) : undefined;

    // compatibilidade com chamadas antigas
    const take = pageSize ?? (params.take ? Number(params.take) : 20);
    const skip =
      page && take ? (page - 1) * take : (params.skip ? Number(params.skip) : 0);

    const search: string | undefined = (params.search || '').trim() || undefined;

    const where: Prisma.FazendaWhereInput = {
      usuarios: { some: { usuarioId } },
      ...(search && {
        OR: [
          { nome: { contains: search, mode: 'insensitive' } },
          { cidade: { contains: search, mode: 'insensitive' } },
          { estado: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.fazenda.findMany({
        where,
        take,
        skip,
        orderBy: { nome: 'asc' },
      }),
      this.prisma.fazenda.count({ where }),
    ]);

    // devolve paginação amigável
    const currentPage = take ? Math.floor(skip / take) + 1 : 1;
    const totalPages = take ? Math.max(1, Math.ceil(total / take)) : 1;

    return { data, total, page: currentPage, pageSize: take, totalPages };
  }

  /** Busca garantindo que a fazenda pertence ao usuário */
  async findOne(id: string, usuarioId: string) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: { id, usuarios: { some: { usuarioId } } },
    });

    if (!fazenda) {
      throw new NotFoundException('Fazenda não encontrada ou acesso negado');
    }
    return fazenda;
  }

  async update(id: string, data: UpdateFazendaDto, usuarioId: string) {
    // valida ownership
    const existing = await this.findOne(id, usuarioId);
    if (!existing) throw new ForbiddenException('Acesso negado');

    // calcula campos alterados para log (somente os presentes no DTO)
    const alterados: string[] = [];
    for (const k of Object.keys(data) as (keyof UpdateFazendaDto)[]) {
      if (data[k] !== undefined && (existing as any)[k] !== (data as any)[k]) {
        alterados.push(String(k));
      }
    }

    try {
      const updated = await this.prisma.fazenda.update({
        where: { id },
        data,
      });

      await this.safeLog(
        usuarioId,
        `fazenda_atualizada id=${id} nome="${(updated as any).nome ?? ''}" changes=${alterados.join(',')}`
      );

      return updated;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Conflito de dados únicos ao atualizar a fazenda.');
      }
      this.logger.error('Erro ao atualizar fazenda', error?.stack || error?.message);
      throw error;
    }
  }

  async remove(id: string, usuarioId: string) {
    // valida ownership
    const existing = await this.findOne(id, usuarioId);
    if (!existing) throw new ForbiddenException('Acesso negado');

    try {
      await this.prisma.fazenda.delete({ where: { id } });

      await this.safeLog(
        usuarioId,
        `fazenda_excluida id=${id} nome="${(existing as any).nome ?? ''}"`
      );

      return { message: 'Fazenda removida com sucesso' };
    } catch (error: any) {
      this.logger.error('Erro ao remover fazenda', error?.stack || error?.message);
      throw error;
    }
  }
}