// src/modules/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuarioService } from '../usuario/usuario.service';
import { MailerService } from 'src/common/mailer/mailer.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { RegisterAuthDto, ResetPasswordDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService
  ) {}

  async register(dto: RegisterAuthDto) {
    const email = dto.email.trim().toLowerCase();
    const userExists = await this.usuarioService.findByEmail(email);
    if (userExists) {
      throw new BadRequestException('E-mail já cadastrado');
    }

    const user = await this.usuarioService.create({
      ...dto,
      email,
    });

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    try {
      await this.usuarioService.update(user.id, { ultimoLogin: new Date() } as any);
    } catch (_) {}

    return { token, user };
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    try {
      await this.usuarioService.update(user.id, { ultimoLogin: new Date() } as any);
    } catch (_) {}

    return { token, user };
  }

  /** Usado pelo LocalStrategy */
  async validateUser(email: string, senha: string) {
    const user = await this.usuarioService.findByEmail((email ?? '').trim().toLowerCase());
    if (!user) return null;

    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) return null;

    const { senha: _omit, ...safe } = user as any;
    return safe;
  }

  /** Google (via Passport, já funcionando no seu fluxo) */
  async googleLogin(googleUser: any) {
    if (!googleUser) throw new UnauthorizedException();

    const email = (googleUser.email ?? '').trim().toLowerCase();
    if (!email) throw new BadRequestException('Google não retornou e-mail.');

    let user = await this.usuarioService.findByEmail(email);
    if (!user) {
      user = await this.usuarioService.create({
        nome: googleUser.nome || googleUser.name || email,
        email,
        senha: uuidv4(), // senha aleatória, usuário loga pelo Google
      });
    }

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    try {
      await this.usuarioService.update(user.id, { ultimoLogin: new Date() } as any);
    } catch (_) {}

    return { token, user };
  }

  /** Apple (novo) — verifica o identityToken, cria/associa usuário e emite JWT */
  async loginOrRegisterWithAppleIdToken(identityToken: string) {
    if (!identityToken) throw new BadRequestException('identityToken ausente');

    // Evita erro ESM do pacote 'jose' com Nest (usa import dinâmico).
    const jose = await import('jose');

    const JWKS = jose.createRemoteJWKSet(
      new URL('https://appleid.apple.com/auth/keys')
    );

    // APPLE_AUDIENCE deve ser seu bundleId iOS (ex: com.agrototal.app)
    const audience = process.env.APPLE_AUDIENCE || 'com.agrototal.app';

    let payload: any;
    try {
      const { payload: p } = await jose.jwtVerify(identityToken, JWKS, {
        issuer: 'https://appleid.apple.com',
        audience,
      });
      payload = p;
    } catch (e) {
      throw new UnauthorizedException('Identity Token inválido');
    }

    const sub = payload?.sub as string; // id único Apple
    const email = (payload?.email as string | undefined)?.toLowerCase() || null;
    if (!sub) throw new UnauthorizedException('sub ausente no token da Apple');

    // tenta localizar por email (se Apple forneceu no 1º login), senão por appleId
    let user = email ? await this.usuarioService.findByEmail(email) : null;
    if (!user) {
      user = await this.usuarioService.findByAppleId(sub);
    }

    if (!user) {
      // cria usuário (se a Apple não mandar email, usamos um fallback interno)
      user = await this.usuarioService.create({
        nome: email ?? 'Usuário Apple',
        email: email ?? `${sub}@apple.local`,
        senha: uuidv4(),       // login sempre via Apple
        appleId: sub,
      } as any);
    } else if (!user.appleId) {
      // garante o vínculo appleId no perfil existente
      await this.usuarioService.update(user.id, { appleId: sub } as any);
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    try {
      await this.usuarioService.update(user.id, { ultimoLogin: new Date() } as any);
    } catch (_) {}

    return { token, user };
  }

  // (Google ID Token desabilitado, seu fluxo atual não usa este endpoint)
  async loginOrRegisterWithGoogleIdToken(_idToken: string) {
    throw new BadRequestException('Endpoint não habilitado neste fluxo.');
  }

  async forgotPassword(email: string) {
    const norm = (email ?? '').trim().toLowerCase();
    const user = await this.usuarioService.findByEmail(norm);
    if (!user) throw new BadRequestException('E-mail não cadastrado');

    const token = uuidv4();
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h

    await this.usuarioService.update(user.id, {
      resetToken: token,
      resetTokenExpires: expires,
    } as any);

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
    if (!user || user.resetTokenExpires < new Date()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const senhaCriptografada = await bcrypt.hash(dto.senha, 10);
    await this.usuarioService.update(user.id, {
      senha: senhaCriptografada,
      resetToken: null,
      resetTokenExpires: null,
    } as any);

    return { message: 'Senha redefinida com sucesso.' };
  }
}