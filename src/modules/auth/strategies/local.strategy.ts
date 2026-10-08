import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    // Campos que seu login usa no body
    super({ usernameField: 'email', passwordField: 'senha' });
  }

  async validate(email: string, senha: string) {
    // o guard roda antes do ValidationPipe: o byte nulo não pode chegar ao Postgres (viraria 500)
    if (email.includes('\u0000') || senha.includes('\u0000')) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const user = await this.authService.validateUser(email, senha);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return user; // cai em req.user no LocalAuthGuard
  }
}