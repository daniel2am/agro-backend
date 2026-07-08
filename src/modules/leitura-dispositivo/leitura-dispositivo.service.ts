import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateLeituraDispositivoDto } from './dto/create-leitura-dispositivo.dto';

const USUARIO_SAFE_SELECT = { id: true, nome: true, email: true } as const;

@Injectable()
export class LeituraDispositivoService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAcessoFazenda(fazendaId: string, usuarioId: string) {
    const ok = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException('Acesso negado à fazenda');
  }

  async create(data: CreateLeituraDispositivoDto, usuarioId: string) {
    await this.assertAcessoFazenda(data.fazendaId, usuarioId);
    return this.prisma.leituraDispositivo.create({ data: { ...data, usuarioId } });
  }

  async findAllByFazenda(fazendaId: string, usuarioId: string) {
    await this.assertAcessoFazenda(fazendaId, usuarioId);
    return this.prisma.leituraDispositivo.findMany({
      where: { fazendaId },
      include: {
        dispositivo: true,
        animal: true,
        invernada: true,
        usuario: { select: USUARIO_SAFE_SELECT },
      },
    });
  }

  async findOne(id: string, usuarioId: string) {
    const leitura = await this.prisma.leituraDispositivo.findUnique({
      where: { id },
      include: {
        dispositivo: true,
        animal: true,
        invernada: true,
        usuario: { select: USUARIO_SAFE_SELECT },
      },
    });
    if (!leitura) throw new NotFoundException('Leitura não encontrada');
    await this.assertAcessoFazenda(leitura.fazendaId, usuarioId);
    return leitura;
  }

  async remove(id: string, usuarioId: string) {
    const leitura = await this.prisma.leituraDispositivo.findUnique({
      where: { id },
      select: { id: true, fazendaId: true },
    });
    if (!leitura) throw new NotFoundException('Leitura não encontrada');
    await this.assertAcessoFazenda(leitura.fazendaId, usuarioId);
    return this.prisma.leituraDispositivo.delete({ where: { id } });
  }
}
