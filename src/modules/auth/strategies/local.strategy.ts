import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    // informa que o campo de login é email (e não username)
    super({ usernameField: 'email' });
  }

  async validate(email: string, senha: string) {
    const user = await this.authService.validateUser(email, senha);
    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    return user;
  }
}
