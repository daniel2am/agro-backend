import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreatePesagemDto } from './dto/create-pesagem.dto';
import { UpdatePesagemDto } from './dto/update-pesagem.dto';
import { UsuarioPayload } from 'src/modules/auth/dto/usuario-payload.interface';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'json2csv';
import { PDFDocument } from 'pdfkit';

@Injectable()
export class PesagemService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePesagemDto, user: UsuarioPayload) {
    return this.prisma.pesagem.create({
      data: {
        ...dto,
        fazendaId: user.fazendaId,
        data: new Date(dto.data),
      },
    });
  }

  async findAll(user: UsuarioPayload) {
    return this.prisma.pesagem.findMany({
      where: { fazendaId: user.fazendaId },
      orderBy: { data: 'desc' },
      include: { animal: true },
    });
  }

  async findOne(id: string, user: UsuarioPayload) {
    const pesagem = await this.prisma.pesagem.findFirst({
      where: { id, fazendaId: user.fazendaId },
      include: { animal: true },
    });
    if (!pesagem) throw new NotFoundException('Pesagem não encontrada');
    return pesagem;
  }

  async update(id: string, dto: UpdatePesagemDto, user: UsuarioPayload) {
    const check = await this.prisma.pesagem.findFirst({
      where: { id, fazendaId: user.fazendaId },
    });
    if (!check) throw new NotFoundException('Pesagem não encontrada');
    return this.prisma.pesagem.update({
      where: { id },
      data: {
        ...dto,
        data: dto.data ? new Date(dto.data) : undefined,
      },
    });
  }

  async remove(id: string, user: UsuarioPayload) {
    const check = await this.prisma.pesagem.findFirst({
      where: { id, fazendaId: user.fazendaId },
    });
    if (!check) throw new NotFoundException('Pesagem não encontrada');
    return this.prisma.pesagem.delete({ where: { id } });
  }

  async exportCSV(user: UsuarioPayload): Promise<string> {
  const registros = await this.prisma.pesagem.findMany({
    where: { fazendaId: user.fazendaId },
    include: { animal: true },
    orderBy: { data: 'desc' },
  });

  const csv = parse(registros, { delimiter: ';' });
  return csv;
}

  async exportPDF(user: UsuarioPayload) {
    const data = await this.findAll(user);
    const doc = new PDFDocument();
    doc.fontSize(16).text('Relatório de Pesagens', { align: 'center' });
    doc.moveDown();

    data.forEach((p) => {
      doc.fontSize(12).text(`Animal: ${p.animal?.brinco || 'N/A'}`);
      doc.text(`Peso: ${p.pesoKg} Kg`);
      doc.text(`Data: ${new Date(p.data).toLocaleDateString()}`);
      doc.moveDown();
    });

    return doc;
  }
}
