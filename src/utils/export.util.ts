import { Parser as Json2CsvParser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

export function exportToCSV(data: any[], filename = 'export.csv') {
  const parser = new Json2CsvParser();
  const csv = parser.parse(data);
  return { buffer: Buffer.from(csv, 'utf-8'), filename: filename + '.csv' };
}

export function exportToPDF(data: any[], title = 'Exportação') {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  const pass = new PassThrough();
  doc.pipe(pass);
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown();
  data.forEach((item, i) => {
    doc.fontSize(12).text(`${i + 1}. ${JSON.stringify(item)}`);
    doc.moveDown(0.5);
  });
  doc.end();
  return new Promise<{ buffer: Buffer; filename: string }>((resolve) => {
    const bufs: Buffer[] = [];
    pass.on('data', d => bufs.push(d));
    pass.on('end', () => {
      resolve({ buffer: Buffer.concat(bufs), filename: `${title.replace(/\s+/g, '_').toLowerCase()}.pdf` });
    });
  });
}
