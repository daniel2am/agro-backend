import { ForbiddenException } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { MensagemEntrada } from './whatsapp.webhook';

// ---- banco em memória: só as operações que o serviço usa
function criarBanco() {
  const t = {
    mensagens: [] as any[], vinculos: [] as any[], codigos: [] as any[], pendentes: [] as any[],
    fazendas: [{ papel: 'administrador', fazenda: { id: 'f1', nome: 'Boa Vista' } }] as any[],
    animais: [{ id: 'a1', brinco: 'BR-001', fazendaId: 'f1', status: 'ativo' }] as any[],
  };
  let seq = 0;
  const id = (p: string) => `${p}${String(++seq).padStart(8, '0')}`;
  const casa = (obj: any, where: any): boolean =>
    Object.entries(where ?? {}).every(([k, v]: [string, any]) => {
      if (k === 'OR') return v.some((w: any) => casa(obj, w));
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('gte' in v || 'lt' in v) return (v.gte === undefined || obj[k] >= v.gte) && (v.lt === undefined || obj[k] < v.lt);
        if ('equals' in v) return String(obj[k]).toLowerCase() === String(v.equals).toLowerCase();
        return true;
      }
      return obj[k] === v;
    });
  const tabela = (nome: keyof typeof t, extra: any = {}) => ({
    create: jest.fn(async ({ data }: any) => {
      if (nome === 'mensagens' && t.mensagens.some((m) => m.id === data.id)) throw Object.assign(new Error('dup'), { code: 'P2002' });
      const row = { id: data.id ?? id(String(nome)), criadoEm: new Date(), recebidoEm: new Date(), ...data };
      (t[nome] as any[]).push(row);
      return row;
    }),
    findUnique: jest.fn(async ({ where }: any) => (t[nome] as any[]).find((r) => casa(r, where)) ?? null),
    findFirst: jest.fn(async ({ where, orderBy }: any) => {
      const l = (t[nome] as any[]).filter((r) => casa(r, where));
      return (orderBy ? [...l].reverse() : l)[0] ?? null;
    }),
    count: jest.fn(async ({ where }: any) => (t[nome] as any[]).filter((r) => casa(r, where)).length),
    deleteMany: jest.fn(async ({ where }: any) => {
      const antes = (t[nome] as any[]).length;
      (t as any)[nome] = (t[nome] as any[]).filter((r) => !casa(r, where));
      return { count: antes - (t[nome] as any[]).length };
    }),
    delete: jest.fn(async ({ where }: any) => {
      (t as any)[nome] = (t[nome] as any[]).filter((r) => !casa(r, where));
      return {};
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const r = (t[nome] as any[]).find((x) => casa(x, where));
      Object.assign(r, data);
      return r;
    }),
    ...extra,
  });
  const prisma: any = {
    whatsappMensagem: tabela('mensagens'),
    whatsappVinculo: tabela('vinculos'),
    whatsappCodigo: tabela('codigos'),
    whatsappPendente: tabela('pendentes'),
    fazendaUsuario: { findMany: jest.fn(async () => t.fazendas) },
    animal: {
      findFirst: jest.fn(async ({ where }: any) => t.animais.find((a) => casa(a, where)) ?? null),
      count: jest.fn(async () => 12),
    },
    financeiro: { groupBy: jest.fn(async () => [{ tipo: 'receita', _sum: { valor: 5000 } }, { tipo: 'despesa', _sum: { valor: 1800 } }]) },
    chuva: { aggregate: jest.fn(async () => ({ _sum: { mm: 63 } })) },
  };
  prisma.$transaction = jest.fn(async (ops: Promise<any>[]) => Promise.all(ops));
  return { t, prisma };
}

const FONE = '5567999998888';
const msgTexto = (texto: string, extra: Partial<MensagemEntrada> = {}): MensagemEntrada => ({
  id: `wamid.${Math.random()}`, de: FONE, numeroComercialId: null, tipo: 'texto', texto, tempo: 1, ...extra,
});

