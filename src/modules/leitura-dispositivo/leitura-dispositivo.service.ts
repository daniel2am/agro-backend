import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateLeituraDispositivoDto } from './dto/create-leitura-dispositivo.dto';

@Injectable()
export class LeituraDispositivoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateLeituraDispositivoDto) {
    return this.prisma.leituraDispositivo.create({ data });
  }

  async findAllByFazenda(fazendaId: string) {
    return this.prisma.leituraDispositivo.findMany({
      where: { fazendaId },
      include: {
        dispositivo: true,
        animal: true,
        invernada: true,
        usuario: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.leituraDispositivo.findUnique({
      where: { id },
      include: {
        dispositivo: true,
        animal: true,
        invernada: true,
        usuario: true,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.leituraDispositivo.delete({ where: { id } });
  }
}