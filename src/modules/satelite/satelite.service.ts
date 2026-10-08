import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PlanoService } from '../plano/plano.service';
import { AREA_MAXIMA_HA, LatLng, areaEmHectares, limitarPontos, normalizarPoligono } from './satelite.geo';
import { PROVEDOR_NDVI, ProvedorIndisponivelError, ProvedorNdvi } from './satelite.provedor';
import {
  Classificacao, PontoNdvi, Tendencia, TipoAlvo, calcularTendencia, classificarNdvi, diasDesdeUltimaLeitura,
  inicioDaGrade, quedaForte, textoDaTendencia,
} from './satelite.regras';

/** Quanto histórico buscar na primeira vez (dá comparação com o ano anterior). */
const HISTORICO_INICIAL_DIAS = 400;
/** Releitura dos últimos dias a cada atualização: imagens novas chegam com atraso. */
const RELEITURA_DIAS = 20;
/** Não consulta o provedor de novo para o mesmo alvo antes disto (poupa a cota). */
const INTERVALO_MIN_ATUALIZACAO_H = 12;
const MAX_ALVOS_POR_ATUALIZACAO = 12;
const DIA_MS = 86_400_000;

interface Alvo {
  tipo: TipoAlvo;
  id: string;
  nome: string;
  areaHa: number;
  poligono: LatLng[] | null;
}

