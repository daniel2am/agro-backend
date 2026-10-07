import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    // Conta excluída: o token assinado continua válido até expirar, então
    // confere se o usuário ainda existe (o app trata o 401 saindo da sessão).
    const existe = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });
    if (!existe) throw new UnauthorizedException('Conta não encontrada');
    return { id: payload.sub, email: payload.email };
  }
}
