import pdfParse from 'pdf-parse';

// Exemplo de parser: ajuste as regex conforme necessidade para pegar cada campo
export async function parseCcirPdfUtil(buffer: Buffer) {
  const data = await pdfParse(buffer);
  const text = data.text.replace(/\n/g, ' ');

  // Exemplo (ajuste para o layout real do CCIR):
  const codigoImovel = text.match(/Código do Imóvel Rural:?\s*(\d+)/i)?.[1] ?? '';
  const denominacao = text.match(/Denominação do Imóvel:?\s*(.*?)(?:Área|Município|UF|$)/i)?.[1]?.trim() ?? '';
  const areaTotal = parseFloat(text.match(/Área Total \(ha\):?\s*([\d.,]+)/i)?.[1]?.replace(',', '.') ?? '0');
  const municipio = text.match(/Município Sede do Imóvel Rural:?\s*(.*?)(?:UF|Módulo Rural|$)/i)?.[1]?.trim() ?? '';
  const estado = text.match(/UF:?\s*([A-Z]{2})/)?.[1] ?? '';
  const moduloRural = parseFloat(text.match(/Módulo Rural \(ha\):?\s*([\d.,]+)/i)?.[1]?.replace(',', '.') ?? '0');
  const numeroModulos = parseFloat(text.match(/Nº de Módulos Rurais:?\s*([\d.,]+)/i)?.[1]?.replace(',', '.') ?? '0');
  const numeroCcir = text.match(/Nº do CCIR:?\s*(\d+)/i)?.[1] ?? '';

  // Titulares (pode ter mais de um)
  const titulares: any[] = [];
  const titularRegex = /Nome:\s*(.*?)\s+CPF\/CNPJ:\s*([\d./-]+)\s+Nacionalidade:\s*(.*?)\s+Condição:\s*(.*?)\s+Percentual de Detenção:\s*([\d.,]+)/g;
  let m;
  while ((m = titularRegex.exec(text))) {
    titulares.push({
      nome: m[1],
      cpfCnpj: m[2],
      nacionalidade: m[3],
      condicao: m[4],
      percentualDetencao: parseFloat(m[5].replace(',', '.')),
    });
  }

  return {
    codigoImovel,
    denominacao,
    areaTotal,
    municipio,
    estado,
    moduloRural,
    numeroModulos,
    numeroCcir,
    titulares,
  };
}
