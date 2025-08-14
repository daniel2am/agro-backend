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
import { extractChanges } from 'src/common/utils/extract-changes';

@Injectable()
export class AnimalService {
  private readonly logger = new Logger(AnimalService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({
        data: { usuarioId, acao },
      });
    } catch (e) {
      this.logger.warn(`Falha ao registrar log: ${String(e)}`);
    }
  }

  // Mapeia campos -> rótulos "bonitos" para aparecer no dashboard
  private readonly fieldLabels: Record<string, string> = {
    brinco: 'Brinco',
    nome: 'Nome',
    sexo: 'Sexo',
    raca: 'Raça',
    idade: 'Idade',
    unidadeIdade: 'Unidade de idade',
    lote: 'Lote',
    peso: 'Peso',
    invernadaId: 'Invernada',
  };

  private toLabeledChanges(keys: string[]): string[] {
    return keys.map((k) => this.fieldLabels[k] ?? k);
  }

  // CREATE
  async create(dto: CreateAnimalDto, usuarioId: string) {
    // acesso
    await this.verificarAcessoAFazenda(dto.fazendaId, usuarioId);

    // invernada (quando enviada) tem que pertencer à mesma fazenda
    if (dto.invernadaId) {
      await this.verificarInvernada(dto.invernadaId, dto.fazendaId);
    }

    const animal = await this.prisma.animal.create({
      data: {
        brinco: dto.brinco,
        nome: dto.nome ?? null,
        sexo: dto.sexo ?? null,
        raca: dto.raca ?? null,
        idade: dto.idade ?? null,
        unidadeIdade: dto.unidadeIdade ?? null,
        peso: dto.peso ?? null,
        lote: dto.lote ?? null,
        fazendaId: dto.fazendaId,
        invernadaId: dto.invernadaId ?? null,
      },
    });

    // se veio peso, cria histórico de pesagem
    if (dto.peso !== undefined && dto.peso !== null && !Number.isNaN(Number(dto.peso))) {
      try {
        await this.prisma.pesagem.create({
          data: {
            animalId: animal.id,
            fazendaId: dto.fazendaId,
            data: new Date(),
            pesoKg: Number(dto.peso),
          },
        });
        await this.safeLog(
          usuarioId,
          `pesagem_registrada animal=${animal.id} brinco=${animal.brinco} pesoKg=${Number(
            dto.peso,
          )} fazenda=${dto.fazendaId}`,
        );
      } catch (e) {
        this.logger.warn(`Falha ao registrar pesagem inicial do animal ${animal.id}: ${String(e)}`);
      }
    }

    await this.safeLog(
      usuarioId,
      `animal_criado brinco=${animal.brinco} id=${animal.id} fazenda=${dto.fazendaId}`,
    );

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
      fazenda: { usuarios: { some: { usuarioId } } },
      ...(search
        ? {
            OR: [
              { brinco: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { raca: { contains: search, mode: Prisma.QueryMode.insensitive } },
              { nome: { contains: search, mode: Prisma.QueryMode.insensitive } },
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
    const atual = await this.prisma.animal.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
    });
    if (!atual) throw new ForbiddenException('Acesso negado');

    if (dto.invernadaId) {
      await this.verificarInvernada(dto.invernadaId, atual.fazendaId);
    }

    const dataUpdate: Prisma.AnimalUpdateInput = {
      ...(dto.brinco !== undefined ? { brinco: dto.brinco } : {}),
      ...(dto.nome !== undefined ? { nome: dto.nome ?? null } : {}),
      ...(dto.sexo !== undefined ? { sexo: dto.sexo ?? null } : {}),
      ...(dto.raca !== undefined ? { raca: dto.raca ?? null } : {}),
      ...(dto.idade !== undefined ? { idade: dto.idade ?? null } : {}),
      ...(dto.unidadeIdade !== undefined
        ? { unidadeIdade: dto.unidadeIdade ?? null }
        : {}),
      ...(dto.lote !== undefined ? { lote: dto.lote ?? null } : {}),
      ...(dto.peso !== undefined ? { peso: dto.peso ?? null } : {}),
      ...(dto.invernadaId !== undefined
        ? { invernadaId: dto.invernadaId ?? null }
        : {}),
    };

    // changes (com rótulo bonito)
    const rawChanges = extractChanges<typeof atual>(atual, dto);
    const labeled = this.toLabeledChanges(rawChanges);

    const atualizado = await this.prisma.animal.update({
      where: { id },
      data: dataUpdate,
      include: { fazenda: true, invernada: true },
    });

    // se veio novo peso, registra histórico de pesagem
    if (dto.peso !== undefined && dto.peso !== null && !Number.isNaN(Number(dto.peso))) {
      try {
        await this.prisma.pesagem.create({
          data: {
            animalId: id,
            fazendaId: atualizado.fazendaId,
            data: new Date(),
            pesoKg: Number(dto.peso),
          },
        });
        await this.safeLog(
          usuarioId,
          `pesagem_registrada animal=${id} brinco=${atualizado.brinco} pesoKg=${Number(
            dto.peso,
          )} fazenda=${atualizado.fazendaId}`,
        );
      } catch (e) {
        this.logger.warn(`Falha ao registrar pesagem no update do animal ${id}: ${String(e)}`);
      }
    }

    // log com changes=...
    await this.safeLog(
      usuarioId,
      `animal_atualizado brinco=${atualizado.brinco} id=${atualizado.id} fazenda=${atualizado.fazendaId} changes=${labeled.join(',')}`,
    );

    return atualizado;
  }

  // DELETE
  async remove(id: string, usuarioId: string) {
    const animal = await this.prisma.animal.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId } } },
      },
      select: { id: true, fazendaId: true, brinco: true },
    });

    if (!animal) throw new ForbiddenException('Acesso negado');

    // apaga dependências primeiro (ordem segura)
    await this.prisma.$transaction([
      this.prisma.leituraDispositivo.deleteMany({ where: { animalId: id } }),
      this.prisma.medicamento.deleteMany({ where: { animalId: id } }),
      this.prisma.sanidade.deleteMany({ where: { animalId: id } }),
      this.prisma.manejo.deleteMany({ where: { animalId: id } }),
      this.prisma.pesagem.deleteMany({ where: { animalId: id } }),
      this.prisma.ocorrencia.deleteMany({ where: { animalId: id } }),
      this.prisma.animal.delete({ where: { id } }),
    ]);

    await this.safeLog(
      usuarioId,
      `animal_excluido brinco=${animal.brinco} id=${animal.id} fazenda=${animal.fazendaId}`,
    );

    return { message: 'Animal removido com sucesso' };
  }

  // EXPORT CSV
  async exportCSV(usuarioId: string) {
    const animais = await this.prisma.animal.findMany({
      where: { fazenda: { usuarios: { some: { usuarioId } } } },
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
      where: { fazenda: { usuarios: { some: { usuarioId } } } },
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
          `Idade: ${animal.idade ? `${animal.idade} ${animal.unidadeIdade}` : 'N/A'}`
        )
        .text(`Peso: ${animal.peso ?? 'N/A'}`)
        .text(`Lote: ${animal.lote ?? 'N/A'}`)
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
      where: { id: fazendaId, usuarios: { some: { usuarioId } } },
    });
    if (!fazenda) throw new ForbiddenException('Acesso negado à fazenda');
  }

  private async verificarInvernada(invernadaId: string, fazendaId: string) {
    const invernada = await this.prisma.invernada.findFirst({
      where: { id: invernadaId, fazendaId },
    });
    if (!invernada) throw new ForbiddenException('Invernada não encontrada nessa fazenda');
  }
}