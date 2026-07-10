// src/modules/notificacao/notificacao.service.ts
//
// Central de Notificações. Em vez de manter uma tabela de notificações que
// precisaria de um worker para popular, os alertas são computados sob demanda
// a partir de dados reais — hoje, os lembretes de reforço de vacina/medicamento
// (Medicamento.proximaAplicacao + lembreteAtivo), sempre restritos às fazendas
// do usuário autenticado.
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

export interface Notificacao {
  id: string;
  tipo: 'vacina';
  titulo: string;
  mensagem: string;
  data: Date;
  brinco: string | null;
  vencida: boolean;
}

@Injectable()
export class NotificacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: string, janelaDias = 30): Promise<Notificacao[]> {
    const agora = new Date();
    const limite = new Date();
    limite.setDate(agora.getDate() + janelaDias);

    const medicamentos = await this.prisma.medicamento.findMany({
      where: {
        lembreteAtivo: true,
        proximaAplicacao: { lte: limite }, // exclui nulos e datas muito futuras
        animal: { fazenda: { usuarios: { some: { usuarioId } } } },
      },
      include: { animal: { select: { brinco: true, nome: true } } },
      orderBy: { proximaAplicacao: 'asc' },
    });

    return medicamentos.map((m) => {
      const prox = m.proximaAplicacao as Date;
      const vencida = prox < agora;
      const quando = prox.toLocaleDateString('pt-BR');
      return {
        id: m.id,
        tipo: 'vacina',
        titulo: vencida ? `Reforço vencido: ${m.nome}` : `Reforço se aproximando: ${m.nome}`,
        mensagem: `Animal ${m.animal?.brinco ?? '—'} · ${vencida ? 'venceu' : 'vence'} em ${quando}`,
        data: prox,
        brinco: m.animal?.brinco ?? null,
        vencida,
      };
    });
  }
}
