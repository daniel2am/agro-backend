import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateMedicamentoDto } from './dto/create-medicamento.dto';
import { UpdateMedicamentoDto } from './dto/update-medicamento.dto';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { UsuarioPayload } from '../auth/dto/usuario-payload.interface';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Parser } from 'json2csv';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class MedicamentoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMedicamentoDto, user: UsuarioPayload) {
    const animal = await this.prisma.animal.findUnique({
      where: { id: dto.animalId },
    });

    if (!animal || animal.fazendaId !== user.fazendaId) {
      throw new ForbiddenException('Animal não encontrado ou acesso negado');
    }

    return this.prisma.medicamento.create({
      data: {
        ...dto,
        data: new Date(dto.data),
      },
    });
  }

  async findAll(user: UsuarioPayload) {
    return this.prisma.medicamento.findMany({
      where: {
        animal: {
          fazendaId: user.fazendaId,
        },
      },
      orderBy: {
        data: 'desc',
      },
      include: {
        animal: {
          select: {
            nome: true,
            brinco: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user: UsuarioPayload) {
    const medicamento = await this.prisma.medicamento.findUnique({
      where: { id },
      include: { animal: true },
    });

    if (!medicamento || medicamento.animal.fazendaId !== user.fazendaId) {
      throw new NotFoundException('Medicamento não encontrado');
    }

    return medicamento;
  }

  async update(id: string, dto: UpdateMedicamentoDto, user: UsuarioPayload) {
    const medicamento = await this.findOne(id, user);

    return this.prisma.medicamento.update({
      where: { id },
      data: {
        ...dto,
        data: dto.data ? new Date(dto.data) : medicamento.data,
      },
    });
  }

  async remove(id: string, user: UsuarioPayload) {
    await this.findOne(id, user);
    return this.prisma.medicamento.delete({ where: { id } });
  }

  async exportCSV(user: UsuarioPayload) {
    const data = await this.findAll(user);
    const parser = new Parser();
    const csv = parser.parse(data);
    const filePath = join(__dirname, 'medicamentos.csv');
    writeFileSync(filePath, csv);
    return filePath;
  }

  async exportPDF(user: UsuarioPayload) {
    const data = await this.findAll(user);
    const doc = new PDFDocument();
    const filePath = join(__dirname, 'medicamentos.pdf');
    doc.pipe(writeFileSync(filePath, '', { flag: 'w' }) as any);

    doc.fontSize(16).text('Relatório de Medicamentos', { align: 'center' }).moveDown();
    data.forEach((m) => {
      doc
        .fontSize(12)
        .text(`Medicamento: ${m.nome}`)
        .text(`Data: ${new Date(m.data).toLocaleDateString()}`)
        .text(`Dosagem: ${m.dosagem ?? '-'}`)
        .text(`Via: ${m.viaAplicacao ?? '-'}`)
        .text(`Animal: ${m.animal?.nome ?? ''} (${m.animal?.brinco})`)
        .moveDown();
    });

    doc.end();
    return filePath;
  }
}
