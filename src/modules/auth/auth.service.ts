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
import { OAuth2Client } from 'google-auth-library';
import * as jose from 'jose';

@Injectable()
export class AuthService {
  private google = new OAuth2Client();

  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  // ========= Registro/Login (email/senha) =========
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

  // ========= Fluxo Web (Passport Google) =========
  async googleLogin(googleUser: any) {
    if (!googleUser) throw new UnauthorizedException();

    let user = await this.usuarioService.findByEmail(googleUser.email);
    if (!user) {
      user = await this.usuarioService.create({
        nome: googleUser.nome || googleUser.name || 'Usuário',
        email: googleUser.email,
        senha: uuidv4(),
        googleId: googleUser.sub ?? undefined,
      } as any);
    } else if (!user.googleId && googleUser.sub) {
      user = await this.usuarioService.update(user.id, { googleId: googleUser.sub } as any);
    }

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
    return { token, user };
  }

  // ========= Fluxo Mobile: Google (ID Token) =========
  async loginOrRegisterWithGoogleIdToken(idToken: string) {
    if (!idToken) throw new BadRequestException('idToken é obrigatório');

    const audience = [
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_EXPO_CLIENT_ID,
      process.env.GOOGLE_CLIENT_ID, // web (opcional)
    ].filter(Boolean) as string[];

    const ticket = await this.google.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new UnauthorizedException('Token do Google inválido');

    const googleId = payload.sub;
    const email = payload.email ?? null;
    const nome = payload.name ?? 'Usuário Google';
    const picture = payload.picture ?? null;

    let user = email ? await this.usuarioService.findByEmail(email) : null;
    if (!user) user = await this.usuarioService.findByGoogleId(googleId);

    if (!user) {
      user = await this.usuarioService.create({
        nome,
        email: email ?? `google-${googleId}@noemail.local`,
        senha: uuidv4(),
        googleId,
        fotoUrl: picture,
        status: 'ativo',
      } as any);
    } else {
      user = await this.usuarioService.update(user.id, {
        googleId: user.googleId ?? googleId,
        fotoUrl: user.fotoUrl ?? picture,
        status: user.status ?? 'ativo',
      } as any);
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { token, user };
  }

  // ========= Fluxo Mobile: Apple (Identity Token) =========
  async loginOrRegisterWithAppleIdToken(identityToken: string) {
    if (!identityToken) throw new BadRequestException('identityToken é obrigatório');

    const JWKS = jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
    let verified: jose.JWTVerifyResult;
    try {
      verified = await jose.jwtVerify(identityToken, JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: process.env.APPLE_AUDIENCE, // bundleId do app
      });
    } catch {
      throw new UnauthorizedException('Token da Apple inválido');
    }

    const claims = verified.payload as any;
    const appleId = claims.sub as string;
    const email = (claims.email as string | undefined) ?? null;
    const nome = 'Usuário Apple';

    let user = email ? await this.usuarioService.findByEmail(email) : null;
    if (!user) user = await this.usuarioService.findByAppleId(appleId);

    if (!user) {
      user = await this.usuarioService.create({
        nome: email ?? nome,
        email: email ?? `apple-${appleId}@noemail.local`,
        senha: uuidv4(),
        appleId,
        status: 'ativo',
      } as any);
    } else {
      user = await this.usuarioService.update(user.id, {
        appleId: user.appleId ?? appleId,
        status: user.status ?? 'ativo',
      } as any);
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { token, user };
  }

  // ========= Esqueci/Reset de Senha =========
  async forgotPassword(email: string) {
    const user = await this.usuarioService.findByEmail(email);
    if (!user) throw new BadRequestException('E-mail não cadastrado');

    const token = uuidv4();
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h

    await this.usuarioService.update(user.id, {
      resetToken: token,
      resetTokenExpires: expires as any,
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

  // ========= Validação local (para strategy local) =========
  async validateUser(email: string, senha: string) {
    const user = await this.usuarioService.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) return null;
    const { senha: _pass, ...safe } = user;
    return safe;
  }
}