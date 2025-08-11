// src/modules/animal/animal.service.ts
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
import { Prisma } from '@prisma/client';

@Injectable()
export class AnimalService {
  private readonly logger = new Logger(AnimalService.name);

  constructor(private readonly prisma: PrismaService) {}

  // CREATE
  async create(dto: CreateAnimalDto, usuarioId: string) {
    // garante acesso à fazenda
    await this.verificarAcessoAFazenda(dto.fazendaId, usuarioId);

    // se veio invernada, garante que é da mesma fazenda
    if (dto.invernadaId) {
      await this.verificarInvernada(dto.invernadaId, dto.fazendaId);
    }

    // NÃO enviar peso/lote para a tabela Animal (evita erro de client desatualizado no Render)
    const { peso, lote, ...animalData } = dto as any;

    // cria o animal
    const animal = await this.prisma.animal.create({ data: animalData });

    // histórico de peso (opcional)
    if (peso !== undefined && peso !== null && !Number.isNaN(Number(peso))) {
      await this.prisma.pesagem.create({
        data: {
          animalId: animal.id,
          fazendaId: dto.fazendaId,
          data: new Date(),
          pesoKg: Number(peso),
        },
      });
    }

    return animal;
  }

  // LIST
  async findAll(usuarioId: string, params: any = {}) {
    const take = Number(params?.take ?? 20);
    const skip = Number(params?.skip ?? 0);
    const search: string | undefined =
      typeof params?.search === 'string' ? params.search : undefined;
    const fazendaId: string | undefined =
      typeof params?.fazendaId === 'string' ? params.fazendaId : undefined;

    const where: Prisma.AnimalWhereInput = {
      ...(fazendaId ? { fazendaId } : {}),
      // restringe por fazendas às quais o usuário tem acesso
      fazenda: { usuarios: { some: { usuarioId } } },
      ...(search
        ? {
            OR: [
              {
                brinco: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                raca: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                nome: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.animal.findMany({
        where,
        take,
        skip,
        orderBy: { brinco: 'asc' },
        include: { fazenda: true, invernada: true },
      }),
      this.prisma.animal.count({ where }),
    ]);

    return { data, total };
  }

  // GET ONE
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

  // UPDATE
  async update(id: string, dto: UpdateAnimalDto, usuarioId: string) {
    // garante que o animal pertence a uma fazenda do usuário
    const animal = await this.prisma.animal.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
    });
    if (!animal) throw new ForbiddenException('Acesso negado');

    // se vier invernada, valida que pertence à mesma fazenda
    if (dto.invernadaId) {
      await this.verificarInvernada(dto.invernadaId, animal.fazendaId);
    }

    // strip peso/lote do update para não quebrar caso o client não tenha essas colunas
    const { peso, lote, ...updateData } = dto as any;

    const atualizado = await this.prisma.animal.update({
      where: { id },
      data: updateData,
    });

    // novo peso? registra no histórico
    if (peso !== undefined && peso !== null && !Number.isNaN(Number(peso))) {
      await this.prisma.pesagem.create({
        data: {
          animalId: id,
          fazendaId: animal.fazendaId,
          data: new Date(),
          pesoKg: Number(peso),
        },
      });
    }

    return atualizado;
  }

  // DELETE
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

  // EXPORT CSV
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

  // EXPORT PDF
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
          `Idade: ${
            animal.idade ? `${animal.idade} ${animal.unidadeIdade}` : 'N/A'
          }`,
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

  // HELPERS
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