describe('WhatsappService', () => {
  let banco: ReturnType<typeof criarBanco>;
  let planos: any, financeiro: any, chuva: any, pesagem: any, cliente: any, ia: any, stt: any;
  let service: WhatsappService;
  const enviados = () => cliente.enviarTexto.mock.calls.map((c: any[]) => c[1] as string);
  const botoes = () => cliente.enviarBotoes.mock.calls.map((c: any[]) => ({ texto: c[1] as string, botoes: c[2] as any[] }));

  const vincular = () => {
    banco.t.vinculos.push({ id: 'v1', usuarioId: 'u1', telefone: '556799998888', telefoneExibicao: '(67) 99999-8888', fazendaPadraoId: null });
  };

  beforeEach(() => {
    delete process.env.WHATSAPP_PHONE_ID;
    banco = criarBanco();
    planos = { assertRecurso: jest.fn().mockResolvedValue(undefined) };
    financeiro = { create: jest.fn().mockResolvedValue({ id: 'fin1' }) };
    chuva = { registrar: jest.fn().mockResolvedValue({}), resumo: jest.fn().mockResolvedValue({ totalMm: 247.4, diasComChuva: 9 }) };
    pesagem = { create: jest.fn().mockResolvedValue({ id: 'p1' }) };
    cliente = {
      configurado: jest.fn().mockReturnValue(true),
      enviarTexto: jest.fn().mockResolvedValue(true),
      enviarBotoes: jest.fn().mockResolvedValue(true),
      baixarMidia: jest.fn().mockResolvedValue({ dados: Buffer.from('x'), mime: 'audio/ogg' }),
    };
    ia = { disponivel: jest.fn().mockReturnValue(false), interpretar: jest.fn().mockResolvedValue(null) };
    stt = { disponivel: jest.fn().mockReturnValue(false), transcrever: jest.fn().mockResolvedValue(null) };
    service = new WhatsappService(banco.prisma, planos, financeiro, chuva, pesagem, cliente, ia, stt);
  });

  describe('número não vinculado', () => {
    it('explica como vincular e não grava nada', async () => {
      await service.processar(msgTexto('gastei 450 com ração'));
      expect(enviados()[0]).toContain('Mais → WhatsApp');
      expect(financeiro.create).not.toHaveBeenCalled();
      expect(banco.t.pendentes).toHaveLength(0);
    });

    it('código válido vincula o número, apaga o código e dá as boas-vindas', async () => {
      banco.t.codigos.push({ id: 'c1', usuarioId: 'u1', codigo: '123456', expiraEm: new Date(Date.now() + 60_000) });
      await service.processar(msgTexto('123456'));
      expect(banco.t.vinculos).toHaveLength(1);
      expect(banco.t.vinculos[0]).toMatchObject({ usuarioId: 'u1', telefone: '556799998888', telefoneExibicao: '(67) 99999-8888' });
      expect(banco.t.codigos).toHaveLength(0);
      expect(enviados()[0]).toContain('vinculado');
    });

    it('o código também funciona dentro de uma frase', async () => {
      banco.t.codigos.push({ id: 'c1', usuarioId: 'u1', codigo: '654321', expiraEm: new Date(Date.now() + 60_000) });
      await service.processar(msgTexto('oi, meu código é 654321'));
      expect(banco.t.vinculos).toHaveLength(1);
    });

    it('código vencido ou inexistente não vincula', async () => {
      banco.t.codigos.push({ id: 'c1', usuarioId: 'u1', codigo: '111111', expiraEm: new Date(Date.now() - 1000) });
      await service.processar(msgTexto('111111'));
      await service.processar(msgTexto('999999'));
      expect(banco.t.vinculos).toHaveLength(0);
      expect(enviados().every((m: string) => m.includes('inválido ou vencido'))).toBe(true);
    });

    it('conta que já tem WhatsApp, ou número já usado por outra conta, não vincula de novo', async () => {
      banco.t.vinculos.push({ id: 'v0', usuarioId: 'u1', telefone: '551100000000', telefoneExibicao: 'x', fazendaPadraoId: null });
      banco.t.codigos.push({ id: 'c1', usuarioId: 'u1', codigo: '222222', expiraEm: new Date(Date.now() + 60_000) });
      await service.processar(msgTexto('222222'));
      expect(banco.t.vinculos).toHaveLength(1);
      expect(enviados()[0]).toContain('já tem um WhatsApp');
    });

    it('o número casa com ou sem o 9 (formas que a Meta entrega)', async () => {
      banco.t.codigos.push({ id: 'c1', usuarioId: 'u1', codigo: '333333', expiraEm: new Date(Date.now() + 60_000) });
      await service.processar(msgTexto('333333', { de: '556799998888' })); // sem o 9
      expect(banco.t.vinculos[0].telefone).toBe('556799998888');
      await service.processar(msgTexto('ajuda', { de: '5567999998888' })); // com o 9: reconhece o mesmo dono
      expect(enviados().some((m: string) => m.includes('AgroTotal no WhatsApp'))).toBe(true);
    });
  });

  describe('fluxo de registro com confirmação', () => {
    beforeEach(vincular);

    it('despesa: NÃO grava; pede confirmação com botões e resumo', async () => {
      await service.processar(msgTexto('gastei 450 com ração'));
      expect(financeiro.create).not.toHaveBeenCalled();
      const b = botoes()[0]!;
      expect(b.texto).toContain('Despesa');
      expect(b.texto).toMatch(/R\$\s*450,00/);
      expect(b.texto).toContain('Boa Vista');
      expect(b.botoes.map((x: any) => x.titulo)).toEqual(['Confirmar', 'Cancelar']);
      expect(banco.t.pendentes).toHaveLength(1);
    });

    it('confirmar pelo botão grava com os dados certos e responde ✅', async () => {
      await service.processar(msgTexto('vendi 12 bezerros a 2800 cada'));
      const idBotao = botoes()[0]!.botoes[0].id; // c:<id>
      await service.processar({ ...msgTexto(''), tipo: 'botao', botaoId: idBotao });
      expect(financeiro.create).toHaveBeenCalledTimes(1);
      const [dto, usuario] = financeiro.create.mock.calls[0]!;
      expect(usuario).toBe('u1');
      expect(dto).toMatchObject({ fazendaId: 'f1', tipo: 'receita', valor: 33600, categoria: 'venda_gado' });
      expect(dto.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(enviados().pop()).toContain('✅');
      expect(banco.t.pendentes).toHaveLength(0);
    });

    it('tocar duas vezes em Confirmar registra UMA vez só', async () => {
      await service.processar(msgTexto('gastei 450 com ração'));
      const idBotao = botoes()[0]!.botoes[0].id;
      await service.processar({ ...msgTexto(''), tipo: 'botao', botaoId: idBotao });
      await service.processar({ ...msgTexto(''), tipo: 'botao', botaoId: idBotao });
      expect(financeiro.create).toHaveBeenCalledTimes(1);
      expect(enviados().pop()).toMatch(/não está mais disponível|já foi tratado/);
    });

    it('cancelar pelo botão ou digitando "não" descarta sem gravar', async () => {
      await service.processar(msgTexto('gastei 450 com ração'));
      await service.processar({ ...msgTexto(''), tipo: 'botao', botaoId: botoes()[0]!.botoes[1].id });
      expect(financeiro.create).not.toHaveBeenCalled();
      expect(enviados().pop()).toContain('Cancelado');

      await service.processar(msgTexto('choveu 20 mm'));
      await service.processar(msgTexto('não'));
      expect(chuva.registrar).not.toHaveBeenCalled();
      expect(banco.t.pendentes).toHaveLength(0);
    });

    it('responder "sim" (ou "ok") confirma o último pendente', async () => {
      await service.processar(msgTexto('choveu 25 mm ontem'));
      await service.processar(msgTexto('Sim!'));
      expect(chuva.registrar).toHaveBeenCalledWith({ fazendaId: 'f1', data: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), mm: 25 }, 'u1');
      expect(enviados().pop()).toContain('247 mm');
    });

    it('"sim" sem nada pendente não faz nada de perigoso', async () => {
      await service.processar(msgTexto('sim'));
      expect(financeiro.create).not.toHaveBeenCalled();
      expect(enviados().pop()).toContain('nenhum registro aguardando');
    });

    it('um registro novo substitui o pendente anterior (só vale o mais recente)', async () => {
      await service.processar(msgTexto('gastei 100 com ração'));
      await service.processar(msgTexto('gastei 200 com vacina'));
      expect(banco.t.pendentes).toHaveLength(1);
      await service.processar(msgTexto('sim'));
      expect(financeiro.create.mock.calls[0]![0].valor).toBe(200);
    });

    it('pendente vencido (mais de 15 min) não grava', async () => {
      await service.processar(msgTexto('gastei 450 com ração'));
      banco.t.pendentes[0].expiraEm = new Date(Date.now() - 1000);
      await service.processar(msgTexto('sim'));
      expect(financeiro.create).not.toHaveBeenCalled();
      expect(enviados().pop()).toContain('venceu');
    });

    it('o botão de OUTRO número não confirma o registro de quem enviou', async () => {
      await service.processar(msgTexto('gastei 450 com ração'));
      const idBotao = botoes()[0]!.botoes[0].id;
      banco.t.vinculos.push({ id: 'v2', usuarioId: 'u2', telefone: '551100001111', telefoneExibicao: 'x', fazendaPadraoId: null });
      await service.processar({ ...msgTexto('', { de: '551100001111' }), tipo: 'botao', botaoId: idBotao });
      expect(financeiro.create).not.toHaveBeenCalled();
      expect(banco.t.pendentes).toHaveLength(1); // o do dono continua intacto
    });

    it('botão com id inventado é recusado', async () => {
      await service.processar({ ...msgTexto(''), tipo: 'botao', botaoId: 'c:../../etc' });
      await service.processar({ ...msgTexto(''), tipo: 'botao', botaoId: 'c:inexistente1' });
      expect(financeiro.create).not.toHaveBeenCalled();
    });

    it('se os botões não puderem ser enviados, cai para texto com "sim/não"', async () => {
      cliente.enviarBotoes.mockResolvedValue(false);
      await service.processar(msgTexto('gastei 450 com ração'));
      expect(enviados().pop()).toContain('Responda *sim*');
    });
  });

  describe('permissões e erros ao gravar', () => {
    beforeEach(vincular);

    it('colaborador sem acesso ao financeiro recebe explicação, não erro técnico', async () => {
      financeiro.create.mockRejectedValue(new ForbiddenException('Acesso negado'));
      await service.processar(msgTexto('gastei 450 com ração'));
      await service.processar(msgTexto('sim'));
      expect(enviados().pop()).toContain('administrador e gestor');
    });

    it('limite do plano (402) vira mensagem amigável', async () => {
      const e = Object.assign(new Error('x'), {});
      Object.setPrototypeOf(e, require('@nestjs/common').HttpException.prototype);
      (e as any).getStatus = () => 402;
      pesagem.create.mockRejectedValue(e);
      await service.processar(msgTexto('pesagem BR-001 470 kg'));
      await service.processar(msgTexto('sim'));
      expect(enviados().pop()).toContain('plano');
    });

    it('erro inesperado: resposta genérica e o texto da mensagem não vai para o log', async () => {
      const log = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      financeiro.create.mockRejectedValue(new Error('banco caiu'));
      await service.processar(msgTexto('gastei 450 com ração'));
      await service.processar(msgTexto('sim'));
      expect(enviados().pop()).toContain('Não consegui registrar agora');
      expect(JSON.stringify(log.mock.calls)).not.toContain('ração');
    });
  });

  describe('pesagem', () => {
    beforeEach(vincular);
    it('acha o brinco (sem diferenciar maiúscula) e registra no animal certo', async () => {
      await service.processar(msgTexto('pesagem br-001 470 kg'));
      await service.processar(msgTexto('sim'));
      expect(pesagem.create).toHaveBeenCalledWith({ animalId: 'a1', data: expect.stringMatching(/T12:00:00.000Z$/), pesoKg: 470 }, 'u1');
      expect(enviados().pop()).toContain('BR-001');
    });
    it('brinco que não existe: avisa e não registra', async () => {
      await service.processar(msgTexto('pesagem 9999 470 kg'));
      await service.processar(msgTexto('sim'));
      expect(pesagem.create).not.toHaveBeenCalled();
      expect(enviados().pop()).toContain('Não achei o brinco 9999');
    });
  });

  describe('comandos sem confirmação', () => {
    beforeEach(vincular);
    it('ajuda', async () => {
      await service.processar(msgTexto('ajuda'));
      expect(enviados().pop()).toContain('gastei 450');
    });
    it('resumo traz receitas, despesas e saldo para quem vê o financeiro', async () => {
      await service.processar(msgTexto('resumo'));
      const r = enviados().pop()!;
      expect(r).toMatch(/Receitas: R\$\s*5\.000,00/);
      expect(r).toMatch(/Despesas: R\$\s*1\.800,00/);
      expect(r).toMatch(/Saldo: R\$\s*3\.200,00/);
      expect(r).toContain('63 mm');
    });
    it('resumo para colaborador NÃO mostra dinheiro', async () => {
      banco.t.fazendas[0].papel = 'colaborador';
      await service.processar(msgTexto('resumo'));
      const r = enviados().pop()!;
      expect(r).not.toMatch(/Receitas|Despesas|Saldo/);
      expect(r).toContain('63 mm');
      expect(banco.prisma.financeiro.groupBy).not.toHaveBeenCalled();
    });
    it('troca de fazenda', async () => {
      banco.t.fazendas.push({ papel: 'administrador', fazenda: { id: 'f2', nome: 'Santa Rita' } });
      await service.processar(msgTexto('fazenda santa rita'));
      expect(banco.t.vinculos[0].fazendaPadraoId).toBe('f2');
      await service.processar(msgTexto('choveu 10'));
      expect(botoes().pop()!.texto).toContain('Santa Rita');
    });
    it('fazenda inexistente lista as suas', async () => {
      await service.processar(msgTexto('fazenda inexistente'));
      expect(enviados().pop()).toContain('Boa Vista');
    });
  });

  describe('entendimento', () => {
    beforeEach(vincular);
    it('não entendeu e sem IA: ajuda com exemplos', async () => {
      await service.processar(msgTexto('qual a previsão para amanhã?'));
      expect(enviados().pop()).toContain('Exemplos');
    });
    it('falta valor: dica específica', async () => {
      await service.processar(msgTexto('gastei com ração'));
      expect(enviados().pop()).toContain('Qual o valor');
    });
    it('IA só é consultada quando o interpretador comum não entende, e o resultado é revalidado', async () => {
      ia.disponivel.mockReturnValue(true);
      ia.interpretar.mockResolvedValue({ tipo: 'despesa', valor: 800, descricao: 'conserto da cerca', categoria: 'manutencao' });
      await service.processar(msgTexto('o João cobrou oitocentos pelo serviço da cerca'));
      expect(ia.interpretar).toHaveBeenCalledTimes(1);
      expect(botoes().pop()!.texto).toMatch(/R\$\s*800,00/);

      ia.interpretar.mockClear();
      await service.processar(msgTexto('gastei 100 com ração')); // o determinístico resolve: sem IA
      expect(ia.interpretar).not.toHaveBeenCalled();
    });
    it('IA devolvendo lixo (valor negativo, tipo perigoso) não vira registro', async () => {
      ia.disponivel.mockReturnValue(true);
      ia.interpretar.mockResolvedValue({ tipo: 'despesa', valor: -50, descricao: 'x' });
      await service.processar(msgTexto('frase solta qualquer sem número'));
      expect(banco.t.pendentes).toHaveLength(0);
      ia.interpretar.mockResolvedValue({ tipo: 'apagar_tudo' });
      await service.processar(msgTexto('outra frase solta sem número'));
      expect(banco.t.pendentes).toHaveLength(0);
    });
    it('mensagem enorme não vai para a IA', async () => {
      ia.disponivel.mockReturnValue(true);
      await service.processar(msgTexto('abc '.repeat(300)));
      expect(ia.interpretar).not.toHaveBeenCalled();
    });
  });

  describe('áudio', () => {
    beforeEach(vincular);
    const audio = (): MensagemEntrada => ({ ...msgTexto(''), tipo: 'audio', audioId: 'MID1', audioMime: 'audio/ogg; codecs=opus', texto: undefined });
    it('sem transcritor configurado: pede texto', async () => {
      await service.processar(audio());
      expect(enviados().pop()).toContain('Envie por texto');
      expect(cliente.baixarMidia).not.toHaveBeenCalled();
    });
    it('com transcritor: mostra o que entendeu e segue o fluxo normal (com confirmação)', async () => {
      stt.disponivel.mockReturnValue(true);
      stt.transcrever.mockResolvedValue('gastei quatrocentos e cinquenta com ração');
      await service.processar(audio());
      expect(enviados()[0]).toContain('Entendi');
      // "quatrocentos e cinquenta" por extenso não tem dígito → o interpretador pede o valor
      expect(financeiro.create).not.toHaveBeenCalled();
    });
    it('transcrição com números em dígitos vira pendência normal', async () => {
      stt.disponivel.mockReturnValue(true);
      stt.transcrever.mockResolvedValue('Gastei 450 reais com ração.');
      await service.processar(audio());
      expect(botoes().pop()!.texto).toMatch(/R\$\s*450,00/);
    });
    it('falha no download ou na transcrição: avisa', async () => {
      stt.disponivel.mockReturnValue(true);
      cliente.baixarMidia.mockResolvedValue(null);
      await service.processar(audio());
      expect(enviados().pop()).toContain('Não consegui entender o áudio');
    });
  });

  describe('plano, duplicidade e limites', () => {
    it('plano sem o recurso: orienta e não executa', async () => {
      vincular();
      planos.assertRecurso.mockRejectedValue(new Error('402'));
      await service.processar(msgTexto('gastei 450 com ração'));
      expect(enviados().pop()).toContain('plano Produtor');
      expect(banco.t.pendentes).toHaveLength(0);
    });
    it('a mesma mensagem (id repetido pela Meta) é processada uma só vez', async () => {
      vincular();
      const m = msgTexto('ajuda', { id: 'wamid.fixo' });
      await service.processar(m);
      await service.processar(m);
      expect(enviados().filter((x: string) => x.includes('AgroTotal no WhatsApp'))).toHaveLength(1);
    });
    it('mensagens para outro número comercial são ignoradas', async () => {
      vincular();
      process.env.WHATSAPP_PHONE_ID = 'MEU_NUMERO';
      await service.processar(msgTexto('ajuda', { numeroComercialId: 'OUTRO' }));
      expect(cliente.enviarTexto).not.toHaveBeenCalled();
      delete process.env.WHATSAPP_PHONE_ID;
    });
    it('excesso de mensagens: avisa uma vez e depois silencia', async () => {
      vincular();
      for (let i = 0; i < 40; i++) banco.t.mensagens.push({ id: `old${i}`, telefone: '556799998888', recebidoEm: new Date() });
      await service.processar(msgTexto('ajuda'));
      await service.processar(msgTexto('ajuda'));
      await service.processar(msgTexto('ajuda'));
      expect(enviados().filter((x: string) => x.includes('Muitas mensagens'))).toHaveLength(1);
      expect(enviados().filter((x: string) => x.includes('AgroTotal no WhatsApp'))).toHaveLength(0);
    });
    it('tipos que não entende (imagem, figurinha) recebem orientação', async () => {
      vincular();
      await service.processar({ ...msgTexto(''), tipo: 'outro', texto: undefined });
      expect(enviados().pop()).toContain('só entendo texto e áudio');
    });
  });

  describe('código de vinculação (app)', () => {
    it('gera 6 dígitos válidos por 15 min, substitui o anterior e exige o plano', async () => {
      process.env.WHATSAPP_NUMERO_EXIBICAO = '+55 67 99999-0000';
      banco.t.codigos.push({ id: 'velho', usuarioId: 'u1', codigo: '000000', expiraEm: new Date() });
      const r = await service.gerarCodigo('u1');
      expect(planos.assertRecurso).toHaveBeenCalledWith('u1', 'whatsapp');
      expect(r.codigo).toMatch(/^\d{6}$/);
      expect(banco.t.codigos).toHaveLength(1);
      expect(banco.t.codigos[0].codigo).toBe(r.codigo);
      const min = (r.expiraEm.getTime() - Date.now()) / 60_000;
      expect(min).toBeGreaterThan(14);
      expect(min).toBeLessThanOrEqual(15);
      expect(r.link).toBe(`https://wa.me/5567999990000?text=${r.codigo}`);
      delete process.env.WHATSAPP_NUMERO_EXIBICAO;
    });
    it('sem o plano, não gera código', async () => {
      planos.assertRecurso.mockRejectedValue(new Error('402'));
      await expect(service.gerarCodigo('u1')).rejects.toThrow('402');
      expect(banco.t.codigos).toHaveLength(0);
    });
    it('situação e desvincular', async () => {
      vincular();
      expect(await service.situacao('u1')).toMatchObject({ vinculado: true, telefone: '(67) 99999-8888' });
      banco.t.pendentes.push({ id: 'p', usuarioId: 'u1', telefone: '556799998888' });
      await service.desvincular('u1');
      expect(banco.t.vinculos).toHaveLength(0);
      expect(banco.t.pendentes).toHaveLength(0);
      expect(await service.situacao('u1')).toMatchObject({ vinculado: false });
    });
  });
});
