import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthService } from '../auth.service';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { LocalStrategy } from './local.strategy';

@Controller('auth')
class FakeAuthController {
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Body() _b: unknown) {
    return { ok: true };
  }
}

describe('login: byte nulo passa pelo guard real', () => {
  const validateUser = jest.fn();
  let app: any;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [FakeAuthController],
      providers: [LocalStrategy, { provide: AuthService, useValue: { validateUser } }],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => validateUser.mockReset());

  it('responde 401 sem consultar o banco', async () => {
    const r = await request(app.getHttpServer()).post('/auth/login').send({ email: 'a\u0000b@x.com', senha: '123456' });
    expect(r.status).toBe(401);
    expect(validateUser).not.toHaveBeenCalled();
    const r2 = await request(app.getHttpServer()).post('/auth/login').send({ email: 'a@b.com', senha: '12\u000034567' });
    expect(r2.status).toBe(401);
    expect(validateUser).not.toHaveBeenCalled();
  });

  it('credenciais normais seguem para a validação', async () => {
    validateUser.mockResolvedValue({ id: 1 });
    const r = await request(app.getHttpServer()).post('/auth/login').send({ email: 'a@b.com', senha: '123456' });
    expect(r.status).toBe(201);
    expect(validateUser).toHaveBeenCalledWith('a@b.com', '123456');
  });
});
