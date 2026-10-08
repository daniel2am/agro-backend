import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from 'src/prisma.service';
import { PlanoService } from '../plano/plano.service';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { ChuvaService } from '../chuva/chuva.service';
import { PesagemService } from '../pesagem/pesagem.service';
import { PAPEIS_FINANCEIRO } from '../equipe/equipe.service';
import {
  Comando, MENSAGEM_NAO_ENTENDI, TEXTO_AJUDA, hojeEmBrasilia, interpretarTexto, moedaBR, resumoDoComando, semAcento, validarComando,
} from './whatsapp.comandos';
import { MensagemEntrada, chaveTelefone, telefoneBonito } from './whatsapp.webhook';
import { ClienteWhatsapp, WHATSAPP_CLIENTE } from './whatsapp.cliente';
import { INTERPRETADOR, Interpretador, TRANSCRITOR, Transcritor } from './whatsapp.ia';

const MINUTOS_CODIGO = 15;
const MINUTOS_PENDENTE = 15;
const LIMITE_MENSAGENS_10MIN = 40;

const SIM = ['sim', 's', 'ok', 'confirmo', 'confirmar', 'confirma', 'isso', 'pode', 'pode ser', '1', 'yes'];
const NAO = ['nao', 'n', 'cancela', 'cancelar', 'cancele', 'errado', 'deixa', '2', 'no'];

