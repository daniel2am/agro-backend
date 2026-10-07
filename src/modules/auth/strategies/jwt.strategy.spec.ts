import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  beforeAll(() => { process.env.JWT_SECRET = 'segredo-de-teste'; });

  it('aceita token de usuário que existe', async () => {
    const prisma: any = { usuario: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) } };
    const s = new JwtStrategy(prisma);
    await expect(s.validate({ sub: 'u1', email: 'a@b.com' })).resolves.toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('rejeita token de conta excluída (mesmo assinado e dentro da validade)', async () => {
    const prisma: any = { usuario: { findUnique: jest.fn().mockResolvedValue(null) } };
    const s = new JwtStrategy(prisma);
    await expect(s.validate({ sub: 'apagado', email: 'x@y.com' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
