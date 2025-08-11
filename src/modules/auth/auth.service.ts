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
import {
  RegisterAuthDto,
  ResetPasswordDto,
} from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService
  ) {}

  async register(dto: RegisterAuthDto) {
    console.log('🧾 DTO recebido:', dto);
    const userExists = await this.usuarioService.findByEmail(dto.email);
    if (userExists) {
      throw new BadRequestException('E-mail já cadastrado');
    }

    const user = await this.usuarioService.create(dto);

    // 🔥 Gere o token aqui:
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    // ✅ Retorne o token e o usuário
    return {
      token,
      user,
    };

  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
    };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user,
    };
  }

  async googleLogin(googleUser: any) {
    if (!googleUser) throw new UnauthorizedException();

    let user = await this.usuarioService.findByEmail(googleUser.email);
    if (!user) {
      user = await this.usuarioService.create({
        nome: googleUser.nome || googleUser.name,
        email: googleUser.email,
        senha: uuidv4(), // senha aleatória
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
    };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.usuarioService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('E-mail não cadastrado');
    }

    const token = uuidv4();
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

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

    return {
      message: 'E-mail de recuperação enviado com sucesso.',
    };
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
    });

    return {
      message: 'Senha redefinida com sucesso.',
    };
  }

  async loginWithGoogle(user: { email: string; nome: string; googleId: string }) {
    let usuario = await this.usuarioService.findByEmail(user.email);

    if (!usuario) {
      usuario = await this.usuarioService.create({
        nome: user.nome,
        email: user.email,
        senha: '', // senha vazia, login só via Google
      });
    }

    const payload = {
      sub: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async validateUser(email: string, senha: string) {
  const user = await this.usuarioService.findByEmail(email);
  if (!user) return null;

  const ok = await bcrypt.compare(senha, user.senha);
  if (!ok) return null;

  const { senha: _, ...safe } = user;
  return safe;
}
}
