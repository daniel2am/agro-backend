// src/modules/plano/plano.service.ts
import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PapelUsuarioFazenda } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import {
  DEFINICOES,
  PlanoTipo,
  Recurso,
  RecursoContavel,
  ehIlimitado,
  mensagemLimite,
  menorPlanoComRecurso,
  planoEmVigor,
  proximoPlano,
  temRecurso,
  verificarLimite,
} from './planos';

export interface UsoDoPlano {
  fazendas: number;
  areas: number;
  animais: number;
}

/** Corpo do erro 402: o app usa `code` para abrir a tela de upgrade. */
export function erroDePlano(plano: PlanoTipo, recurso: RecursoContavel, limite: number, usado: number) {
  return new HttpException(
    {
      statusCode: HttpStatus.PAYMENT_REQUIRED,
      code: 'PLANO_LIMITE',
      recurso,
      plano,
      limite,
      usado,
      sugerido: proximoPlano(plano),
      message: mensagemLimite(plano, recurso, limite),
    },
    HttpStatus.PAYMENT_REQUIRED,
  );
}

export function erroDeRecurso(plano: PlanoTipo, recurso: Recurso) {
  const necessario = menorPlanoComRecurso(recurso);
  return new HttpException(
    {
      statusCode: HttpStatus.PAYMENT_REQUIRED,
      code: 'PLANO_RECURSO',
      recurso,
      plano,
      sugerido: necessario,
      message: `Este recurso faz parte do plano ${DEFINICOES[necessario].nome}.`,
    },
    HttpStatus.PAYMENT_REQUIRED,
  );
}

