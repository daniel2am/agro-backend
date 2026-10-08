import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  DadosDaFazenda, Escopo, MENSAGEM_CONVITE, ROTULO_ESCOPO, decidirPatrocinio, escoposConcedidos, gerarCodigo, gmdMedio,
  limparEscopos, montarCartao, normalizarCodigo, situacaoDoConvite,
} from './parceiro.regras';
import { PlanoTipo } from '../plano/planos';
import { AceitarConviteDto, AdicionarMembroDto, CriarConviteDto, CriarParceiroDto } from './dto/parceiro.dto';

const PAPEL_ADMIN = 'admin';

@Injectable()
export class ParceiroService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- administração

  /** Cria o parceiro e torna admin um usuário que já tem conta (chamado só pela rota administrativa). */
  async criarParceiro(dto: CriarParceiroDto) {
    const u = await this.prisma.usuario.findUnique({ where: { email: dto.emailAdmin.trim().toLowerCase() }, select: { id: true } });
    if (!u) throw new NotFoundException('O administrador precisa ter conta no AgroTotal antes.');
    return this.prisma.parceiro.create({
      data: { nome: dto.nome.trim(), tipo: dto.tipo, membros: { create: { usuarioId: u.id, papel: PAPEL_ADMIN } } },
      select: { id: true, nome: true, tipo: true },
    });
  }

  // ----------------------------------------------------------------- lado do parceiro

  private async membro(parceiroId: string, usuarioId: string) {
    const m = await this.prisma.parceiroMembro.findFirst({
      where: { parceiroId, usuarioId, parceiro: { ativo: true } },
      select: { papel: true },
    });
    if (!m) throw new ForbiddenException('Você não faz parte deste parceiro');
    return m;
  }

  async meusParceiros(usuarioId: string) {
    const ms = await this.prisma.parceiroMembro.findMany({
      where: { usuarioId, parceiro: { ativo: true } },
      select: { papel: true, parceiro: { select: { id: true, nome: true, tipo: true } } },
    });
    return ms.map((m) => ({ ...m.parceiro, papel: m.papel }));
  }

  async adicionarMembro(parceiroId: string, quem: string, dto: AdicionarMembroDto) {
    const m = await this.membro(parceiroId, quem);
    if (m.papel !== PAPEL_ADMIN) throw new ForbiddenException('Só o administrador do parceiro adiciona pessoas');
    const u = await this.prisma.usuario.findUnique({ where: { email: dto.email.trim().toLowerCase() }, select: { id: true } });
    if (!u) throw new NotFoundException('Essa pessoa ainda não tem conta no AgroTotal');
    await this.prisma.parceiroMembro.upsert({
      where: { parceiroId_usuarioId: { parceiroId, usuarioId: u.id } },
      create: { parceiroId, usuarioId: u.id, papel: dto.papel ?? 'representante' },
      update: { papel: dto.papel ?? 'representante' },
    });
    return { ok: true };
  }

  async criarConvite(parceiroId: string, quem: string, dto: CriarConviteDto) {
    await this.membro(parceiroId, quem);
    const escopos = limparEscopos(dto.escopos);
    if (escopos.length === 0) throw new BadRequestException('Escolha ao menos um dado que você quer acompanhar');
    const plano = (dto.plano ?? 'basico') as PlanoTipo;
    const meses = dto.mesesPlano ?? 0;
    if (plano !== 'basico' && meses <= 0) throw new BadRequestException('Informe por quantos meses o plano é patrocinado');

    const validoAte = new Date(Date.now() + (dto.diasValidade ?? 30) * 86_400_000);
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      const codigo = gerarCodigo();
      try {
        return await this.prisma.conviteParceiro.create({
          data: { parceiroId, codigo, nota: dto.nota?.trim() || null, plano, mesesPlano: plano === 'basico' ? 0 : meses, escopos, usosMax: dto.usosMax ?? 1, validoAte, criadoPorId: quem },
          select: { id: true, codigo: true, nota: true, plano: true, mesesPlano: true, escopos: true, usosMax: true, usos: true, validoAte: true },
        });
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e; // colisão de código: sorteia outro
      }
    }
    throw new ConflictException('Não foi possível gerar um código agora. Tente de novo.');
  }

  async listarConvites(parceiroId: string, quem: string) {
    await this.membro(parceiroId, quem);
    return this.prisma.conviteParceiro.findMany({
      where: { parceiroId },
      orderBy: { criadoEm: 'desc' },
      take: 100,
      select: { id: true, codigo: true, nota: true, plano: true, mesesPlano: true, escopos: true, usosMax: true, usos: true, validoAte: true, ativo: true },
    });
  }

  async cancelarConvite(parceiroId: string, quem: string, conviteId: string) {
    await this.membro(parceiroId, quem);
    const r = await this.prisma.conviteParceiro.updateMany({ where: { id: conviteId, parceiroId }, data: { ativo: false } });
    if (r.count === 0) throw new NotFoundException('Convite não encontrado');
    return { ok: true };
  }

  /** A carteira: só vínculos ativos, e cada produtor só com o que autorizou. */
  async carteira(parceiroId: string, quem: string) {
    await this.membro(parceiroId, quem);
    const vinculos = await this.prisma.vinculoParceiro.findMany({
      where: { parceiroId, revogadoEm: null },
      orderBy: { criadoEm: 'desc' },
      take: 500,
      include: {
        fazenda: { select: { id: true, nome: true, cidade: true, estado: true } },
        usuario: { select: { nome: true, email: true } },
        convite: { select: { nota: true, codigo: true } },
      },
    });
    const itens = [];
    for (const v of vinculos) {
      const d = await this.dadosDaFazenda(v.fazenda, v.usuario);
      itens.push({
        vinculoId: v.id,
        // identificação: a anotação que o PRÓPRIO parceiro escreveu no convite. O nome da fazenda
        // só aparece se o produtor autorizou "contato".
        rotulo: v.convite?.nota || v.convite?.codigo || 'Produtor',
        fazenda: limparEscopos(v.escopos).includes('contato') ? v.fazenda.nome : null,
        desde: v.criadoEm,
        planoConcedido: v.planoConcedido,
        planoAteEm: v.planoAteEm,
        escopos: limparEscopos(v.escopos),
        cartao: montarCartao(v.escopos, d),
      });
    }
    return { total: itens.length, itens };
  }

  private async dadosDaFazenda(
    f: { id: string; cidade: string; estado: string },
    u: { nome: string; email: string },
  ): Promise<DadosDaFazenda> {
    const [animais, invernadas, lavouras, pesagens] = await Promise.all([
      this.prisma.animal.count({ where: { fazendaId: f.id, status: 'ativo' } }),
      this.prisma.invernada.findMany({ where: { fazendaId: f.id }, select: { area: true } }),
      this.prisma.lavoura.findMany({ where: { fazendaId: f.id, status: 'ativo' }, select: { areaHa: true } }),
      this.prisma.pesagem.findMany({
        where: { fazendaId: f.id, animal: { status: 'ativo' }, data: { gte: new Date(Date.now() - 365 * 86_400_000) } },
        select: { animalId: true, data: true, pesoKg: true },
      }),
    ]);
    const g = gmdMedio(pesagens);
    return {
      animaisAtivos: animais,
      gmdMedioKgDia: g.gmd,
      animaisAvaliados: g.avaliados,
      areaHa: invernadas.reduce((s, i) => s + i.area, 0) + lavouras.reduce((s, l) => s + l.areaHa, 0),
      invernadas: invernadas.length,
      lavouras: lavouras.length,
      cidade: f.cidade,
      estado: f.estado,
      produtorNome: u.nome,
      produtorEmail: u.email,
    };
  }

  // ----------------------------------------------------------------- lado do produtor

  /** O que o produtor vê antes de aceitar: quem pede, o que pede e o que ganha. */
  async previa(codigoDigitado: string) {
    const codigo = normalizarCodigo(codigoDigitado);
    if (!codigo) throw new BadRequestException('Código inválido. Ele tem 8 letras e números, como K7M2-9QXP.');
    const c = await this.prisma.conviteParceiro.findUnique({
      where: { codigo },
      include: { parceiro: { select: { nome: true, tipo: true, ativo: true } } },
    });
    if (!c || !c.parceiro.ativo) throw new NotFoundException('Convite não encontrado');
    const sit = situacaoDoConvite(c);
    if (sit !== 'ok') throw new BadRequestException(MENSAGEM_CONVITE[sit]);
    return {
      codigo: c.codigo,
      parceiro: { nome: c.parceiro.nome, tipo: c.parceiro.tipo },
      plano: c.plano === 'basico' ? null : { plano: c.plano, meses: c.mesesPlano },
      escopos: limparEscopos(c.escopos).map((e) => ({ chave: e, rotulo: ROTULO_ESCOPO[e] })),
    };
  }

  async aceitar(codigoDigitado: string, usuarioId: string, dto: AceitarConviteDto) {
    const codigo = normalizarCodigo(codigoDigitado);
    if (!codigo) throw new BadRequestException('Código inválido');

    // só o administrador da fazenda consente em nome dela
    const adm = await this.prisma.fazendaUsuario.findFirst({ where: { fazendaId: dto.fazendaId, usuarioId, papel: 'administrador' }, select: { id: true } });
    if (!adm) throw new ForbiddenException('Só o administrador da fazenda pode autorizar o compartilhamento');

    return this.prisma.$transaction(async (tx) => {
      const c = await tx.conviteParceiro.findUnique({ where: { codigo }, include: { parceiro: { select: { ativo: true, nome: true } } } });
      if (!c || !c.parceiro.ativo) throw new NotFoundException('Convite não encontrado');
      const sit = situacaoDoConvite(c);
      if (sit !== 'ok') throw new BadRequestException(MENSAGEM_CONVITE[sit]);

      const pedidos = limparEscopos(c.escopos);
      const concedidos = escoposConcedidos(pedidos, dto.escopos);
      if (concedidos.length === 0) throw new BadRequestException('Autorize ao menos um dado para aceitar o convite');

      const existente = await tx.vinculoParceiro.findUnique({ where: { parceiroId_fazendaId: { parceiroId: c.parceiroId, fazendaId: dto.fazendaId } } });
      if (existente && !existente.revogadoEm) throw new ConflictException('Esta fazenda já está vinculada a este parceiro');

      // consumo atômico do uso: dois aceites simultâneos não passam do limite
      const uso = await tx.conviteParceiro.updateMany({ where: { id: c.id, usos: { lt: c.usosMax } }, data: { usos: { increment: 1 } } });
      if (uso.count === 0) throw new BadRequestException(MENSAGEM_CONVITE.esgotado);

      // patrocínio de plano (nunca rebaixa)
      const u = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { plano: true, planoAteEm: true } });
      const decisao = decidirPatrocinio({ plano: u!.plano as PlanoTipo, planoAteEm: u!.planoAteEm }, { plano: c.plano as PlanoTipo, meses: c.mesesPlano });
      if (decisao.conceder) {
        await tx.usuario.update({ where: { id: usuarioId }, data: { plano: decisao.plano!, planoAteEm: decisao.ateEm! } });
      }

      const dados = {
        usuarioId, conviteId: c.id, escopos: concedidos, revogadoEm: null,
        planoConcedido: decisao.conceder ? decisao.plano! : null, planoAteEm: decisao.conceder ? decisao.ateEm! : null,
      };
      const v = existente
        ? await tx.vinculoParceiro.update({ where: { id: existente.id }, data: dados })
        : await tx.vinculoParceiro.create({ data: { parceiroId: c.parceiroId, fazendaId: dto.fazendaId, ...dados } });

      return { vinculoId: v.id, parceiro: c.parceiro.nome, escopos: concedidos, plano: decisao.conceder ? { plano: decisao.plano, ateEm: decisao.ateEm } : null, motivoPlano: decisao.motivo };
    });
  }

  /** Vínculos das fazendas que o usuário administra. */
  async meusVinculos(usuarioId: string) {
    const vs = await this.prisma.vinculoParceiro.findMany({
      where: { revogadoEm: null, fazenda: { usuarios: { some: { usuarioId, papel: 'administrador' } } } },
      orderBy: { criadoEm: 'desc' },
      include: { parceiro: { select: { nome: true, tipo: true } }, fazenda: { select: { nome: true } } },
    });
    return vs.map((v) => ({
      id: v.id, parceiro: v.parceiro.nome, tipo: v.parceiro.tipo, fazenda: v.fazenda.nome, desde: v.criadoEm,
      escopos: limparEscopos(v.escopos).map((e: Escopo) => ({ chave: e, rotulo: ROTULO_ESCOPO[e] })),
      planoConcedido: v.planoConcedido, planoAteEm: v.planoAteEm,
    }));
  }

  /**
   * Revoga o compartilhamento. O parceiro deixa de ver os dados na hora. O plano
   * patrocinado NÃO é retirado: o produtor não é punido por proteger seus dados.
   */
  async revogar(vinculoId: string, usuarioId: string) {
    const r = await this.prisma.vinculoParceiro.updateMany({
      where: { id: vinculoId, revogadoEm: null, fazenda: { usuarios: { some: { usuarioId, papel: 'administrador' } } } },
      data: { revogadoEm: new Date() },
    });
    if (r.count === 0) throw new NotFoundException('Vínculo não encontrado');
    return { revogado: true };
  }
}