const diaIso = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class SateliteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planos: PlanoService,
    @Inject(PROVEDOR_NDVI) private readonly provedor: ProvedorNdvi,
  ) {}

  private async liberar(fazendaId: string, usuarioId: string) {
    const v = await this.prisma.fazendaUsuario.findFirst({ where: { fazendaId, usuarioId }, select: { id: true } });
    if (!v) throw new ForbiddenException('Acesso negado à fazenda');
    await this.planos.assertRecursoDaFazenda(fazendaId, 'satelite');
  }

  private async alvosDaFazenda(fazendaId: string): Promise<Alvo[]> {
    const [invernadas, lavouras] = await Promise.all([
      this.prisma.invernada.findMany({ where: { fazendaId }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, area: true, poligono: true } }),
      this.prisma.lavoura.findMany({ where: { fazendaId, status: 'ativo' }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, areaHa: true, poligono: true } }),
    ]);
    return [
      ...invernadas.map((i): Alvo => ({ tipo: 'invernada', id: i.id, nome: i.nome, areaHa: i.area, poligono: normalizarPoligono(i.poligono) })),
      ...lavouras.map((l): Alvo => ({ tipo: 'lavoura', id: l.id, nome: l.nome, areaHa: l.areaHa, poligono: normalizarPoligono(l.poligono) })),
    ];
  }

  private paraPonto(m: { inicio: Date; fim: Date; media: number | null; minimo: number | null; maximo: number | null; desvio: number | null; cobertura: number }): PontoNdvi {
    return { inicio: diaIso(m.inicio), fim: diaIso(m.fim), media: m.media, minimo: m.minimo, maximo: m.maximo, desvio: m.desvio, cobertura: m.cobertura };
  }

  // ---------------------------------------------------------------- leitura

  async resumo(fazendaId: string, usuarioId: string, hoje: Date = new Date()) {
    await this.liberar(fazendaId, usuarioId);
    const alvos = await this.alvosDaFazenda(fazendaId);
    const medicoes = await this.prisma.ndviMedicao.findMany({
      where: { fazendaId, inicio: { gte: new Date(hoje.getTime() - HISTORICO_INICIAL_DIAS * DIA_MS) } },
      orderBy: { inicio: 'asc' },
    });
    const porAlvo = new Map<string, typeof medicoes>();
    for (const m of medicoes) {
      const k = `${m.alvoTipo}:${m.alvoId}`;
      (porAlvo.get(k) ?? porAlvo.set(k, []).get(k)!).push(m);
    }

    const limiteAtualizacao = hoje.getTime() - INTERVALO_MIN_ATUALIZACAO_H * 3_600_000;
    let precisaAtualizar = false;

    const monitorados = alvos
      .filter((a) => a.poligono)
      .map((a) => {
        const linhas = porAlvo.get(`${a.tipo}:${a.id}`) ?? [];
        const serie = linhas.map((l) => this.paraPonto(l));
        const tendencia: Tendencia = calcularTendencia(serie);
        const uteis = serie.filter((p) => p.media !== null && p.cobertura >= 0.3);
        const ultimo = uteis[uteis.length - 1] ?? null;
        const classificacao: Classificacao | null = ultimo ? classificarNdvi(ultimo.media as number, a.tipo) : null;
        const ultimaAtualizacao = linhas.reduce<number>((m, l) => Math.max(m, l.atualizadoEm.getTime()), 0);
        if (ultimaAtualizacao < limiteAtualizacao) precisaAtualizar = true;
        return {
          tipo: a.tipo,
          id: a.id,
          nome: a.nome,
          areaHa: a.areaHa,
          ultimo,
          classificacao,
          tendencia,
          textoTendencia: textoDaTendencia(tendencia),
          alerta: quedaForte(tendencia),
          diasSemLeitura: diasDesdeUltimaLeitura(serie, hoje),
          // últimos ~4 meses para o gráfico pequeno do cartão
          serie: serie.filter((p) => Date.parse(`${p.fim}T00:00:00Z`) >= hoje.getTime() - 120 * DIA_MS),
        };
      });

    return {
      provedorConfigurado: this.provedor.configurado(),
      precisaAtualizar: precisaAtualizar && this.provedor.configurado(),
      alvos: monitorados,
      semPerimetro: alvos.filter((a) => !a.poligono).map((a) => ({ tipo: a.tipo, id: a.id, nome: a.nome })),
    };
  }

  async serie(fazendaId: string, tipo: string, alvoId: string, usuarioId: string) {
    await this.liberar(fazendaId, usuarioId);
    if (tipo !== 'invernada' && tipo !== 'lavoura') throw new BadRequestException('Tipo de área inválido');
    const alvo = (await this.alvosDaFazenda(fazendaId)).find((a) => a.tipo === tipo && a.id === alvoId);
    if (!alvo) throw new NotFoundException('Área não encontrada');
    const linhas = await this.prisma.ndviMedicao.findMany({
      where: { fazendaId, alvoTipo: tipo, alvoId },
      orderBy: { inicio: 'asc' },
    });
    return { tipo, id: alvo.id, nome: alvo.nome, areaHa: alvo.areaHa, serie: linhas.map((l) => this.paraPonto(l)) };
  }

  // ------------------------------------------------------------ atualização

  async atualizar(fazendaId: string, usuarioId: string, hoje: Date = new Date()) {
    await this.liberar(fazendaId, usuarioId);
    if (!this.provedor.configurado()) {
      throw new ServiceUnavailableException({
        code: 'SATELITE_NAO_CONFIGURADO',
        message: 'O monitoramento por satélite ainda não está ativado neste servidor.',
      });
    }

    const alvos = (await this.alvosDaFazenda(fazendaId)).filter((a) => a.poligono).slice(0, MAX_ALVOS_POR_ATUALIZACAO);
    const falhas: { id: string; nome: string; motivo: string }[] = [];
    let atualizados = 0;
    let recentes = 0;

    for (const a of alvos) {
      const poligono = a.poligono as LatLng[];
      const ultima = await this.prisma.ndviMedicao.findFirst({
        where: { fazendaId, alvoTipo: a.tipo, alvoId: a.id },
        orderBy: { inicio: 'desc' },
        select: { inicio: true, atualizadoEm: true },
      });
      if (ultima && hoje.getTime() - ultima.atualizadoEm.getTime() < INTERVALO_MIN_ATUALIZACAO_H * 3_600_000) {
        recentes++;
        continue;
      }
      const areaReal = areaEmHectares(poligono);
      if (areaReal > AREA_MAXIMA_HA) {
        falhas.push({ id: a.id, nome: a.nome, motivo: `Área de ${Math.round(areaReal)} ha passa do limite de ${AREA_MAXIMA_HA} ha.` });
        continue;
      }

      const de = ultima ? new Date(ultima.inicio.getTime() - RELEITURA_DIAS * DIA_MS) : new Date(hoje.getTime() - HISTORICO_INICIAL_DIAS * DIA_MS);
      try {
        const pontos = await this.provedor.estatisticas({
          poligono: limitarPontos(poligono),
          areaHa: areaReal,
          de: inicioDaGrade(de),
          ate: diaIso(hoje),
        });
        for (const p of pontos) {
          const dados = { fim: new Date(`${p.fim}T00:00:00Z`), media: p.media, minimo: p.minimo, maximo: p.maximo, desvio: p.desvio, cobertura: p.cobertura };
          await this.prisma.ndviMedicao.upsert({
            where: { alvoTipo_alvoId_inicio: { alvoTipo: a.tipo, alvoId: a.id, inicio: new Date(`${p.inicio}T00:00:00Z`) } },
            create: { fazendaId, alvoTipo: a.tipo, alvoId: a.id, inicio: new Date(`${p.inicio}T00:00:00Z`), ...dados },
            update: dados,
          });
        }
        atualizados++;
      } catch (e) {
        const msg = e instanceof ProvedorIndisponivelError ? e.message : 'Falha inesperada ao consultar o satélite.';
        falhas.push({ id: a.id, nome: a.nome, motivo: msg });
        // sem cota/limite: não adianta insistir nas demais áreas
        if (e instanceof ProvedorIndisponivelError && (e.status === 429 || e.status === 401 || e.status === 403)) break;
      }
    }
    return { atualizados, recentes, falhas, semPerimetro: (await this.alvosDaFazenda(fazendaId)).filter((a) => !a.poligono).length };
  }
}
