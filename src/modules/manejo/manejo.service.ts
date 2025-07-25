import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateManejoDto } from './dto/create-manejo.dto';
import { UpdateManejoDto } from './dto/update-manejo.dto';
import { UsuarioPayload } from 'src/modules/auth/dto/usuario-payload.interface';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Parser } from 'json2csv';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ManejoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateManejoDto, user: UsuarioPayload) {
    return this.prisma.manejo.create({
      data: {
        ...dto,
        fazendaId: user.fazendaId,
        data: new Date(dto.data),
      },
    });
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

    return this.prisma.manejo.update({
      where: { id },
      data: {
        ...dto,
        data: dto.data ? new Date(dto.data) : undefined,
      },
    });
  }

  async remove(id: string, user: UsuarioPayload) {
    const check = await this.prisma.manejo.findFirst({
      where: { id, fazendaId: user.fazendaId },
    });
    if (!check) throw new NotFoundException('Manejo não encontrado');
    return this.prisma.manejo.delete({ where: { id } });
  }

  async exportToCSV(user: UsuarioPayload) {
    const registros = await this.findAll(user);
    const parser = new Parser();
    const csv = parser.parse(registros);
    const filePath = join(__dirname, '..', '..', '..', 'csv', `manejos-${Date.now()}.csv`);
    writeFileSync(filePath, csv);
    return filePath;
  }

  async exportToPDF(user: UsuarioPayload) {
    const registros = await this.findAll(user);
    const doc = new PDFDocument();
    const filePath = join(__dirname, '..', '..', '..', 'pdf', `manejos-${Date.now()}.pdf`);
    doc.pipe(writeFileSync(filePath, '', { flag: 'w' }));
    doc.fontSize(16).text('Relatório de Manejos', { align: 'center' });
    doc.moveDown();
    registros.forEach((m) => {
      doc.fontSize(12).text(`Animal: ${m.animal.nome} | Tipo: ${m.tipo} | Data: ${new Date(m.data).toLocaleDateString()} | Observação: ${m.observacao || '-'}`);
      doc.moveDown(0.5);
    });
    doc.end();
    return filePath;
  }
}
