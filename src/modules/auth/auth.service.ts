// src/modules/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuarioService } from '../usuario/usuario.service';
import { MailerService } from 'src/common/mailer/mailer.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { RegisterAuthDto, ResetPasswordDto } from './dto';

type GoogleIdTokenPayload = {
  iss: string;
  sub: string;        // googleId
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  aud?: string | string[];
};

type AppleTokenPayload = {
  iss: string;
  sub: string;        // appleId
  email?: string;
  email_verified?: boolean | string;
  aud?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  // ========== Email/senha ==========
  async register(dto: RegisterAuthDto) {
    const userExists = await this.usuarioService.findByEmail(dto.email);
    if (userExists) throw new BadRequestException('E-mail já cadastrado');

    const user = await this.usuarioService.create(dto);
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return { token, user };
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
    return { token, user };
  }

  // ========== Google OAuth (passport) ==========
  async googleLogin(googleUser: any) {
    if (!googleUser) throw new UnauthorizedException();

    // Esperado do Passport Google Strategy:
    // { email, nome|name, id (googleId), picture? }
    const email = googleUser.email;
    const googleId = googleUser.id;

    if (!email || !googleId) {
      throw new UnauthorizedException('Dados do Google incompletos');
    }

    let user = await this.usuarioService.findByEmail(email);

    if (!user) {
      // Cria novo usuário
      user = await this.usuarioService.create({
        nome: googleUser.nome || googleUser.name || 'Usuário',
        email,
        senha: uuidv4(), // senha aleatória (não usada)
      });
      await this.usuarioService.update(user.id, {
        googleId,
        fotoUrl: googleUser.picture ?? undefined,
        ultimoLogin: new Date(),
      });
    } else {
      // Vincula/atualiza conta Google
      await this.usuarioService.update(user.id, {
        googleId: user.googleId ?? googleId, // não sobrescreve se já tem
        fotoUrl: googleUser.picture ?? user.fotoUrl ?? undefined,
        ultimoLogin: new Date(),
      });
    }

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
    return { token, user };
  }

  // ========== Google ID Token (App) ==========
  async loginOrRegisterWithGoogleIdToken(idToken: string) {
    if (!idToken) throw new BadRequestException('idToken ausente');

    const { jwtVerify, createRemoteJWKSet } = await import('jose');

    const audience = process.env.GOOGLE_CLIENT_ID; // o mesmo usado no backend web
    if (!audience) throw new Error('GOOGLE_CLIENT_ID não configurado');

    // JWKS do Google
    const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience,
    });

    const p = payload as GoogleIdTokenPayload;
    if (!p.sub) throw new UnauthorizedException('Token do Google inválido');

    const email = p.email;
    const googleId = p.sub;

    if (!email) {
      throw new UnauthorizedException('Google não retornou e-mail verificado');
    }

    let user = await this.usuarioService.findByEmail(email);

    if (!user) {
      user = await this.usuarioService.create({
        nome: p.name || 'Usuário',
        email,
        senha: uuidv4(),
      });
      await this.usuarioService.update(user.id, {
        googleId,
        fotoUrl: (payload as any).picture ?? undefined,
        ultimoLogin: new Date(),
      });
    } else {
      await this.usuarioService.update(user.id, {
        googleId: user.googleId ?? googleId,
        fotoUrl: (payload as any).picture ?? user.fotoUrl ?? undefined,
        ultimoLogin: new Date(),
      });
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { token, user };
  }

  // ========== Apple Identity Token (App) ==========
  async loginOrRegisterWithAppleIdToken(identityToken: string) {
    if (!identityToken) throw new BadRequestException('identityToken ausente');

    const { jwtVerify, createRemoteJWKSet } = await import('jose');

    const audience = process.env.APPLE_CLIENT_ID; // ex.: bundle id ou service id
    if (!audience) throw new Error('APPLE_CLIENT_ID não configurado');

    const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
    const { payload } = await jwtVerify(identityToken, JWKS, {
      issuer: 'https://appleid.apple.com',
      audience,
    });

    const p = payload as AppleTokenPayload;
    if (!p.sub) throw new UnauthorizedException('Token da Apple inválido');

    const appleId = p.sub;
    const email = p.email; // a Apple pode não retornar sempre o email

    let user = email ? await this.usuarioService.findByEmail(email) : null;

    if (!user) {
      // Sem email verificado, criamos com identificador Apple e e-mail opcional
      user = await this.usuarioService.create({
        nome: 'Usuário Apple',
        email: email ?? `${appleId}@privaterelay.appleid.com`, // fallback
        senha: uuidv4(),
      });
      await this.usuarioService.update(user.id, {
        appleId,
        ultimoLogin: new Date(),
      });
    } else {
      await this.usuarioService.update(user.id, {
        appleId: user.appleId ?? appleId,
        ultimoLogin: new Date(),
      });
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { token, user };
  }

  // ========== Esqueci/Reset ==========
  async forgotPassword(email: string) {
    const user = await this.usuarioService.findByEmail(email);
    if (!user) throw new BadRequestException('E-mail não cadastrado');

    const token = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.usuarioService.update(user.id, {
      resetToken: token,
      resetTokenExpires: expires,
    });

    const url = `https://www.agrototalapp.com.br/reset?token=${token}`;
    await this.mailerService.send({
      to: user.email,
      subject: 'Recuperação de senha',
      text: `Use este link para resetar sua senha: ${url}`,
      html: `<p>Use este link para resetar sua senha: <a href="${url}">${url}</a></p>`,
    });

    return { message: 'E-mail de recuperação enviado com sucesso.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usuarioService.findByResetToken(dto.token);
    if (!user || (user.resetTokenExpires && user.resetTokenExpires < new Date())) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const senhaCriptografada = await bcrypt.hash(dto.senha, 10);
    await this.usuarioService.update(user.id, {
      senha: senhaCriptografada,
      resetToken: null,
      resetTokenExpires: null,
    });

    return { message: 'Senha redefinida com sucesso.' };
  }

  // Helper (se quiser expor no futuro)
  issueTokenForUser(user: { id: string; email: string }) {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }
}