import { parseKeyVals } from './log-parser';

describe('parseKeyVals', () => {
  it('separa chaves colados por espaço sem engolir a seguinte (bug do "brinco=BR-0001 id")', () => {
    const kv = parseKeyVals('animal_criado brinco=BR-0001 id=abc-123 fazenda=faz-9');
    expect(kv).toEqual({ brinco: 'BR-0001', id: 'abc-123', fazenda: 'faz-9' });
  });

  it('lê o log de pesagem completo', () => {
    const kv = parseKeyVals(
      'pesagem_registrada animal=a1 brinco=BR-0001 pesoKg=420 fazenda=f1',
    );
    expect(kv.animal).toBe('a1');
    expect(kv.brinco).toBe('BR-0001');
    expect(kv.pesoKg).toBe('420');
    expect(kv.fazenda).toBe('f1');
  });

  it('mantém valores com datas ISO e listas separadas por vírgula', () => {
    const kv = parseKeyVals(
      'animal_atualizado brinco=X1 id=i1 changes=peso,raca data=2026-10-07T10:00:00.000Z',
    );
    expect(kv.changes).toBe('peso,raca');
    expect(kv.data).toBe('2026-10-07T10:00:00.000Z');
  });

  it('aceita valores com espaço até a próxima chave', () => {
    const kv = parseKeyVals('manejo_criado tipo=Vacina aftosa id=m1');
    expect(kv.tipo).toBe('Vacina aftosa');
    expect(kv.id).toBe('m1');
  });

  it('valor vazio não vira a chave seguinte', () => {
    const kv = parseKeyVals('animal_criado brinco= id=i1');
    expect(kv.brinco).toBe('');
    expect(kv.id).toBe('i1');
  });

  it('linha sem pares devolve objeto vazio', () => {
    expect(parseKeyVals('login_ok')).toEqual({});
    expect(parseKeyVals('')).toEqual({});
  });

  it('para no fim da linha, sem vazar para a próxima', () => {
    const kv = parseKeyVals('a x=1\nb y=2');
    expect(kv.x).toBe('1');
    expect(kv.y).toBe('2');
  });
});
