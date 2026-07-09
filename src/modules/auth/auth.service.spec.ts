import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsuarioService } from '../usuario/usuario.service';
import { MailerService } from 'src/common/mailer/mailer.service';

const SHA256_HEX = /^[a-f0-9]{64}$/;

describe('AuthService — segurança', () => {
  let service: AuthService;
  let usuarioService: any;
  let mailerService: any;

  beforeEach(async () => {
    usuarioService = {
      findByEmail: jest.fn(),
      findByAppleId: jest.fn(),
      findByResetToken: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    };
    mailerService = { send: jest.fn().mockResolvedValue({}) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuarioService, useValue: usuarioService },
        { provide: JwtService, useValue: { sign: () => 'jwt-token' } },
        { provide: MailerService, useValue: mailerService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('register não devolve o campo senha na resposta', async () => {
    usuarioService.findByEmail.mockResolvedValue(null);
    usuarioService.create.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      nome: 'Fulano',
      senha: '$2a$10$hashsecreto',
    });

    const result = await service.register({
      email: 'a@b.com',
      nome: 'Fulano',
      senha: 'segredo123',
    } as any);

    expect(result.token).toBe('jwt-token');
    expect(result.user).toBeDefined();
    expect((result.user as any).senha).toBeUndefined();
    expect(result.user.email).toBe('a@b.com');
  });

  it('forgotPassword grava um HASH do token (não o valor em claro)', async () => {
    usuarioService.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    await service.forgotPassword('a@b.com');

    expect(usuarioService.update).toHaveBeenCalledTimes(1);
    const patch = usuarioService.update.mock.calls[0][1];
    // token armazenado deve ser um SHA-256 (64 hex), não um uuid de 36 chars
    expect(patch.resetToken).toMatch(SHA256_HEX);
    expect(mailerService.send).toHaveBeenCalled();
  });

  it('resetPassword procura o usuário pelo HASH do token recebido', async () => {
    usuarioService.findByResetToken.mockResolvedValue({
      id: 'u1',
      resetTokenExpires: new Date(Date.now() + 60_000),
    });

    await service.resetPassword({ token: 'token-em-claro-123', senha: 'novaSenha1' } as any);

    const lookupArg = usuarioService.findByResetToken.mock.calls[0][0];
    expect(lookupArg).toMatch(SHA256_HEX);
    expect(lookupArg).not.toBe('token-em-claro-123');
  });

  it('resetPassword rejeita token expirado', async () => {
    usuarioService.findByResetToken.mockResolvedValue({
      id: 'u1',
      resetTokenExpires: new Date(Date.now() - 60_000),
    });

    await expect(
      service.resetPassword({ token: 'x', senha: 'y' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
