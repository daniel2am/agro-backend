import { analisarDsn } from './sentry';

const BOM = 'https://abc123def456@o111.ingest.us.sentry.io/222';

describe('analisarDsn', () => {
  it('aceita um DSN correto e devolve só o host', () => {
    const r = analisarDsn(BOM);
    expect(r).toMatchObject({ valido: true, host: 'o111.ingest.us.sentry.io' });
  });

  it('limpa aspas, vírgula, espaços e o prefixo dsn: copiados do painel', () => {
    for (const sujo of [`"${BOM}"`, `"${BOM}",`, `  ${BOM}  \n`, `dsn: "${BOM}",`, `'${BOM}';`]) {
      const r = analisarDsn(sujo);
      expect(r.valido).toBe(true);
      expect(r.dsn).toBe(BOM);
    }
  });

  it('explica o motivo quando é inválido, sem vazar o valor', () => {
    expect(analisarDsn(undefined).valido).toBe(false);
    expect(analisarDsn('   ').motivo).toMatch(/vazio/);
    expect(analisarDsn('isso nao e url').motivo).toMatch(/URL/);
    expect(analisarDsn('ftp://x@h.io/1').motivo).toMatch(/https/);
    expect(analisarDsn('https://o111.ingest.us.sentry.io/222').motivo).toMatch(/chave/);
    expect(analisarDsn('https://abc@o111.ingest.us.sentry.io/').motivo).toMatch(/projeto/);
    expect(JSON.stringify(analisarDsn('https://segredo123@h.io/'))).not.toMatch(/motivo":"[^"]*segredo123/);
  });
});
