import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PlanoService } from '../plano/plano.service';
import {
  Alerta,
  alertaPesagemAtrasada,
  alertasDeGanho,
  alertasDeLotacao,
  alertasDeVacina,
  ordenarAlertas,
} from './alertas.regras';

@Injectable()
export class AlertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planos: PlanoService,
  ) {}

  async listar(fazendaId: string, usuarioId: string, agora: Date = new Date()): Promise<{ total: number; alertas: Alerta[] }> {
    const vinculo = await this.prisma.fazendaUsuario.findFirst({ where: { fazendaId, usuarioId }, select: { id: true } });
    if (!vinculo) throw new ForbiddenException('Acesso negado à fazenda');
    await this.planos.assertRecursoDaFazenda(fazendaId, 'alertas_inteligentes');

    const limiteVacina = new Date(agora.getTime() + 8 * 86_400_000);
    const [animais, invernadas, meds] = await Promise.all([
      this.prisma.animal.findMany({
        where: { fazendaId, status: 'ativo' },
        select: {
          id: true,
          brinco: true,
          criadoEm: true,
          pesagens: { orderBy: { data: 'desc' }, take: 2, select: { data: true, pesoKg: true } },
        },
      }),
      this.prisma.invernada.findMany({
        where: { fazendaId },
        select: { id: true, nome: true, area: true, animais: { where: { status: 'ativo' }, select: { peso: true } } },
      }),
      this.prisma.medicamento.findMany({
        where: {
          lembreteAtivo: true,
          proximaAplicacao: { not: null, lte: limiteVacina },
          animal: { fazendaId, status: 'ativo' },
        },
        select: { id: true, nome: true, proximaAplicacao: true, animalId: true, animal: { select: { brinco: true } } },
      }),
    ]);

    const alertas: Alerta[] = [
      ...alertasDeVacina(
        meds.map((m) => ({
          id: m.id,
          nome: m.nome,
          proximaAplicacao: m.proximaAplicacao as Date,
          animalId: m.animalId,
          brinco: m.animal?.brinco ?? null,
        })),
        agora,
      ),
      ...alertasDeGanho(animais.map((a) => ({ id: a.id, brinco: a.brinco, pesagens: a.pesagens }))),
      ...alertasDeLotacao(invernadas.map((i) => ({ id: i.id, nome: i.nome, areaHa: i.area, pesos: i.animais.map((a) => a.peso) }))),
    ];
    const atrasada = alertaPesagemAtrasada(
      animais.map((a) => ({ id: a.id, brinco: a.brinco, criadoEm: a.criadoEm, ultimaPesagem: a.pesagens[0]?.data ?? null })),
      agora,
    );
    if (atrasada) alertas.push(atrasada);

    const ordenados = ordenarAlertas(alertas);
    return { total: ordenados.length, alertas: ordenados };
  }
}
