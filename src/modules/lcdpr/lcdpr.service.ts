import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PlanoService } from '../plano/plano.service';
import { EntradaLcdpr, SaidaLcdpr, gerarLcdpr } from './lcdpr.gerador';

export function lerAnoLcdpr(v: string | undefined, hoje = new Date()): number {
  const ano = v ? Number(v) : hoje.getFullYear() - 1; // o LCDPR costuma ser do ano anterior
  if (!Number.isInteger(ano) || ano < 2019 || ano > hoje.getFullYear() + 1) {
    throw new BadRequestException('Ano inválido (o LCDPR vale a partir de 2019)');
  }
  return ano;
}

@Injectable()
export class LcdprService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planos: PlanoService,
  ) {}

  private async montarEntrada(usuarioId: string, ano: number): Promise<EntradaLcdpr> {
    await this.planos.assertRecurso(usuarioId, 'lcdpr');

    const [contribuinte, fazendas, contas] = await Promise.all([
      this.prisma.contribuinteRural.findUnique({ where: { usuarioId } }),
      // o LCDPR é do produtor: entram as fazendas que ele ADMINISTRA
      this.prisma.fazenda.findMany({
        where: { usuarios: { some: { usuarioId, papel: 'administrador' } } },
        orderBy: { criadoEm: 'asc' },
        select: { id: true, nome: true, estado: true, imovelRural: { include: { contrapartes: true } } },
      }),
      this.prisma.contaBancaria.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' } }),
    ]);

    const lancamentos = fazendas.length
      ? await this.prisma.financeiro.findMany({
          where: {
            fazendaId: { in: fazendas.map((f) => f.id) },
            // folga de um dia para cada lado: o corte exato é feito no fuso de Brasília
            data: { gte: new Date(Date.UTC(ano - 1, 11, 31)), lt: new Date(Date.UTC(ano + 1, 0, 2)) },
          },
          orderBy: [{ data: 'asc' }, { criadoEm: 'asc' }],
          select: {
            id: true, fazendaId: true, data: true, descricao: true, valor: true, tipo: true, categoria: true,
            contaBancariaId: true, documentoTipo: true, documentoNumero: true, contraparteDoc: true,
          },
        })
      : [];

    return {
      ano,
      contribuinte: contribuinte && {
        cpf: contribuinte.cpf,
        nome: contribuinte.nome,
        endereco: contribuinte.endereco,
        numero: contribuinte.numero,
        complemento: contribuinte.complemento,
        bairro: contribuinte.bairro,
        uf: contribuinte.uf,
        codMunicipio: contribuinte.codMunicipio,
        cep: contribuinte.cep,
        telefone: contribuinte.telefone,
        email: contribuinte.email,
        contador: {
          nome: contribuinte.contadorNome,
          doc: contribuinte.contadorDoc,
          crc: contribuinte.contadorCrc,
          email: contribuinte.contadorEmail,
          fone: contribuinte.contadorFone,
        },
      },
      imoveis: fazendas.map((f) => ({
        fazendaId: f.id,
        nomeFazenda: f.nome,
        uf: f.estado,
        fiscal: f.imovelRural && {
          codItr: f.imovelRural.codItr,
          caepf: f.imovelRural.caepf,
          inscricaoEstadual: f.imovelRural.inscricaoEstadual,
          endereco: f.imovelRural.endereco,
          numero: f.imovelRural.numero,
          complemento: f.imovelRural.complemento,
          bairro: f.imovelRural.bairro,
          cep: f.imovelRural.cep,
          codMunicipio: f.imovelRural.codMunicipio,
          tipoExploracao: f.imovelRural.tipoExploracao,
          participacaoPct: f.imovelRural.participacaoPct,
          contrapartes: f.imovelRural.contrapartes.map((c) => ({ tipo: c.tipo, documento: c.documento, nome: c.nome, percentual: c.percentual })),
        },
      })),
      contas: contas.map((c) => ({ id: c.id, banco: c.banco, nomeBanco: c.nomeBanco, agencia: c.agencia, numeroConta: c.numeroConta })),
      lancamentos: lancamentos.map((l) => ({
        id: l.id, fazendaId: l.fazendaId, data: l.data, descricao: l.descricao, valor: l.valor,
        tipo: l.tipo, categoria: l.categoria, contaBancariaId: l.contaBancariaId, documentoTipo: l.documentoTipo,
        documentoNumero: l.documentoNumero, contraparteDoc: l.contraparteDoc,
      })),
    };
  }

  /** Checagem: o que falta para gerar, sem devolver o arquivo. */
  async verificar(usuarioId: string, ano: number): Promise<Omit<SaidaLcdpr, 'texto'>> {
    const { texto: _texto, ...resto } = gerarLcdpr(await this.montarEntrada(usuarioId, ano));
    return resto;
  }

  async gerar(usuarioId: string, ano: number): Promise<SaidaLcdpr> {
    return gerarLcdpr(await this.montarEntrada(usuarioId, ano));
  }
}
