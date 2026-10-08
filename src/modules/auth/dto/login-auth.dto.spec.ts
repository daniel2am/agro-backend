import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginAuthDto } from './login-auth.dto';

const erros = (o: object) => validate(plainToInstance(LoginAuthDto, o));

describe('LoginAuthDto', () => {
  it('aceita credenciais normais', async () => {
    expect(await erros({ email: 'a@b.com', senha: '123456' })).toHaveLength(0);
  });

  it('recusa byte nulo (o Postgres rejeitava e virava 500)', async () => {
    expect((await erros({ email: 'a\u0000b@x.com', senha: '123456' })).length).toBeGreaterThan(0);
    expect((await erros({ email: 'a@b.com', senha: '12\u000034567' })).length).toBeGreaterThan(0);
  });
});
