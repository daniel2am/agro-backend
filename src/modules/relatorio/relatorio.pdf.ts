// src/modules/relatorio/relatorio.pdf.ts
import PDFDocument from 'pdfkit';
import * as streamBuffers from 'stream-buffers';
import { RelatorioDados } from './relatorio.dados';

const VERDE = '#115414';
const CINZA = '#666666';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n: number, casas = 2) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas });
const dataBR = (d: Date | null) => (d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—');

export function descreverPeriodo(p: { inicio: Date | null; fim: Date | null }): string {
  if (!p.inicio && !p.fim) return 'Todo o histórico';
  return `${dataBR(p.inicio)} a ${dataBR(p.fim)}`;
}

/** Renderiza o relatório em PDF (A4). Devolve o arquivo em memória. */
export async function renderizarRelatorioPdf(d: RelatorioDados): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: `Relatório — ${d.fazenda.nome}`, Author: 'AgroTotal' } });
  const saida = new streamBuffers.WritableStreamBuffer();
  doc.pipe(saida);

  const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const x0 = doc.page.margins.left;

  const garantirEspaco = (altura: number) => {
    if (doc.y + altura > doc.page.height - doc.page.margins.bottom - 24) doc.addPage();
  };

  const titulo = (texto: string) => {
    garantirEspaco(60);
    doc.moveDown(0.8).font('Helvetica-Bold').fontSize(13).fillColor(VERDE).text(texto, x0);
    doc.moveTo(x0, doc.y + 2).lineTo(x0 + largura, doc.y + 2).strokeColor('#BFE0C7').lineWidth(1).stroke();
    doc.moveDown(0.6).fillColor('#222222');
  };

  /** Tabela simples: colunas com larguras proporcionais; a última coluna alinha à direita. */
  const tabela = (cabecalho: string[], linhas: string[][], pesos: number[]) => {
    const soma = pesos.reduce((a, b) => a + b, 0);
    const larguras = pesos.map((p) => (p / soma) * largura);
    const desenhar = (celulas: string[], negrito: boolean, cor = '#222222') => {
      garantirEspaco(18);
      const y = doc.y;
      let x = x0;
      doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(cor);
      celulas.forEach((c, i) => {
        doc.text(c, x + 2, y, { width: larguras[i]! - 4, align: i === 0 ? 'left' : 'right', lineBreak: false, ellipsis: true });
        x += larguras[i]!;
      });
      doc.y = y + 15;
    };
    desenhar(cabecalho, true, CINZA);
    doc.moveTo(x0, doc.y - 2).lineTo(x0 + largura, doc.y - 2).strokeColor('#DDDDDD').lineWidth(0.5).stroke();
    linhas.forEach((l) => desenhar(l, false));
  };

  // ---- cabeçalho
  doc.font('Helvetica-Bold').fontSize(20).fillColor(VERDE).text('AgroTotal', x0);
  doc.font('Helvetica').fontSize(10).fillColor(CINZA).text('Relatório da propriedade', x0);
  doc.moveDown(0.8).font('Helvetica-Bold').fontSize(16).fillColor('#222222').text(d.fazenda.nome, x0);
  doc.font('Helvetica').fontSize(10).fillColor(CINZA)
    .text(`${d.fazenda.cidade}/${d.fazenda.estado}${d.fazenda.areaTotal ? ` · ${num(d.fazenda.areaTotal)} ha` : ''}`, x0)
    .text(`Período: ${descreverPeriodo(d.periodo)}`, x0)
    .text(`Gerado em ${d.geradoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, x0);

  // ---- resumo financeiro
  const f = d.financeiro;
  titulo('Resumo financeiro');
  tabela(
    ['', 'Valor'],
    [
      ['Receitas', brl(f.receitas)],
      ['Despesas', brl(f.despesas)],
      ['Saldo', brl(f.saldo)],
      ['Margem', f.margemPct === null ? '—' : `${num(f.margemPct, 1)}%`],
    ],
    [3, 2],
  );

  if (f.despesasPorCategoria.length) {
    titulo('Despesas por categoria');
    tabela(['Categoria', '%', 'Total'], f.despesasPorCategoria.map((c) => [c.rotulo, `${num(c.pct, 1)}%`, brl(c.total)]), [5, 1.2, 2.4]);
  }
  if (f.receitasPorCategoria.length) {
    titulo('Receitas por categoria');
    tabela(['Categoria', '%', 'Total'], f.receitasPorCategoria.map((c) => [c.rotulo, `${num(c.pct, 1)}%`, brl(c.total)]), [5, 1.2, 2.4]);
  }
  if (f.mensal.length) {
    titulo('Fluxo mensal');
    tabela(
      ['Mês', 'Receitas', 'Despesas', 'Saldo'],
      f.mensal.map((m) => [`${m.mes.slice(5)}/${m.mes.slice(0, 4)}`, brl(m.receitas), brl(m.despesas), brl(m.saldo)]),
      [1.4, 2.4, 2.4, 2.4],
    );
  }

  // ---- rebanho
  titulo('Rebanho');
  doc.font('Helvetica').fontSize(10).fillColor('#222222')
    .text(`Animais ativos: ${d.rebanho.ativos}${d.rebanho.pesoMedioKg ? ` · peso médio: ${num(d.rebanho.pesoMedioKg, 1)} kg` : ''}`, x0);
  if (d.rebanho.invernadas.length) {
    doc.moveDown(0.5);
    tabela(
      ['Invernada', 'Área (ha)', 'Animais', 'Lotação (an./ha)'],
      d.rebanho.invernadas.map((i) => [i.nome, num(i.areaHa), String(i.animais), i.lotacao === null ? '—' : num(i.lotacao)]),
      [3, 1.6, 1.4, 2],
    );
  }

  // ---- lavouras
  if (d.lavouras.length) {
    titulo('Lavouras');
    tabela(
      ['Lavoura', 'Cultura', 'Área (ha)', 'Custo', 'Receita', 'Resultado'],
      d.lavouras.map((l) => [l.nome, l.cultura, num(l.areaHa), brl(l.custo), brl(l.receita), brl(l.resultado)]),
      [2.2, 1.6, 1.3, 1.9, 1.9, 1.9],
    );
  }

  // ---- rodapé em todas as páginas
  const paginas = doc.bufferedPageRange();
  for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor(CINZA).text(
      `AgroTotal · ${d.fazenda.nome} · página ${i + 1} de ${paginas.count}`,
      x0,
      doc.page.height - 36,
      { width: largura, align: 'center', lineBreak: false },
    );
  }

  doc.end();
  await new Promise((resolve) => saida.on('finish', resolve));
  return saida.getContents() as Buffer;
}
