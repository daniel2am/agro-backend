import { apenasDigitos, cnpjValido, cpfOuCnpjValido, cpfValido } from './documentos';

describe('cpfValido', () => {
  it('aceita CPFs válidos, com ou sem máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('111.444.777-35')).toBe(true);
  });
  it('rejeita dígito verificador errado, tamanho errado e repetidos', () => {
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('1234567890')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('')).toBe(false);
    expect(cpfValido(null)).toBe(false);
  });
});

describe('cnpjValido', () => {
  it('aceita CNPJ válido, com ou sem máscara', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11222333000181')).toBe(true);
  });
  it('rejeita inválidos', () => {
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('123')).toBe(false);
  });
});

describe('cpfOuCnpjValido / apenasDigitos', () => {
  it('decide pelo tamanho', () => {
    expect(cpfOuCnpjValido('529.982.247-25')).toBe(true);
    expect(cpfOuCnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cpfOuCnpjValido('123456789012')).toBe(false);
  });
  it('apenasDigitos', () => {
    expect(apenasDigitos('12.345/6-7')).toBe('1234567');
    expect(apenasDigitos(undefined)).toBe('');
  });
});
