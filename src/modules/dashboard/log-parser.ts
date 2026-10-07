/**
 * Lê pares `chave=valor` de uma linha de log de auditoria, ex.:
 *   "animal_criado brinco=BR-0001 id=abc-123 fazenda=f-1"
 *
 * O valor vai até o próximo ` chave=` (ou fim da linha), então pode conter
 * espaços e `:`/`,` sem engolir a chave seguinte. A versão anterior usava
 * `[^=\n\r]+` para o valor, que consumia até o próximo `=` — com isso
 * `brinco=BR-0001 id=abc` virava `brinco = "BR-0001 id"` e o `id` sumia.
 */
export function parseKeyVals(acao: string): Record<string, string> {
  const mapa: Record<string, string> = {};
  const regex = /(\w+)=(.*?)(?=\s+\w+=|[\r\n]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(acao)) !== null) {
    mapa[m[1]] = m[2].trim();
  }
  return mapa;
}
