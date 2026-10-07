// src/modules/equipe/equipe.service.ts
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PapelUsuarioFazenda } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { PlanoService } from '../plano/plano.service';

/** Papéis que podem ser concedidos por convite (administrador é só o dono). */
export const PAPEIS_CONVIDAVEIS: PapelUsuarioFazenda[] = ['gestor', 'colaborador'];

/** Quem enxerga o financeiro. Colaborador não. */
export const PAPEIS_FINANCEIRO: PapelUsuarioFazenda[] = ['administrador', 'gestor'];

export const normalizarEmail = (e: string) => (e ?? '').trim().toLowerCase();

@Injectable()
export class EquipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planos: PlanoService,
  ) {}

  private async papelDe(fazendaId: string, usuarioId: string): Promise<PapelUsuarioFazenda | null> {
    const v = await this.prisma.fazendaUsuario.findFirst({
      where: { fazendaId, usuarioId },
      select: { papel: true },
    });
    return v?.papel ?? null;
  }

  private async assertAdmin(fazendaId: string, usuarioId: string) {
    const papel = await this.papelDe(fazendaId, usuarioId);
    if (!papel) throw new ForbiddenException('Acesso negado à fazenda');
    if (papel !== 'administrador') throw new ForbiddenException('Só o administrador gerencia a equipe');
  }

  /** Meu papel + (para administrador/gestor) a lista de pessoas e convites pendentes. */
  async listar(fazendaId: string, usuarioId: string) {
    const meuPapel = await this.papelDe(fazendaId, usuarioId);
    if (!meuPapel) throw new ForbiddenException('Acesso negado à fazenda');
    if (meuPapel === 'colaborador') return { meuPapel, membros: [], convites: [] };

    const [membros, convites] = await Promise.all([
      this.prisma.fazendaUsuario.findMany({
        where: { fazendaId },
        orderBy: { criadoEm: 'asc' },
        select: { usuarioId: true, papel: true, criadoEm: true, usuario: { select: { nome: true, email: true } } },
      }),
      this.prisma.conviteFazenda.findMany({
        where: { fazendaId },
        orderBy: { criadoEm: 'asc' },
        select: { id: true, email: true, papel: true, criadoEm: true },
      }),
    ]);

    return {
      meuPapel,
      membros: membros.map((m) => ({
        usuarioId: m.usuarioId,
        nome: m.usuario.nome,
        email: m.usuario.email,
        papel: m.papel,
        desde: m.criadoEm,
        voce: m.usuarioId === usuarioId,
      })),
      convites: meuPapel === 'administrador' ? convites : [],
    };
  }

  async convidar(fazendaId: string, usuarioId: string, emailBruto: string, papel: PapelUsuarioFazenda) {
    await this.assertAdmin(fazendaId, usuarioId);
    if (!PAPEIS_CONVIDAVEIS.includes(papel)) {
      throw new BadRequestException('Convide como gestor ou colaborador');
    }
    const email = normalizarEmail(emailBruto);

    // plano: o recurso "equipe" e o nº de pessoas (membros + convites pendentes)
    await this.planos.assertRecursoDaFazenda(fazendaId, 'equipe');
    const [qtdMembros, qtdConvites] = await Promise.all([
      this.prisma.fazendaUsuario.count({ where: { fazendaId } }),
      this.prisma.conviteFazenda.count({ where: { fazendaId } }),
    ]);
    const dono = await this.planos.donoDaFazenda(fazendaId);

    const existente = await this.prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (existente) {
      const jaMembro = await this.papelDe(fazendaId, existente.id);
      if (jaMembro) throw new ConflictException('Essa pessoa já faz parte da fazenda');
    } else {
      const jaConvidado = await this.prisma.conviteFazenda.findUnique({
        where: { fazendaId_email: { fazendaId, email } },
        select: { id: true },
      });
      if (jaConvidado) throw new ConflictException('Essa pessoa já foi convidada');
    }
    await this.planos.assertLimite(dono, 'membros', 1, qtdMembros + qtdConvites);

    if (existente) {
      await this.prisma.fazendaUsuario.create({ data: { fazendaId, usuarioId: existente.id, papel } });
      return { resultado: 'adicionado' as const, email, papel };
    }
    await this.prisma.conviteFazenda.create({ data: { fazendaId, email, papel, convidadoPorId: usuarioId } });
    return { resultado: 'convite_pendente' as const, email, papel };
  }

  async alterarPapel(fazendaId: string, usuarioId: string, alvoId: string, papel: PapelUsuarioFazenda) {
    await this.assertAdmin(fazendaId, usuarioId);
    if (!PAPEIS_CONVIDAVEIS.includes(papel)) throw new BadRequestException('Papel inválido');

    const alvo = await this.papelDe(fazendaId, alvoId);
    if (!alvo) throw new NotFoundException('Pessoa não encontrada na equipe');
    if (alvo === 'administrador') throw new BadRequestException('O administrador não pode ter o papel alterado');

    await this.prisma.fazendaUsuario.updateMany({ where: { fazendaId, usuarioId: alvoId }, data: { papel } });
    return { ok: true };
  }

  /** Remove uma pessoa. O administrador não pode ser removido; qualquer um pode sair. */
  async remover(fazendaId: string, usuarioId: string, alvoId: string) {
    const alvo = await this.papelDe(fazendaId, alvoId);
    if (!alvo) throw new NotFoundException('Pessoa não encontrada na equipe');
    if (alvo === 'administrador') throw new BadRequestException('O administrador não pode ser removido');

    if (alvoId !== usuarioId) await this.assertAdmin(fazendaId, usuarioId); // sair da equipe é livre
    await this.prisma.fazendaUsuario.deleteMany({ where: { fazendaId, usuarioId: alvoId } });
    return { ok: true };
  }

  async cancelarConvite(fazendaId: string, usuarioId: string, conviteId: string) {
    await this.assertAdmin(fazendaId, usuarioId);
    const r = await this.prisma.conviteFazenda.deleteMany({ where: { id: conviteId, fazendaId } });
    if (r.count === 0) throw new NotFoundException('Convite não encontrado');
    return { ok: true };
  }

  /**
   * Chamado quando alguém cria conta: transforma os convites feitos para o e-mail
   * dela em vínculos reais. Roda numa transação para não perder convite no meio.
   */
  async aceitarConvitesPendentes(usuarioId: string, emailBruto: string): Promise<number> {
    const email = normalizarEmail(emailBruto);
    const convites = await this.prisma.conviteFazenda.findMany({ where: { email } });
    if (convites.length === 0) return 0;

    await this.prisma.$transaction([
      ...convites.map((c) =>
        this.prisma.fazendaUsuario.create({ data: { fazendaId: c.fazendaId, usuarioId, papel: c.papel } }),
      ),
      this.prisma.conviteFazenda.deleteMany({ where: { email } }),
    ]);
    return convites.length;
  }
}
