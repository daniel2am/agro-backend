import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
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
    console.log('📨 Dados recebidos no service:', data);
    console.log('👤 Usuario ID:', usuarioId);

    const fazenda = await this.prisma.fazenda.create({
      data: {
        ...data,
        usuarios: {
          create: [{
            usuarioId,
            papel: 'administrador', // Certifique-se de que está no enum
          }],
        },
      },
    });

    console.log('✅ Fazenda criada com sucesso:', fazenda.id);
    return fazenda;
  } catch (error) {
    console.error('❌ Erro ao criar fazenda:', error);
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
    if (!fazenda) throw new NotFoundException('Fazenda não encontrada ou acesso negado');
    return fazenda;
  }

  async update(id: string, data: UpdateFazendaDto, usuarioId: string) {
    const check = await this.findOne(id, usuarioId);
    if (!check) throw new ForbiddenException('Acesso negado');
    return this.prisma.fazenda.update({ where: { id }, data });
  }

  async remove(id: string, usuarioId: string) {
    const check = await this.findOne(id, usuarioId);
    if (!check) throw new ForbiddenException('Acesso negado');
    await this.prisma.fazenda.delete({ where: { id } });
    return { message: 'Fazenda removida com sucesso' };
  }
}