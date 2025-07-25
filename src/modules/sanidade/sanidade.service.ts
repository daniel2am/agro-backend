import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateSanidadeDto } from './dto/create-sanidade.dto';
import { UpdateSanidadeDto } from './dto/update-sanidade.dto';

@Injectable()
export class SanidadeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSanidadeDto, usuarioId: string) {
    const animal = await this.prisma.animal.findFirst({
      where: {
        id: dto.animalId,
        fazenda: {
          usuarios: {
            some: { usuarioId },
          },
        },
      },
    });

    if (!animal) {
      throw new ForbiddenException('Animal não encontrado ou acesso negado');
    }

    return this.prisma.sanidade.create({
      data: {
        data: new Date(dto.data),
        tipo: dto.tipo,
        observacoes: dto.observacoes,
        animal: {
          connect: { id: dto.animalId },
        },
      },
    });
  }

  async findAll(usuarioId: string, params: any = {}) {
    const { take = 10, skip = 0, search } = params;

    const where: any = {
      animal: {
        fazenda: {
          usuarios: {
            some: { usuarioId },
          },
        },
      },
    };

    if (search) {
      where.tipo = { contains: search, mode: 'insensitive' };
    }

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

  async findOne(id: string, usuarioId: string) {
    const sanidade = await this.prisma.sanidade.findFirst({
      where: {
        id,
        animal: {
          fazenda: {
            usuarios: {
              some: { usuarioId },
            },
          },
        },
      },
      include: { animal: true },
    });

    if (!sanidade) {
      throw new NotFoundException('Registro de sanidade não encontrado');
    }

    return sanidade;
  }

  async update(id: string, dto: UpdateSanidadeDto, usuarioId: string) {
    const exists = await this.prisma.sanidade.findFirst({
      where: {
        id,
        animal: {
          fazenda: {
            usuarios: {
              some: { usuarioId },
            },
          },
        },
      },
    });

    if (!exists) {
      throw new ForbiddenException('Acesso negado');
    }

    return this.prisma.sanidade.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, usuarioId: string) {
    const exists = await this.prisma.sanidade.findFirst({
      where: {
        id,
        animal: {
          fazenda: {
            usuarios: {
              some: { usuarioId },
            },
          },
        },
      },
    });

    if (!exists) {
      throw new ForbiddenException('Acesso negado');
    }

    return this.prisma.sanidade.delete({ where: { id } });
  }
}
