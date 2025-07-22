import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuarioService } from '../usuario/usuario.service';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto, LoginDto, ResetPasswordDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService
  ) {}

  async register(dto: CreateUserDto) {
    const userExists = await this.usuarioService.findByEmail(dto.email);
    if (userExists) throw new BadRequestException('E-mail já cadastrado');
    const senha = await bcrypt.hash(dto.senha, 10);
    const user = await this.usuarioService.create({ ...dto, senha });
    return { message: 'Conta criada com sucesso', user };
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
    return { token, user };
  }

  async googleLogin(googleUser: any) {
    if (!googleUser) throw new UnauthorizedException();
    let user = await this.usuarioService.findByEmail(googleUser.email);
    if (!user) {
      user = await this.usuarioService.create({
        nome: googleUser.nome || googleUser.name,
        email: googleUser.email,
        senha: uuidv4(), // senha aleatória, não usada para login local
      });
    }
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);
    return { token, user };
  }

  async forgotPassword(email: string) {
    const user = await this.usuarioService.findByEmail(email);
    if (!user) throw new BadRequestException('E-mail não cadastrado');
    const token = uuidv4();
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h
    await this.usuarioService.update(user.id, {
      resetToken: token,
      resetTokenExpires: expires,
    });
    const url = `https://www.agrototalapp.com.br/reset?token=${token}`;
    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Recuperação de senha',
      text: `Use este link para resetar sua senha: ${url}`,
      html: `<p>Use este link para resetar sua senha: <a href="${url}">${url}</a></p>`,
    });
    return { message: 'E-mail enviado' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usuarioService.findByResetToken(dto.token);
    if (!user || user.resetTokenExpires < new Date()) throw new BadRequestException('Token inválido ou expirado');
    const senha = await bcrypt.hash(dto.senha, 10);
    await this.usuarioService.update(user.id, {
      senha,
      resetToken: null,
      resetTokenExpires: null,
    });
    return { message: 'Senha redefinida com sucesso' };
  }

  async loginWithGoogle(user: { email: string; nome: string; googleId: string }) {
  // Verifica se existe no banco. Se não existir, cria.
  let usuario = await this.usuarioService.findByEmail(user.email);
  if (!usuario) {
    usuario = await this.usuarioService.create({
      nome: user.nome,
      email: user.email,
      senha: '', // Você pode gerar uma senha aleatória ou manter vazio
      // Pode adicionar googleId, caso queira salvar
    });
  }
  const payload = { sub: usuario.id, email: usuario.email, nome: usuario.nome };
  return { access_token: this.jwtService.sign(payload) };
}
  async validateUser(email: string, senha: string) {
    const user = await this.usuarioService.findByEmail(email);
    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    return user;
  }
}
