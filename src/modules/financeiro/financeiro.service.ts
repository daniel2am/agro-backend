// src/modules/financeiro/financeiro.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateFinanceiroDto } from './dto/create-financeiro.dto';
import { UpdateFinanceiroDto } from './dto/update-financeiro.dto';
import { ehCategoriaDeDespesa, ehCategoriaDeReceita } from './categorias';
import { PAPEIS_FINANCEIRO } from '../equipe/equipe.service';
import { apenasDigitos, cpfOuCnpjValido } from 'src/common/utils/documentos';

// Campos fiscais (LCDPR): podem ser editados até em lançamentos espelho de compra de insumo
const CAMPOS_FISCAIS = ['contaBancariaId', 'documentoTipo', 'documentoNumero', 'contraparteDoc', 'contraparteNome'] as const;

@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Helpers =====
  private async safeLog(usuarioId: string, acao: string) {
    try {
      await this.prisma.logAcesso.create({
        data: { usuarioId, acao },
      });
    } catch {
      // não quebra o fluxo se o log falhar
    }
  }

  private async assertAcessoFazenda(fazendaId: string, usuarioId: string) {
    const fazenda = await this.prisma.fazenda.findFirst({
      where: { id: fazendaId, usuarios: { some: { usuarioId, papel: { in: PAPEIS_FINANCEIRO } } } },
      select: { id: true },
    });
    if (!fazenda) throw new ForbiddenException('Acesso negado à fazenda');
    return fazenda;
  }

  /** Categoria de despesa não pode ficar numa receita e vice-versa. */
  private assertCategoriaCompativel(tipo: string, categoria?: string | null) {
    if (!categoria) return;
    const ok = tipo === 'despesa' ? ehCategoriaDeDespesa(categoria) : ehCategoriaDeReceita(categoria);
    if (!ok) {
      throw new BadRequestException(`A categoria "${categoria}" não é válida para ${tipo}`);
    }
  }

  /**
   * Valida e normaliza os campos fiscais recebidos. Devolve só o que veio no DTO
   * (undefined = não mexer; null = limpar), já com o CPF/CNPJ só em dígitos.
   */
  private async dadosFiscais(dto: Partial<CreateFinanceiroDto>, fazendaId: string) {
    const out: Record<string, unknown> = {};

    if (dto.contraparteDoc !== undefined) {
      if (dto.contraparteDoc === null || dto.contraparteDoc === '') out.contraparteDoc = null;
      else if (!cpfOuCnpjValido(dto.contraparteDoc)) throw new BadRequestException('CPF/CNPJ do participante inválido');
      else out.contraparteDoc = apenasDigitos(dto.contraparteDoc);
    }
    if (dto.documentoTipo !== undefined) out.documentoTipo = dto.documentoTipo ?? null;
    if (dto.documentoNumero !== undefined) out.documentoNumero = dto.documentoNumero?.trim() || null;
    if (dto.contraparteNome !== undefined) out.contraparteNome = dto.contraparteNome?.trim() || null;

    if (dto.contaBancariaId !== undefined) {
      if (dto.contaBancariaId === null) out.contaBancariaId = null;
      else {
        // a conta tem que ser de alguém que administra esta fazenda
        const conta = await this.prisma.contaBancaria.findFirst({
          where: { id: dto.contaBancariaId, usuario: { fazendas: { some: { fazendaId, papel: 'administrador' } } } },
          select: { id: true },
        });
        if (!conta) throw new ForbiddenException('Conta bancária não encontrada para esta fazenda');
        out.contaBancariaId = conta.id;
      }
    }
    return out;
  }

  // ===== CRUD =====
  async create(dto: CreateFinanceiroDto, usuarioId: string) {
    await this.assertAcessoFazenda(dto.fazendaId, usuarioId);

    if (!dto.data) throw new BadRequestException('Data é obrigatória');
    const dataLanc = new Date(dto.data);
    if (Number.isNaN(dataLanc.getTime())) throw new BadRequestException('Data inválida');

    if (dto.animalId && dto.lavouraId) {
      throw new BadRequestException('Informe apenas animalId ou lavouraId, não os dois');
    }

    if (dto.custoLavouraId) {
      if (dto.tipo !== 'despesa') {
        throw new BadRequestException('Só despesas podem ser alocadas em uma lavoura');
      }
      if (dto.animalId || dto.lavouraId) {
        throw new BadRequestException('Despesa alocada em lavoura não pode ser também uma venda');
      }
    }

    // vendas ganham a categoria automaticamente quando o usuário não escolhe
    const categoria = dto.categoria ?? (dto.animalId ? 'venda_gado' : dto.lavouraId ? 'venda_lavoura' : undefined);
    this.assertCategoriaCompativel(dto.tipo, categoria);
    const fiscal = await this.dadosFiscais(dto, dto.fazendaId);

    const registro = await this.prisma.$transaction(async (tx) => {
      // ===== Despesa alocada em lavoura: a lavoura tem que ser desta fazenda =====
      if (dto.custoLavouraId) {
        const alvo = await tx.lavoura.findFirst({
          where: { id: dto.custoLavouraId, fazendaId: dto.fazendaId },
          select: { id: true },
        });
        if (!alvo) throw new ForbiddenException('Lavoura não pertence a esta fazenda');
      }

      // ===== Venda de gado: dá baixa automática no animal =====
      if (dto.animalId) {
        const animal = await tx.animal.findFirst({
          where: { id: dto.animalId, fazendaId: dto.fazendaId },
          select: { id: true, status: true },
        });
        if (!animal) throw new ForbiddenException('Animal não pertence a esta fazenda');
        if (animal.status !== 'ativo') {
          throw new BadRequestException('Este animal já foi baixado (vendido/morto) anteriormente');
        }

        await tx.animal.update({
          where: { id: animal.id },
          data: { status: 'vendido', dataSaida: dataLanc },
        });
      }

      // ===== Venda de lavoura: subtrai a área vendida da área total =====
      if (dto.lavouraId) {
        if (!dto.areaVendidaHa) {
          throw new BadRequestException('Informe a área vendida (ha)');
        }
        const lavoura = await tx.lavoura.findFirst({
          where: { id: dto.lavouraId, fazendaId: dto.fazendaId },
          select: { id: true, areaHa: true },
        });
        if (!lavoura) throw new ForbiddenException('Lavoura não pertence a esta fazenda');
        if (dto.areaVendidaHa > lavoura.areaHa) {
          throw new BadRequestException(
            `Área vendida (${dto.areaVendidaHa} ha) maior que a área disponível (${lavoura.areaHa} ha)`,
          );
        }

        const novaArea = lavoura.areaHa - dto.areaVendidaHa;
        await tx.lavoura.update({
          where: { id: lavoura.id },
          data: {
            areaHa: novaArea,
            ...(novaArea <= 0 ? { status: 'inativo' as const } : {}),
          },
        });
      }

      return tx.financeiro.create({
        data: {
          fazendaId: dto.fazendaId,
          data: dataLanc,
          descricao: dto.descricao ?? '',
          valor: dto.valor,
          tipo: dto.tipo,
          animalId: dto.animalId ?? null,
          lavouraId: dto.lavouraId ?? null,
          areaVendidaHa: dto.lavouraId ? dto.areaVendidaHa : null,
          categoria: categoria ?? null,
          custoLavouraId: dto.custoLavouraId ?? null,
          ...fiscal,
        },
      });
    });

    await this.safeLog(
      usuarioId,
      `financeiro_criado: id=${registro.id}, tipo=${dto.tipo}, valor=${dto.valor}, desc="${dto.descricao ?? ''}"` +
        (dto.animalId ? ` animal=${dto.animalId}` : '') +
        (dto.lavouraId ? ` lavoura=${dto.lavouraId} areaVendida=${dto.areaVendidaHa}` : ''),
    );

    return registro;
  }

  async findAll(usuarioId: string, query: any = {}) {
    const {
      take = 10,
      skip = 0,
      search,
      inicio, // ISO opcional
      fim,    // ISO opcional
      tipo,   // 'receita' | 'despesa' opcional
      fazendaId, // opcional: restringe a uma fazenda específica
      categoria, // opcional
      custoLavouraId, // opcional: despesas alocadas numa lavoura
      lavouraId,      // opcional: vendas de uma lavoura
    } = query;

    const where: any = {
      fazenda: { usuarios: { some: { usuarioId, papel: { in: PAPEIS_FINANCEIRO } } } },
      ...(fazendaId ? { fazendaId } : {}),
      ...(categoria ? { categoria: String(categoria) } : {}),
      ...(custoLavouraId ? { custoLavouraId: String(custoLavouraId) } : {}),
      ...(lavouraId ? { lavouraId: String(lavouraId) } : {}),
    };

    if (search) {
      where.descricao = { contains: String(search), mode: 'insensitive' };
    }
    if (tipo) {
      where.tipo = tipo;
    }
    if (inicio || fim) {
      where.data = {
        ...(inicio ? { gte: new Date(inicio) } : {}),
        ...(fim ? { lte: new Date(fim) } : {}),
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeiro.findMany({
        where,
        take: Number(take),
        skip: Number(skip),
        orderBy: { data: 'desc' },
      }),
      this.prisma.financeiro.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, usuarioId: string) {
    const financeiro = await this.prisma.financeiro.findFirst({
      where: {
        id,
        fazenda: { usuarios: { some: { usuarioId, papel: { in: PAPEIS_FINANCEIRO } } } },
      },
    });

    if (!financeiro) throw new NotFoundException('Registro não encontrado');
    return financeiro;
  }

  async update(id: string, dto: UpdateFinanceiroDto, usuarioId: string) {
    // valida posse
    const exists = await this.prisma.financeiro.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId, papel: { in: PAPEIS_FINANCEIRO } } } } },
      select: { id: true, compraInsumoId: true, fazendaId: true, tipo: true, custoLavouraId: true },
    });
    if (!exists) throw new ForbiddenException('Acesso negado');

    // Este lançamento é o espelho de uma CompraInsumo. Editar o valor aqui
    // deixaria os dois registros divergentes — a edição tem que passar pela
    // compra (PATCH /compra-insumo/:id), que atualiza os dois na mesma transação.
    // Os dados fiscais (conta, documento, CPF/CNPJ) não afetam o valor: podem.
    if (exists.compraInsumoId) {
      const mexeEmOutros = Object.entries(dto).some(
        ([k, v]) => v !== undefined && k !== 'fazendaId' && !(CAMPOS_FISCAIS as readonly string[]).includes(k),
      );
      if (mexeEmOutros) {
        throw new BadRequestException(
          'Lançamento vinculado a uma compra de insumo. Edite pela compra para manter os valores consistentes.',
        );
      }
    }

    // Alterar o vínculo de venda (animal/lavoura) depois de criado não é suportado:
    // para corrigir, remova o lançamento e crie um novo.
    const tipoFinal = dto.tipo ?? exists.tipo;
    const custoFinal = dto.custoLavouraId !== undefined ? dto.custoLavouraId : exists.custoLavouraId;
    if (custoFinal && tipoFinal !== 'despesa') {
      throw new BadRequestException('Só despesas podem ser alocadas em uma lavoura');
    }
    if (dto.categoria) this.assertCategoriaCompativel(tipoFinal, dto.categoria);
    if (dto.custoLavouraId) {
      const alvo = await this.prisma.lavoura.findFirst({
        where: { id: dto.custoLavouraId, fazendaId: exists.fazendaId },
        select: { id: true },
      });
      if (!alvo) throw new ForbiddenException('Lavoura não pertence a esta fazenda');
    }

    const fiscal = await this.dadosFiscais(dto, exists.fazendaId);

    const dataUpdate: any = {
      ...fiscal,
      ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
      ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
      ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
      // null limpa o campo (desfaz a categoria / a alocação na lavoura)
      ...(dto.categoria !== undefined ? { categoria: dto.categoria ?? null } : {}),
      ...(dto.custoLavouraId !== undefined ? { custoLavouraId: dto.custoLavouraId ?? null } : {}),
    };
    if (dto.data !== undefined) {
      const d = new Date(dto.data);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida');
      dataUpdate.data = d;
    }

    const atualizado = await this.prisma.financeiro.update({
      where: { id },
      data: dataUpdate,
    });

    await this.safeLog(
      usuarioId,
      `financeiro_atualizado: id=${id}, tipo=${atualizado.tipo}, valor=${atualizado.valor}, desc="${atualizado.descricao ?? ''}"`
    );

    return atualizado;
  }

  async remove(id: string, usuarioId: string) {
    // valida posse
    const registro = await this.prisma.financeiro.findFirst({
      where: { id, fazenda: { usuarios: { some: { usuarioId, papel: { in: PAPEIS_FINANCEIRO } } } } },
    });
    if (!registro) throw new ForbiddenException('Acesso negado');

    await this.prisma.$transaction(async (tx) => {
      // Reverte a baixa automática, se houver
      if (registro.animalId) {
        await tx.animal.update({
          where: { id: registro.animalId },
          data: { status: 'ativo', dataSaida: null },
        });
      }
      if (registro.lavouraId && registro.areaVendidaHa) {
        const lavoura = await tx.lavoura.findUnique({
          where: { id: registro.lavouraId },
          select: { areaHa: true },
        });
        if (lavoura) {
          await tx.lavoura.update({
            where: { id: registro.lavouraId },
            data: { areaHa: lavoura.areaHa + registro.areaVendidaHa, status: 'ativo' },
          });
        }
      }

      // se for espelho de compra, a deleção direta é segura: o vínculo é opcional.
      await tx.financeiro.delete({ where: { id } });
    });

    await this.safeLog(usuarioId, `financeiro_excluido: id=${id}, desc="${registro.descricao ?? ''}"`);

    return { message: 'Removido com sucesso' };
  }
}
