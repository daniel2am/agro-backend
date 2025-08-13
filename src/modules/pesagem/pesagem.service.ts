import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreatePesagemDto } from './dto/create-pesagem.dto';
import { UpdatePesagemDto } from './dto/update-pesagem.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PesagemService {
  private readonly logger = new Logger(PesagemService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==== helpers ====
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

  private async assertAcessoAPesagem(pesagemId: string, usuarioId: string) {
    const pes = await this.prisma.pesagem.findFirst({
      where: {
        id: pesagemId,
        animal: { fazenda: { usuarios: { some: { usuarioId } } } },
      },
      include: { animal: { select: { brinco: true, fazendaId: true, id: true } } },
    });
    if (!pes) throw new NotFoundException('Pesagem não encontrada ou acesso negado');
    return pes;
  }

  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log: ${String(e)}`);
    }
  }

  // ==== create ====
  async create(dto: CreatePesagemDto, usuarioId: string) {
    const animal = await this.assertAcessoAoAnimal(dto.animalId, usuarioId);

    const data = new Date(dto.data);
    if (Number.isNaN(data.getTime())) {
      throw new BadRequestException('Data inválida');
    }

    const nova = await this.prisma.pesagem.create({
      data: {
        animalId: animal.id,
        fazendaId: animal.fazendaId,
        data,
        pesoKg: Number(dto.pesoKg),
      },
      include: { animal: true },
    });

    await this.safeLog(
      usuarioId,
      `pesagem_criada: animal=${animal.brinco} peso=${nova.pesoKg}kg em ${data.toISOString()}`,
    );

    return nova;
  }

  // ==== list ====
  async findAll(usuarioId: string, query: any = {}) {
    const {
      animalId,
      inicio, // ISO
      fim,    // ISO
      take = 50,
      skip = 0,
    } = query;

    const where: Prisma.PesagemWhereInput = {
      animal: { fazenda: { usuarios: { some: { usuarioId } } } },
      ...(animalId ? { animalId } : {}),
      ...(inicio || fim
        ? {
            data: {
              ...(inicio ? { gte: new Date(inicio) } : {}),
              ...(fim ? { lte: new Date(fim) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.pesagem.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { data: 'desc' },
        include: { animal: true },
      }),
      this.prisma.pesagem.count({ where }),
    ]);

    return { data, total };
  }

  // ==== get one ====
  async findOne(id: string, usuarioId: string) {
    const pes = await this.assertAcessoAPesagem(id, usuarioId);
    return pes;
  }

  // ==== update ====
  async update(id: string, dto: UpdatePesagemDto, usuarioId: string) {
    const current = await this.assertAcessoAPesagem(id, usuarioId);

    const dataUpdate: Prisma.PesagemUpdateInput = {};
    if (dto.data !== undefined) {
      const d = new Date(dto.data);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida');
      dataUpdate.data = d;
    }
    if (dto.pesoKg !== undefined) {
      dataUpdate.pesoKg = Number(dto.pesoKg);
    }

    const updated = await this.prisma.pesagem.update({
      where: { id },
      data: dataUpdate,
      include: { animal: true },
    });

    await this.safeLog(
      usuarioId,
      `pesagem_atualizada: animal=${updated.animal?.brinco ?? current.animal.brinco} peso=${updated.pesoKg}kg`,
    );

    return updated;
  }

  // ==== remove ====
  async remove(id: string, usuarioId: string) {
    const pes = await this.assertAcessoAPesagem(id, usuarioId);

    await this.prisma.pesagem.delete({ where: { id } });

    await this.safeLog(
      usuarioId,
      `pesagem_excluida: animal=${pes.animal?.brinco ?? ''} peso=${pes.pesoKg}kg`,
    );

    return { message: 'Pesagem removida com sucesso' };
  }
}