const norm = (s: string) => semAcento(s).toLowerCase().replace(/[!.,]/g, '').replace(/\s+/g, ' ').trim();

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planos: PlanoService,
    private readonly financeiro: FinanceiroService,
    private readonly chuva: ChuvaService,
    private readonly pesagem: PesagemService,
    @Inject(WHATSAPP_CLIENTE) private readonly cliente: ClienteWhatsapp,
    @Inject(INTERPRETADOR) private readonly ia: Interpretador,
    @Inject(TRANSCRITOR) private readonly stt: Transcritor,
  ) {}

  // ------------------------------------------------------ vínculo (app → servidor)

  /** Gera o código que o produtor manda do WhatsApp para vincular o número. */
  async gerarCodigo(usuarioId: string) {
    await this.planos.assertRecurso(usuarioId, 'whatsapp');
    await this.prisma.whatsappCodigo.deleteMany({ where: { usuarioId } });
    let codigo = '';
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      codigo = String(randomInt(100000, 1000000));
      const existe = await this.prisma.whatsappCodigo.findUnique({ where: { codigo }, select: { id: true } });
      if (!existe) break;
    }
    const expiraEm = new Date(Date.now() + MINUTOS_CODIGO * 60_000);
    await this.prisma.whatsappCodigo.create({ data: { usuarioId, codigo, expiraEm } });
    const numero = (process.env.WHATSAPP_NUMERO_EXIBICAO ?? '').replace(/\D/g, '');
    return {
      codigo,
      expiraEm,
      numero: numero || null,
      link: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(codigo)}` : null,
    };
  }

  async situacao(usuarioId: string) {
    const v = await this.prisma.whatsappVinculo.findUnique({ where: { usuarioId } });
    return {
      configurado: this.cliente.configurado(),
      iaDisponivel: this.ia.disponivel(),
      audioDisponivel: this.stt.disponivel(),
      numero: (process.env.WHATSAPP_NUMERO_EXIBICAO ?? '').replace(/\D/g, '') || null,
      vinculado: !!v,
      telefone: v?.telefoneExibicao ?? null,
      fazendaPadraoId: v?.fazendaPadraoId ?? null,
    };
  }

  async desvincular(usuarioId: string) {
    await this.prisma.whatsappPendente.deleteMany({ where: { usuarioId } });
    await this.prisma.whatsappVinculo.deleteMany({ where: { usuarioId } });
    return { removido: true };
  }

  // -------------------------------------------------- mensagens (WhatsApp → servidor)

  async processar(msg: MensagemEntrada): Promise<void> {
    const esperado = process.env.WHATSAPP_PHONE_ID;
    if (esperado && msg.numeroComercialId && msg.numeroComercialId !== esperado) return; // mensagem de outro número comercial

    const chave = chaveTelefone(msg.de);
    // idempotência: a Meta reenvia o webhook se demorarmos
    try {
      await this.prisma.whatsappMensagem.create({ data: { id: msg.id, telefone: chave } });
    } catch (e: any) {
      if (e?.code === 'P2002') return;
      throw e;
    }
    void this.limparAntigos();

    const recentes = await this.prisma.whatsappMensagem.count({ where: { telefone: chave, recebidoEm: { gte: new Date(Date.now() - 10 * 60_000) } } });
    if (recentes > LIMITE_MENSAGENS_10MIN) {
      if (recentes === LIMITE_MENSAGENS_10MIN + 1) await this.responder(msg.de, 'Muitas mensagens em pouco tempo. Aguarde alguns minutos e tente de novo.');
      return;
    }

    const vinculo = await this.prisma.whatsappVinculo.findUnique({ where: { telefone: chave } });
    if (!vinculo) return this.tentarVincular(msg, chave);

    try {
      await this.planos.assertRecurso(vinculo.usuarioId, 'whatsapp');
    } catch {
      return this.responder(msg.de, 'O lançamento por WhatsApp faz parte do plano Produtor. Veja as opções em Mais → Planos no app.');
    }

    try {
      if (msg.tipo === 'botao') return await this.tratarBotao(vinculo, msg);
      if (msg.tipo === 'audio') return await this.tratarAudio(vinculo, msg);
      if (msg.tipo === 'texto') return await this.tratarTexto(vinculo, msg.de, msg.texto ?? '');
      return await this.responder(msg.de, 'Por enquanto só entendo texto e áudio. Mande "ajuda" para ver o que dá para fazer.');
    } catch (e) {
      // o corpo da mensagem nunca vai para o log
      this.logger.error(`Falha ao processar mensagem ${msg.id}: ${(e as Error).message}`);
      await this.responder(msg.de, 'Tive um problema aqui e não consegui registrar. Tente de novo em instantes.');
    }
  }

  private async limparAntigos() {
    try {
      const ontem = new Date(Date.now() - 24 * 3_600_000);
      await this.prisma.whatsappMensagem.deleteMany({ where: { recebidoEm: { lt: ontem } } });
      // pendente vencido fica 1 h: quem responde "sim" atrasado ouve "venceu", não "nada pendente"
      await this.prisma.whatsappPendente.deleteMany({ where: { expiraEm: { lt: new Date(Date.now() - 3_600_000) } } });
      await this.prisma.whatsappCodigo.deleteMany({ where: { expiraEm: { lt: new Date() } } });
    } catch {
      // limpeza é oportunista: não derruba o atendimento
    }
  }

  private responder(para: string, texto: string) {
    return this.cliente.enviarTexto(para, texto).then(() => undefined);
  }

  // ------------------------------------------------------------------ vincular

  private async tentarVincular(msg: MensagemEntrada, chave: string) {
    const codigo = msg.tipo === 'texto' ? /\b(\d{6})\b/.exec(msg.texto ?? '')?.[1] : undefined;
    if (!codigo) {
      return this.responder(
        msg.de,
        'Olá! 🌾 Este número ainda não está vinculado ao AgroTotal.\nNo app, abra Mais → WhatsApp, toque em "Vincular" e envie aqui o código de 6 dígitos.',
      );
    }
    const c = await this.prisma.whatsappCodigo.findUnique({ where: { codigo } });
    if (!c || c.expiraEm.getTime() < Date.now()) {
      return this.responder(msg.de, 'Código inválido ou vencido. Gere um novo em Mais → WhatsApp no app.');
    }
    const jaTem = await this.prisma.whatsappVinculo.findFirst({ where: { OR: [{ telefone: chave }, { usuarioId: c.usuarioId }] } });
    if (jaTem) {
      return this.responder(msg.de, 'Esta conta ou este número já tem um WhatsApp vinculado. Desvincule antes, em Mais → WhatsApp.');
    }
    await this.prisma.$transaction([
      this.prisma.whatsappVinculo.create({ data: { usuarioId: c.usuarioId, telefone: chave, telefoneExibicao: telefoneBonito(msg.de) } }),
      this.prisma.whatsappCodigo.delete({ where: { id: c.id } }),
    ]);
    await this.responder(msg.de, `✅ WhatsApp vinculado!\n\n${TEXTO_AJUDA}`);
  }

  // ------------------------------------------------------------------- fazendas

  private async fazendasDoUsuario(usuarioId: string) {
    const vs = await this.prisma.fazendaUsuario.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'asc' },
      select: { papel: true, fazenda: { select: { id: true, nome: true } } },
    });
    return vs.map((v) => ({ id: v.fazenda.id, nome: v.fazenda.nome, papel: v.papel }));
  }

  private async fazendaAtiva(vinculo: { usuarioId: string; fazendaPadraoId: string | null }) {
    const lista = await this.fazendasDoUsuario(vinculo.usuarioId);
    return lista.find((f) => f.id === vinculo.fazendaPadraoId) ?? lista[0] ?? null;
  }

  // ---------------------------------------------------------------------- texto

  private async tratarTexto(vinculo: { id: string; usuarioId: string; telefone: string; fazendaPadraoId: string | null }, de: string, texto: string) {
    const t = norm(texto);
    if (SIM.includes(t)) return this.decidirUltimo(vinculo, de, true);
    if (NAO.includes(t)) return this.decidirUltimo(vinculo, de, false);

    const hoje = hojeEmBrasilia();
    const r = interpretarTexto(texto, hoje);
    let comando: Comando | null = 'comando' in r ? r.comando : null;

    if (!comando && 'erro' in r && r.erro === 'nao_entendi' && texto.length <= 500 && this.ia.disponivel()) {
      comando = validarComando(await this.ia.interpretar(texto, hoje), hoje);
    }
    if (!comando) {
      const dica = 'erro' in r ? r.dica : undefined;
      return this.responder(de, dica ?? MENSAGEM_NAO_ENTENDI);
    }

    switch (comando.tipo) {
      case 'ajuda':
        return this.responder(de, TEXTO_AJUDA);
      case 'resumo':
        return this.responderResumo(vinculo, de);
      case 'fazenda':
        return this.trocarFazenda(vinculo, de, comando.nome);
      default:
        return this.pedirConfirmacao(vinculo, de, comando);
    }
  }

  private async pedirConfirmacao(vinculo: { usuarioId: string; telefone: string; fazendaPadraoId: string | null }, de: string, comando: Comando) {
    const fazenda = await this.fazendaAtiva(vinculo);
    if (!fazenda) return this.responder(de, 'Você ainda não tem fazenda no AgroTotal. Cadastre uma no app para começar.');

    // só vale um registro pendente por vez
    await this.prisma.whatsappPendente.deleteMany({ where: { telefone: vinculo.telefone } });
    const resumo = resumoDoComando(comando, fazenda.nome);
    const p = await this.prisma.whatsappPendente.create({
      data: {
        usuarioId: vinculo.usuarioId,
        telefone: vinculo.telefone,
        fazendaId: fazenda.id,
        comando: comando as any,
        resumo,
        expiraEm: new Date(Date.now() + MINUTOS_PENDENTE * 60_000),
      },
    });
    const ok = await this.cliente.enviarBotoes(de, `${resumo}\n\nPosso registrar?`, [
      { id: `c:${p.id}`, titulo: 'Confirmar' },
      { id: `x:${p.id}`, titulo: 'Cancelar' },
    ]);
    // se os botões falharem (ex.: fora da janela de 24 h), cai para texto com "sim/não"
    if (!ok) await this.responder(de, `${resumo}\n\nResponda *sim* para registrar ou *não* para cancelar.`);
  }

  // ------------------------------------------------------------------- decisão

  private async tratarBotao(vinculo: { id: string; usuarioId: string; telefone: string; fazendaPadraoId: string | null }, msg: MensagemEntrada) {
    const m = /^([cx]):([\w-]{8,})$/.exec(msg.botaoId ?? '');
    if (!m) return this.responder(msg.de, 'Não reconheci essa opção. Mande "ajuda" para ver o que dá para fazer.');
    const pendente = await this.prisma.whatsappPendente.findUnique({ where: { id: m[2]! } });
    // o botão só vale para o número que originou o pendente
    if (!pendente || pendente.telefone !== vinculo.telefone) {
      return this.responder(msg.de, 'Esse registro não está mais disponível. Envie a informação de novo.');
    }
    return this.decidir(vinculo, msg.de, pendente, m[1] === 'c');
  }

  private async decidirUltimo(vinculo: { id: string; usuarioId: string; telefone: string; fazendaPadraoId: string | null }, de: string, confirmar: boolean) {
    const pendente = await this.prisma.whatsappPendente.findFirst({ where: { telefone: vinculo.telefone }, orderBy: { criadoEm: 'desc' } });
    if (!pendente) return this.responder(de, 'Não há nenhum registro aguardando confirmação.');
    return this.decidir(vinculo, de, pendente, confirmar);
  }

  private async decidir(
    vinculo: { usuarioId: string; telefone: string },
    de: string,
    pendente: { id: string; usuarioId: string; fazendaId: string; comando: unknown; expiraEm: Date },
    confirmar: boolean,
  ) {
    // apaga primeiro: dois toques seguidos não registram duas vezes
    const apagado = await this.prisma.whatsappPendente.deleteMany({ where: { id: pendente.id } });
    if (apagado.count === 0) return this.responder(de, 'Esse registro já foi tratado.');
    if (!confirmar) return this.responder(de, 'Cancelado. Nada foi registrado.');
    if (pendente.expiraEm.getTime() < Date.now()) return this.responder(de, 'Esse registro venceu (mais de 15 minutos). Envie a informação de novo.');

    const comando = pendente.comando as Comando;
    try {
      await this.responder(de, await this.executar(vinculo.usuarioId, pendente.fazendaId, comando));
    } catch (e) {
      await this.responder(de, this.mensagemDeErro(e));
    }
  }

  private mensagemDeErro(e: unknown): string {
    if (e instanceof ForbiddenException) return 'Seu acesso a esta fazenda não permite esse registro (o financeiro é só para administrador e gestor).';
    if (e instanceof HttpException && e.getStatus() === 402) return 'Seu plano atual não permite esse registro. Veja as opções em Mais → Planos no app.';
    if (e instanceof BadRequestException) {
      const r = e.getResponse() as any;
      return `Não consegui registrar: ${Array.isArray(r?.message) ? r.message.join(', ') : (r?.message ?? e.message)}`;
    }
    this.logger.error(`Erro ao executar comando: ${(e as Error).message}`);
    return 'Não consegui registrar agora. Tente de novo em instantes.';
  }

  private async executar(usuarioId: string, fazendaId: string, c: Comando): Promise<string> {
    switch (c.tipo) {
      case 'despesa':
      case 'receita': {
        await this.financeiro.create(
          { fazendaId, data: c.data, descricao: c.descricao, valor: c.valor, tipo: c.tipo, ...(c.categoria ? { categoria: c.categoria } : {}) } as any,
          usuarioId,
        );
        return `✅ ${c.tipo === 'despesa' ? 'Despesa' : 'Receita'} de ${moedaBR(c.valor)} registrada.\nSe precisar do CPF/CNPJ para o LCDPR, complete no app.`;
      }
      case 'chuva': {
        await this.chuva.registrar({ fazendaId, data: c.data, mm: c.mm }, usuarioId);
        const resumo = await this.chuva.resumo(fazendaId, usuarioId);
        return `✅ Chuva de ${c.mm.toLocaleString('pt-BR')} mm registrada.\n🌧️ Neste ano: ${Math.round(resumo.totalMm)} mm em ${resumo.diasComChuva} dias.`;
      }
      case 'pesagem': {
        const animal = await this.prisma.animal.findFirst({
          where: { fazendaId, status: 'ativo', brinco: { equals: c.brinco, mode: 'insensitive' } },
          select: { id: true, brinco: true },
        });
        if (!animal) return `Não achei o brinco ${c.brinco} entre os animais ativos desta fazenda. Confira o número e envie de novo.`;
        await this.pesagem.create({ animalId: animal.id, data: `${c.data}T12:00:00.000Z`, pesoKg: c.pesoKg }, usuarioId);
        return `✅ Pesagem registrada: brinco ${animal.brinco} com ${c.pesoKg.toLocaleString('pt-BR')} kg.`;
      }
      default:
        return 'Não sei registrar isso.';
    }
  }

  // -------------------------------------------------------------------- resumo

  private async responderResumo(vinculo: { usuarioId: string; fazendaPadraoId: string | null }, de: string) {
    const fazenda = await this.fazendaAtiva(vinculo);
    if (!fazenda) return this.responder(de, 'Você ainda não tem fazenda no AgroTotal.');

    const agora = new Date();
    const inicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    const fim = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));
    const linhas = [`📊 *${fazenda.nome}* — ${inicio.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })}`];

    // dinheiro só para quem pode ver o financeiro
    if ((PAPEIS_FINANCEIRO as readonly string[]).includes(fazenda.papel)) {
      const grupos = await this.prisma.financeiro.groupBy({
        by: ['tipo'],
        where: { fazendaId: fazenda.id, data: { gte: inicio, lt: fim } },
        _sum: { valor: true },
      });
      const receitas = grupos.find((g) => g.tipo === 'receita')?._sum.valor ?? 0;
      const despesas = grupos.find((g) => g.tipo === 'despesa')?._sum.valor ?? 0;
      linhas.push(`💰 Receitas: ${moedaBR(receitas)}`, `💸 Despesas: ${moedaBR(despesas)}`, `${receitas - despesas >= 0 ? '🟢' : '🔴'} Saldo: ${moedaBR(receitas - despesas)}`);
    }
    const chuva = await this.prisma.chuva.aggregate({ where: { fazendaId: fazenda.id, data: { gte: inicio, lt: fim } }, _sum: { mm: true } });
    linhas.push(`🌧️ Chuva: ${Math.round(chuva._sum.mm ?? 0)} mm`);
    const animais = await this.prisma.animal.count({ where: { fazendaId: fazenda.id, status: 'ativo' } });
    linhas.push(`🐄 Animais ativos: ${animais}`);
    await this.responder(de, linhas.join('\n'));
  }

  private async trocarFazenda(vinculo: { usuarioId: string; fazendaPadraoId: string | null }, de: string, nome: string) {
    const lista = await this.fazendasDoUsuario(vinculo.usuarioId);
    if (lista.length === 0) return this.responder(de, 'Você ainda não tem fazenda no AgroTotal.');
    const alvo = norm(nome);
    const achada = lista.find((f) => norm(f.nome) === alvo) ?? lista.find((f) => norm(f.nome).includes(alvo));
    if (!achada) {
      return this.responder(de, `Não achei essa fazenda. Suas fazendas:\n${lista.map((f) => `• ${f.nome}`).join('\n')}\n\nExemplo: "fazenda ${lista[0]!.nome}"`);
    }
    await this.prisma.whatsappVinculo.update({ where: { usuarioId: vinculo.usuarioId }, data: { fazendaPadraoId: achada.id } });
    return this.responder(de, `🌾 Pronto! Os próximos registros vão para *${achada.nome}*.`);
  }

  // --------------------------------------------------------------------- áudio

  private async tratarAudio(vinculo: { id: string; usuarioId: string; telefone: string; fazendaPadraoId: string | null }, msg: MensagemEntrada) {
    if (!this.stt.disponivel()) {
      return this.responder(msg.de, 'Ainda não consigo ouvir áudios. Envie por texto, por exemplo: "gastei 450 com ração".');
    }
    const midia = msg.audioId ? await this.cliente.baixarMidia(msg.audioId) : null;
    const texto = midia ? await this.stt.transcrever(midia.dados, msg.audioMime ?? midia.mime) : null;
    if (!texto) return this.responder(msg.de, 'Não consegui entender o áudio. Tente de novo ou envie por texto.');
    await this.responder(msg.de, `🎙️ Entendi: “${texto.slice(0, 300)}”`);
    return this.tratarTexto(vinculo, msg.de, texto);
  }
}
