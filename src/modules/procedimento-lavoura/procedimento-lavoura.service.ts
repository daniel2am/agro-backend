// src/modules/procedimento-lavoura/procedimento-lavoura.service.ts
//
// Tratos culturais (defensivo, irrigação, adubação, colheita...) vinculados a
// uma lavoura. Sempre restrito às fazendas do usuário via a lavoura.
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateProcedimentoDto } from './dto/create-procedimento.dto';
import { UpdateProcedimentoDto } from './dto/update-procedimento.dto';

@Injectable()
export class ProcedimentoLavouraService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAcessoLavoura(lavouraId: string, usuarioId: string) {
    const lavoura = await this.prisma.lavoura.findFirst({
      where: { id: lavouraId, fazenda: { usuarios: { some: { usuarioId } } } },
      select: { id: true },
    });
    if (!lavoura) throw new ForbiddenException('Acesso negado à lavoura');
  }

  private async assertAcessoProcedimento(id: string, usuarioId: string) {
    const proc = await this.prisma.procedimentoLavoura.findFirst({
      where: { id, lavoura: { fazenda: { usuarios: { some: { usuarioId } } } } },
    });
    if (!proc) throw new NotFoundException('Procedimento não encontrado ou acesso negado');
    return proc;
  }

  async create(dto: CreateProcedimentoDto, usuarioId: string) {
    await this.assertAcessoLavoura(dto.lavouraId, usuarioId);
    const data = new Date(dto.data);
    if (Number.isNaN(data.getTime())) throw new BadRequestException('Data inválida');

    return this.prisma.procedimentoLavoura.create({
      data: {
        lavouraId: dto.lavouraId,
        tipo: dto.tipo,
        data,
        produto: dto.produto ?? null,
        quantidade: dto.quantidade ?? null,
        responsavel: dto.responsavel ?? null,
        observacoes: dto.observacoes ?? null,
      },
    });
  }

  /** Lista os procedimentos de uma lavoura (histórico), do mais recente ao mais antigo. */
  async findByLavoura(lavouraId: string, usuarioId: string) {
    await this.assertAcessoLavoura(lavouraId, usuarioId);
    return this.prisma.procedimentoLavoura.findMany({
      where: { lavouraId },
      orderBy: { data: 'desc' },
    });
  }

  async update(id: string, dto: UpdateProcedimentoDto, usuarioId: string) {
    await this.assertAcessoProcedimento(id, usuarioId);
    const novaData = dto.data !== undefined ? new Date(dto.data) : undefined;
    if (dto.data !== undefined && Number.isNaN(novaData!.getTime())) {
      throw new BadRequestException('Data inválida');
    }

    return this.prisma.procedimentoLavoura.update({
      where: { id },
      data: {
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(novaData !== undefined ? { data: novaData } : {}),
        ...(dto.produto !== undefined ? { produto: dto.produto } : {}),
        ...(dto.quantidade !== undefined ? { quantidade: dto.quantidade } : {}),
        ...(dto.responsavel !== undefined ? { responsavel: dto.responsavel } : {}),
        ...(dto.observacoes !== undefined ? { observacoes: dto.observacoes } : {}),
      },
    });
  }

  async remove(id: string, usuarioId: string) {
    await this.assertAcessoProcedimento(id, usuarioId);
    await this.prisma.procedimentoLavoura.delete({ where: { id } });
    return { message: 'Procedimento removido com sucesso' };
  }
}
