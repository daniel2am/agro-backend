import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { Parser } from 'json2csv';
import * as PDFDocument from 'pdfkit';
import * as streamBuffers from 'stream-buffers';

@Injectable()
export class AnimalService {
  private readonly logger = new Logger(AnimalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAnimalDto, usuarioId: string) {
    await this.verificarAcessoAFazenda(data.fazendaId, usuarioId);
    if (data.invernadaId) {
      await this.verificarInvernada(data.invernadaId, data.fazendaId);
    }
    return this.prisma.animal.create({ data });
  }

  async findAll(usuarioId: string, params: any = {}) {
    const { take = 20, skip = 0, search, fazendaId } = params;

    const where: any = {
      ...(fazendaId ? { fazendaId } : {}),
      fazenda: { usuarios: { some: { usuarioId } } },
    };

    if (search) {
      where.OR = [
        { brinco: { contains: search, mode: 'insensitive' } },
        { nome: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.animal.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { brinco: 'asc' },
        include: { fazenda: true, invernada: true },
      }),
      this.prisma.animal.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, usuarioId: string) {
    const animal = await this.prisma.animal.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
      include: { fazenda: true, invernada: true },
    });

    if (!animal) {
      throw new NotFoundException('Animal não encontrado ou acesso negado');
    }

    return animal;
  }

  async update(id: string, data: UpdateAnimalDto, usuarioId: string) {
    const animal = await this.prisma.animal.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
    });

    if (!animal) throw new ForbiddenException('Acesso negado');

    if (data.invernadaId) {
      await this.verificarInvernada(data.invernadaId, animal.fazendaId);
    }

    return this.prisma.animal.update({ where: { id }, data });
  }

  async remove(id: string, usuarioId: string) {
    const animal = await this.prisma.animal.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
    });

    if (!animal) throw new ForbiddenException('Acesso negado');

    await this.prisma.animal.delete({ where: { id } });
    return { message: 'Animal removido com sucesso' };
  }

  async exportCSV(usuarioId: string) {
    const animais = await this.prisma.animal.findMany({
      where: {
        fazenda: { usuarios: { some: { usuarioId } } },
      },
      include: { fazenda: true, invernada: true },
    });

    const parser = new Parser();
    const csv = parser.parse(animais);
    const filename = `animais-${new Date().toISOString().slice(0, 10)}.csv`;

    return { buffer: Buffer.from(csv, 'utf-8'), filename };
  }

  async exportPDF(usuarioId: string) {
    const animais = await this.prisma.animal.findMany({
      where: {
        fazenda: { usuarios: { some: { usuarioId } } },
      },
      include: { fazenda: true, invernada: true },
    });

    const doc = new PDFDocument();
    const bufferStream = new streamBuffers.WritableStreamBuffer();

    doc.pipe(bufferStream);
    doc.fontSize(16).text('Relatório de Animais', { align: 'center' });
    doc.moveDown();

    animais.forEach((animal) => {
      doc
        .fontSize(12)
        .text(`Brinco: ${animal.brinco}`)
        .text(`Sexo: ${animal.sexo ?? 'N/A'}`)
        .text(`Raça: ${animal.raca ?? 'N/A'}`)
        .text(
          `Nascimento: ${
            animal.nascimento
              ? new Date(animal.nascimento).toLocaleDateString('pt-BR')
              : 'N/A'
          }`
        )
        .text(`Fazenda: ${animal.fazenda?.nome ?? 'N/A'}`)
        .text(`Invernada: ${animal.invernada?.nome ?? 'N/A'}`)
        .moveDown();
    });

    doc.end();

    await new Promise((resolve) => bufferStream.on('finish', resolve));
    const filename = `animais-${new Date().toISOString().slice(0, 10)}.pdf`;

    return {
      buffer: bufferStream.getContents(),
      filename,
    };
  }

  private async verificarAcessoAFazenda(fazendaId: string, usuarioId: string) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: {
        id: fazendaId,
        usuarios: { some: { usuarioId } },
      },
    });

    if (!fazenda) throw new ForbiddenException('Acesso negado à fazenda');
  }

  private async verificarInvernada(invernadaId: string, fazendaId: string) {
    const invernada = await this.prisma.invernada.findFirst({
      where: { id: invernadaId, fazendaId },
    });

    if (!invernada)
      throw new ForbiddenException('Invernada não encontrada nessa fazenda');
  }
}
