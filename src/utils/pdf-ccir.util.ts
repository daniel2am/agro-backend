import * as pdfParse from 'pdf-parse';

export async function parseCcirPdf(buffer: Buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;

  // Exemplo de regex. Ajuste para seu layout real!
  const cadastroIncra = /Código do Imóvel Rural[:\s]+(\d+)/.exec(text)?.[1]?.trim() ?? '';
  const nome = /Denominação do Imóvel[:\s]+(.+)/.exec(text)?.[1]?.trim() ?? '';
  const areaTotal = /Área Total[:\s]+([\d,.]+)/.exec(text)?.[1]?.replace(',', '.') ?? '';
  const cidade = /Município Sede do Imóvel Rural[:\s]+(.+)/.exec(text)?.[1]?.trim() ?? '';
  const estado = /UF[:\s]+([A-Z]{2})/.exec(text)?.[1]?.trim() ?? '';

  // Titulares (ajuste conforme necessário)
  const titulares: any[] = [];
  const titularRegex = /Nome[:\s]+(.+)\nCPF\/CNPJ[:\s]+([\d./-]+)\nNacionalidade[:\s]+(.+)\nCondição[:\s]+(.+)\nPercentual de Detenção[:\s]+([\d,.]+)/g;
  let titularMatch;
  while ((titularMatch = titularRegex.exec(text))) {
    titulares.push({
      nome: titularMatch[1].trim(),
      cpfCnpj: titularMatch[2].trim(),
      nacionalidade: titularMatch[3].trim(),
      condicao: titularMatch[4].trim(),
      percentualDetencao: parseFloat(titularMatch[5].replace(',', '.')),
    });
  }

  return {
    cadastroIncra,
    nome,
    cidade,
    estado,
    areaTotal: areaTotal ? parseFloat(areaTotal) : undefined,
    titulares,
  };
}
