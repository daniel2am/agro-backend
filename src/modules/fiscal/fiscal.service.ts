import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PlanoService } from '../plano/plano.service';
import { UFS, apenasDigitos, cpfOuCnpjValido, cpfValido } from 'src/common/utils/documentos';
import { ContaDto, ContribuinteDto, ImovelDto } from './dto/fiscal.dto';

const limpar = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
const vazioParaNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : (v ?? null));

/** Junta os erros de formato numa só mensagem, em vez de falhar um de cada vez. */
function exigir(erros: string[]) {
  if (erros.length) throw new BadRequestException(erros.join(' · '));
}

@Injectable()
export class FiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planos: PlanoService,
  ) {}

  private liberar(usuarioId: string) {
    return this.planos.assertRecurso(usuarioId, 'lcdpr');
  }

  // ---------------------------------------------------------- contribuinte

  async obterContribuinte(usuarioId: string) {
    await this.liberar(usuarioId);
    return this.prisma.contribuinteRural.findUnique({ where: { usuarioId } });
  }

  async salvarContribuinte(usuarioId: string, dto: ContribuinteDto) {
    await this.liberar(usuarioId);
    const erros: string[] = [];
    if (!cpfValido(dto.cpf)) erros.push('CPF inválido');
    if (!(UFS as readonly string[]).includes(dto.uf.toUpperCase())) erros.push('UF inválida');
    if (apenasDigitos(dto.codMunicipio).length !== 7) erros.push('Município inválido (código IBGE de 7 dígitos)');
    if (apenasDigitos(dto.cep).length !== 8) erros.push('CEP deve ter 8 dígitos');
    if (dto.contadorDoc && !cpfOuCnpjValido(dto.contadorDoc)) erros.push('CPF/CNPJ do contador inválido');
    exigir(erros);

    const dados = {
      cpf: apenasDigitos(dto.cpf),
      nome: dto.nome.trim(),
      endereco: dto.endereco.trim(),
      numero: dto.numero.trim(),
      complemento: vazioParaNull(limpar(dto.complemento)) as string | null,
      bairro: dto.bairro.trim(),
      uf: dto.uf.toUpperCase(),
      codMunicipio: apenasDigitos(dto.codMunicipio),
      cep: apenasDigitos(dto.cep),
      telefone: dto.telefone ? apenasDigitos(dto.telefone) || null : null,
      email: dto.email.trim(),
      contadorNome: vazioParaNull(limpar(dto.contadorNome)) as string | null,
      contadorDoc: dto.contadorDoc ? apenasDigitos(dto.contadorDoc) : null,
      contadorCrc: vazioParaNull(limpar(dto.contadorCrc)) as string | null,
      contadorEmail: vazioParaNull(limpar(dto.contadorEmail)) as string | null,
      contadorFone: dto.contadorFone ? apenasDigitos(dto.contadorFone) || null : null,
    };
    return this.prisma.contribuinteRural.upsert({ where: { usuarioId }, create: { usuarioId, ...dados }, update: dados });
  }

  // --------------------------------------------------------------- imóveis

  /** Fazendas que o usuário administra, com os dados fiscais (ou null). */
  async listarImoveis(usuarioId: string) {
    await this.liberar(usuarioId);
    const fazendas = await this.prisma.fazenda.findMany({
      where: { usuarios: { some: { usuarioId, papel: 'administrador' } } },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cidade: true, estado: true, imovelRural: { include: { contrapartes: true } } },
    });
    return fazendas.map((f) => ({ fazendaId: f.id, nome: f.nome, cidade: f.cidade, estado: f.estado, fiscal: f.imovelRural }));
  }

  async salvarImovel(usuarioId: string, fazendaId: string, dto: ImovelDto) {
    await this.liberar(usuarioId);
    const ok = await this.prisma.fazendaUsuario.findFirst({ where: { fazendaId, usuarioId, papel: 'administrador' }, select: { id: true } });
    if (!ok) throw new ForbiddenException('Só o administrador da fazenda edita os dados fiscais');

    const erros: string[] = [];
    if (dto.codItr && apenasDigitos(dto.codItr).length !== 8) erros.push('CAFIR/NIRF deve ter 8 dígitos');
    if (dto.caepf && apenasDigitos(dto.caepf).length !== 14) erros.push('CAEPF deve ter 14 dígitos');
    if (apenasDigitos(dto.cep).length !== 8) erros.push('CEP deve ter 8 dígitos');
    if (apenasDigitos(dto.codMunicipio).length !== 7) erros.push('Município inválido (código IBGE de 7 dígitos)');
    dto.contrapartes.forEach((c, i) => {
      if (!cpfOuCnpjValido(c.documento)) erros.push(`CPF/CNPJ inválido no terceiro ${i + 1}`);
    });
    const soma = dto.contrapartes.reduce((s, c) => s + c.percentual, 0);
    if (dto.participacaoPct + soma > 100.01) erros.push('A sua participação somada à dos terceiros passa de 100%');
    exigir(erros);

    const dados = {
      codItr: dto.codItr ? apenasDigitos(dto.codItr) : null,
      caepf: dto.caepf ? apenasDigitos(dto.caepf) : null,
      inscricaoEstadual: dto.inscricaoEstadual ? apenasDigitos(dto.inscricaoEstadual).slice(0, 14) || null : null,
      endereco: dto.endereco.trim(),
      numero: vazioParaNull(limpar(dto.numero)) as string | null,
      complemento: vazioParaNull(limpar(dto.complemento)) as string | null,
      bairro: dto.bairro.trim(),
      cep: apenasDigitos(dto.cep),
      codMunicipio: apenasDigitos(dto.codMunicipio),
      tipoExploracao: dto.tipoExploracao,
      participacaoPct: dto.participacaoPct,
    };

    return this.prisma.$transaction(async (tx) => {
      const imovel = await tx.imovelRural.upsert({ where: { fazendaId }, create: { fazendaId, ...dados }, update: dados });
      // os terceiros são sempre substituídos pela lista recebida
      await tx.contraparteImovel.deleteMany({ where: { imovelId: imovel.id } });
      if (dto.contrapartes.length) {
        await tx.contraparteImovel.createMany({
          data: dto.contrapartes.map((c) => ({
            imovelId: imovel.id,
            tipo: c.tipo,
            documento: apenasDigitos(c.documento),
            nome: c.nome.trim(),
            percentual: c.percentual,
          })),
        });
      }
      return tx.imovelRural.findUnique({ where: { id: imovel.id }, include: { contrapartes: true } });
    });
  }

  // ---------------------------------------------------------------- contas

  async listarContas(usuarioId: string) {
    await this.liberar(usuarioId);
    return this.prisma.contaBancaria.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' } });
  }

  async criarConta(usuarioId: string, dto: ContaDto) {
    await this.liberar(usuarioId);
    const erros: string[] = [];
    if (apenasDigitos(dto.banco).length !== 3) erros.push('Código do banco deve ter 3 dígitos (ex.: 001, 237, 756)');
    if (apenasDigitos(dto.agencia).length !== 4) erros.push('Agência deve ter 4 dígitos, sem dígito verificador');
    const conta = apenasDigitos(dto.numeroConta);
    if (conta.length < 1 || conta.length > 16) erros.push('Número da conta deve ter até 16 dígitos, com o dígito verificador');
    exigir(erros);
    return this.prisma.contaBancaria.create({
      data: { usuarioId, banco: apenasDigitos(dto.banco), nomeBanco: dto.nomeBanco.trim(), agencia: apenasDigitos(dto.agencia), numeroConta: conta },
    });
  }

  async removerConta(usuarioId: string, id: string) {
    await this.liberar(usuarioId);
    const conta = await this.prisma.contaBancaria.findFirst({ where: { id, usuarioId }, select: { id: true } });
    if (!conta) throw new NotFoundException('Conta não encontrada');
    // lançamentos que usavam a conta voltam a "sem conta" (FK SetNull)
    await this.prisma.contaBancaria.delete({ where: { id } });
    return { removido: true };
  }
}
