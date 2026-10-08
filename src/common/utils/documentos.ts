// Validação de documentos brasileiros (dígitos verificadores). Usada pelo LCDPR,
// onde um CPF/CNPJ inválido faz o arquivo ser rejeitado pela Receita.

export const apenasDigitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

function todosIguais(s: string) {
  return /^(\d)\1+$/.test(s);
}

export function cpfValido(valor: unknown): boolean {
  const cpf = apenasDigitos(valor);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;
  const dv = (base: string, pesoInicial: number) => {
    const soma = base.split('').reduce((s, d, i) => s + Number(d) * (pesoInicial - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(cpf.slice(0, 9), 10) === Number(cpf[9]) && dv(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

export function cnpjValido(valor: unknown): boolean {
  const cnpj = apenasDigitos(valor);
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split('').reduce((s, d, i) => s + Number(d) * pesos[i]!, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(cnpj.slice(0, 12)) === Number(cnpj[12]) && dv(cnpj.slice(0, 13)) === Number(cnpj[13]);
}

/** CPF (11) ou CNPJ (14) válido? */
export function cpfOuCnpjValido(valor: unknown): boolean {
  const d = apenasDigitos(valor);
  return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false;
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
