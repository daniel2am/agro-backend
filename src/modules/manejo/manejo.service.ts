// src/modules/manejo/manejo.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateManejoDto } from './dto/create-manejo.dto';
import { UpdateManejoDto } from './dto/update-manejo.dto';
import { UsuarioPayload } from 'src/modules/auth/dto/usuario-payload.interface';
import { Parser } from 'json2csv';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ManejoService {
  constructor(private readonly prisma: PrismaService) {}

  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({ data: { usuarioId, acao } });
    } catch {
      // não quebra o fluxo se o log falhar
    }
  }

  async create(dto: CreateManejoDto, user: UsuarioPayload) {
    const criado = await this.prisma.manejo.create({
      data: {
        ...dto,
        fazendaId: user.fazendaId,
        data: new Date(dto.data),
      },
    });

    await this.safeLog(
      user.id,
      `manejo_criado: id=${criado.id}, tipo=${criado.tipo}, animalId=${criado.animalId ?? '-'}`
    );

    return criado;
  }

  async findAll(user: UsuarioPayload) {
    return this.prisma.manejo.findMany({
      where: { fazendaId: user.fazendaId },
      orderBy: { data: 'desc' },
      include: { animal: true },
    });
  }

  async findOne(id: string, user: UsuarioPayload) {
    const manejo = await this.prisma.manejo.findFirst({
      where: { id, fazendaId: user.fazendaId },
      include: { animal: true },
    });
    if (!manejo) throw new NotFoundException('Manejo não encontrado');
    return manejo;
  }

  async update(id: string, dto: UpdateManejoDto, user: UsuarioPayload) {
    const check = await this.prisma.manejo.findFirst({
      where: { id, fazendaId: user.fazendaId },
    });
    if (!check) throw new NotFoundException('Manejo não encontrado');

    const atualizado = await this.prisma.manejo.update({
      where: { id },
      data: {
        ...dto,
        data: dto.data ? new Date(dto.data) : undefined,
      },
    });

    await this.safeLog(
      user.id,
      `manejo_atualizado: id=${id}, tipo=${atualizado.tipo}, animalId=${atualizado.animalId ?? '-'}`
    );

    return atualizado;
  }

  async remove(id: string, user: UsuarioPayload) {
    const check = await this.prisma.manejo.findFirst({
      where: { id, fazendaId: user.fazendaId },
      select: { id: true, tipo: true, animalId: true },
    });
    if (!check) throw new NotFoundException('Manejo não encontrado');

    await this.prisma.manejo.delete({ where: { id } });

    await this.safeLog(
      user.id,
      `manejo_excluido: id=${id}, tipo=${check.tipo}, animalId=${check.animalId ?? '-'}`
    );

    return { message: 'Manejo removido com sucesso' };
  }

  // === Export sem gravar em disco (igual fizemos em outros módulos) ===
  async exportToCSV(user: UsuarioPayload): Promise<string> {
    const registros = await this.findAll(user);
    const parser = new Parser();
    return parser.parse(registros);
  }

  async exportToPDF(user: UsuarioPayload): Promise<PDFDocument> {
    const registros = await this.findAll(user);
    const doc = new PDFDocument();

    doc.fontSize(16).text('Relatório de Manejos', { align: 'center' });
    doc.moveDown();

    registros.forEach((m) => {
      const data = new Date(m.data).toLocaleDateString();
      const animalNome = m.animal?.nome ?? m.animal?.brinco ?? '—';
      doc
        .fontSize(12)
        .text(
          `Animal: ${animalNome} | Tipo: ${m.tipo} | Data: ${data} | Observação: ${m.observacao || '-'}`
        );
      doc.moveDown(0.5);
    });

    // devolvemos o PDFDocument para o controller encadear (pipe) na Response
    return doc;
  }
}