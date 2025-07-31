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
            create: [
              {
                usuarioId,
                papel: 'administrador',
              },
            ],
          },
        },
      });

      this.logger.log(`✅ Fazenda criada com sucesso: ${fazenda.id}`);
      return fazenda;
    } catch (error) {
      this.logger.error('❌ Erro ao criar fazenda', error.stack || error.message);
      throw error;
    }
  }

  async findAll(usuarioId: string, params: any = {}) {
    const { take = 20, skip = 0, search } = params;

    const where: Prisma.FazendaWhereInput = {
      usuarios: {
        some: { usuarioId },
      },
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
      where: {
        id,
        usuarios: {
          some: { usuarioId },
        },
      },
    });

    if (!fazenda) {
      throw new NotFoundException('Fazenda não encontrada ou acesso negado');
    }

    return fazenda;
  }

  async update(id: string, data: UpdateFazendaDto, usuarioId: string) {
    const existing = await this.findOne(id, usuarioId);
    if (!existing) {
      throw new ForbiddenException('Acesso negado');
    }

    return this.prisma.fazenda.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, usuarioId: string) {
    const existing = await this.findOne(id, usuarioId);
    if (!existing) {
      throw new ForbiddenException('Acesso negado');
    }

    await this.prisma.fazenda.delete({
      where: { id },
    });

    return { message: 'Fazenda removida com sucesso' };
  }
}