@Injectable()
export class PlanoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Plano em vigor do usuário (vencido = básico). */
  async planoDoUsuario(usuarioId: string): Promise<PlanoTipo> {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { plano: true, planoAteEm: true },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return planoEmVigor(u.plano as PlanoTipo, u.planoAteEm);
  }

  /** Quem paga pela fazenda: o administrador mais antigo (normalmente quem a criou). */
  async donoDaFazenda(fazendaId: string): Promise<string> {
    const dono = await this.prisma.fazendaUsuario.findFirst({
      where: { fazendaId, papel: PapelUsuarioFazenda.administrador },
      orderBy: { criadoEm: 'asc' },
      select: { usuarioId: true },
    });
    if (!dono) throw new NotFoundException('Fazenda sem administrador');
    return dono.usuarioId;
  }

  /** O que o usuário já consome, somando todas as fazendas que ele administra. */
  async usoDoUsuario(usuarioId: string): Promise<UsoDoPlano> {
    const fazendaWhere = { usuarios: { some: { usuarioId, papel: PapelUsuarioFazenda.administrador } } };
    const [fazendas, invernadas, lavouras, animais] = await Promise.all([
      this.prisma.fazendaUsuario.count({ where: { usuarioId, papel: PapelUsuarioFazenda.administrador } }),
      this.prisma.invernada.count({ where: { fazenda: fazendaWhere } }),
      this.prisma.lavoura.count({ where: { fazenda: fazendaWhere, status: 'ativo' } }),
      this.prisma.animal.count({ where: { fazenda: fazendaWhere, status: 'ativo' } }),
    ]);
    return { fazendas, areas: invernadas + lavouras, animais };
  }

  /**
   * Lança 402 se criar mais `adicionar` itens de `recurso` estouraria o plano do
   * dono. Para `membros`, `usadoOverride` traz a contagem da fazenda (não do dono).
   */
  async assertLimite(
    donoId: string,
    recurso: RecursoContavel,
    adicionar = 1,
    usadoOverride?: number,
  ): Promise<void> {
    const plano = await this.planoDoUsuario(donoId);
    const usado = usadoOverride ?? (await this.usoDoUsuario(donoId))[recurso as keyof UsoDoPlano] ?? 0;
    const r = verificarLimite(plano, recurso, usado, adicionar);
    if (!r.permitido) throw erroDePlano(plano, recurso, r.limite, usado);
  }

  async assertLimiteDaFazenda(fazendaId: string, recurso: RecursoContavel, adicionar = 1): Promise<void> {
    await this.assertLimite(await this.donoDaFazenda(fazendaId), recurso, adicionar);
  }

  async assertRecurso(donoId: string, recurso: Recurso): Promise<void> {
    const plano = await this.planoDoUsuario(donoId);
    if (!temRecurso(plano, recurso)) throw erroDeRecurso(plano, recurso);
  }

  async assertRecursoDaFazenda(fazendaId: string, recurso: Recurso): Promise<void> {
    await this.assertRecurso(await this.donoDaFazenda(fazendaId), recurso);
  }

  /** Tudo o que o app precisa para mostrar plano, uso, limites e o que está bloqueado. */
  async resumo(usuarioId: string, fazendaId?: string) {
    // Dentro de uma fazenda, vale o plano de QUEM PAGA por ela (o administrador):
    // um colaborador convidado enxerga os recursos do dono, não os da própria conta.
    let alvoId = usuarioId;
    let daFazenda = false;
    if (fazendaId) {
      const vinculo = await this.prisma.fazendaUsuario.findFirst({ where: { fazendaId, usuarioId }, select: { id: true } });
      if (vinculo) {
        alvoId = await this.donoDaFazenda(fazendaId);
        daFazenda = alvoId !== usuarioId;
      }
    }

    const u = await this.prisma.usuario.findUnique({
      where: { id: alvoId },
      select: { plano: true, planoAteEm: true },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');

    const atual = planoEmVigor(u.plano as PlanoTipo, u.planoAteEm);
    const def = DEFINICOES[atual];
    const uso = await this.usoDoUsuario(alvoId);
    const diasRestantes =
      u.planoAteEm && atual !== 'basico'
        ? Math.max(0, Math.ceil((u.planoAteEm.getTime() - Date.now()) / 86_400_000))
        : null;

    const lim = (k: keyof UsoDoPlano) => {
      const limite = def.limites[k];
      return { usado: uso[k], limite: ehIlimitado(limite) ? null : limite };
    };

    return {
      plano: atual,
      daFazenda, // true = plano herdado do dono da fazenda
      contratado: u.plano,
      nome: def.nome,
      venceEm: u.planoAteEm,
      diasRestantes,
      expirou: u.plano !== 'basico' && atual === 'basico',
      emTeste: diasRestantes !== null,
      limites: { fazendas: lim('fazendas'), areas: lim('areas'), animais: lim('animais'), membros: { usado: null, limite: ehIlimitado(def.limites.membros) ? null : def.limites.membros } },
      recursos: def.recursos,
      planos: Object.values(DEFINICOES).map((d) => ({
        tipo: d.tipo,
        nome: d.nome,
        resumo: d.resumo,
        precoMensal: d.precoMensal,
        limites: {
          fazendas: ehIlimitado(d.limites.fazendas) ? null : d.limites.fazendas,
          areas: ehIlimitado(d.limites.areas) ? null : d.limites.areas,
          animais: ehIlimitado(d.limites.animais) ? null : d.limites.animais,
          membros: ehIlimitado(d.limites.membros) ? null : d.limites.membros,
        },
        recursos: d.recursos,
      })),
    };
  }

  /** Administração (chamada só pelo AdminPlanoController): define plano e vencimento. */
  async definirPlano(email: string, plano: PlanoTipo, ateEm: Date | null) {
    const u = await this.prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return this.prisma.usuario.update({
      where: { id: u.id },
      data: { plano, planoAteEm: plano === 'basico' ? null : ateEm },
      select: { id: true, email: true, plano: true, planoAteEm: true },
    });
  }

  /** Teste gratuito de novos cadastros (TRIAL_DIAS; 0 desliga). */
  static dadosDoTeste(env: NodeJS.ProcessEnv = process.env, agora: Date = new Date()) {
    const dias = Number(env.TRIAL_DIAS ?? 14);
    if (!Number.isFinite(dias) || dias <= 0) return {};
    return { plano: 'avancado' as const, planoAteEm: new Date(agora.getTime() + dias * 86_400_000) };
  }
}

