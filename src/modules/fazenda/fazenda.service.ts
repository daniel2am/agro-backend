// src/modules/fazenda/fazenda.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateFazendaDto } from './dto/create-fazenda.dto';
import { UpdateFazendaDto } from './dto/update-fazenda.dto';
import { Prisma } from '@prisma/client';

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
    try {
      this.logger.log('📨 Dados recebidos no service: ' + JSON.stringify(data));
      this.logger.log(`👤 Usuario ID: ${usuarioId}`);

      if (!usuarioId) {
        throw new BadRequestException('Usuário não autenticado');
      }

      const fazenda = await this.prisma.fazenda.create({
        data: {
          ...data,
          usuarios: {
            create: [{ usuarioId, papel: 'administrador' }],
          },
        },
      });

      // log p/ histórico
      await this.safeLog(
        usuarioId,
        `fazenda_criada id=${fazenda.id} nome="${(fazenda as any).nome ?? ''}"`
      );

      this.logger.log(`✅ Fazenda criada com sucesso: ${fazenda.id}`);
      return fazenda;
    } catch (error) {
      this.logger.error('❌ Erro ao criar fazenda', (error as any)?.stack || (error as any)?.message);
      throw error;
    }
  }

  async findAll(usuarioId: string, params: any = {}) {
    const { take = 20, skip = 0, search } = params;

    const where: Prisma.FazendaWhereInput = {
      usuarios: { some: { usuarioId } },
      ...(search && {
        OR: [
          { nome: { contains: search, mode: 'insensitive' } },
          { cidade: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.fazenda.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { nome: 'asc' },
      }),
      this.prisma.fazenda.count({ where }),
    ]);

    return { data, total };
  }

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
    const existing = await this.findOne(id, usuarioId);
    if (!existing) throw new ForbiddenException('Acesso negado');

    // calcula campos alterados para log (somente os presentes no DTO)
    const alterados: string[] = [];
    for (const k of Object.keys(data) as (keyof UpdateFazendaDto)[]) {
      
      if (data[k] !== undefined && (existing as any)[k] !== data[k]) {
        alterados.push(String(k));
      }
    }

    const updated = await this.prisma.fazenda.update({
      where: { id },
      data,
    });

    // log p/ histórico
    await this.safeLog(
      usuarioId,
      `fazenda_atualizada id=${id} nome="${(updated as any).nome ?? ''}" changes=${alterados.join(',')}`
    );

    return updated;
  }

  async remove(id: string, usuarioId: string) {
    const existing = await this.findOne(id, usuarioId);
    if (!existing) throw new ForbiddenException('Acesso negado');

    await this.prisma.fazenda.delete({ where: { id } });

    // log p/ histórico
    await this.safeLog(
      usuarioId,
      `fazenda_excluida id=${id} nome="${(existing as any).nome ?? ''}"`
    );

    return { message: 'Fazenda removida com sucesso' };
  }
}